import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/ensure-user";
import { listInstituteNames, queryCounselingRule, queryCutoffs } from "@/lib/ai/tools";
import { routeIntent } from "@/lib/ai/router";
import { extractCutoffQuery, isQueryTooVague } from "@/lib/ai/extract";
import { withCompletionHook } from "@/lib/ai/log-stream";
import { currentModelName, streamAi, type AiHistoryTurn } from "@/lib/ai/provider";
import { AI_DAILY_QUESTION_LIMIT } from "@/lib/config";

// Runs on every request and may stream for a while.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_TURNS = 6;

const SYSTEM_PROMPT = `You are the OpenCounsel AI Admission Counselor.
Rules you must always follow:
- Never invent cutoff ranks, fees, eligibility rules, deadlines, or seat rules.
- Only state factual cutoff/rule information that appears in the "grounded context" provided to you.
- If grounded context says DATA_UNAVAILABLE, say clearly that the information isn't available and suggest checking the official portal.
- If grounded context says NEEDS_MORE_DETAIL, ask the student which institute and branch they mean (and their category / quota if relevant). Do not guess.
- If a cutoff row has isDemoData true, tell the student that figure is demo data, not an official JoSAA number.
- When you quote a cutoff, always mention its year, round, quota and category.
- Be concise. For simple questions (one topic, a definition, a yes/no), answer in 2-4 sentences with at most one short source citation. Do not use headers or bullet sections for simple questions.
- Only use a structured format (Short Answer / Evidence / What I Recommend) for genuinely complex, multi-part questions where structure actually helps.
- Always end every response with exactly this line on its own: "Verify the latest official counseling notification before making an irreversible decision."
- You do not decide eligibility or final choice ordering - the deterministic recommendation engine does that. You explain and assist only.`;

function sanitizeHistory(raw: unknown): AiHistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: AiHistoryTurn[] = [];
  for (const t of raw) {
    if (
      t &&
      (t.role === "user" || t.role === "assistant") &&
      typeof t.content === "string" &&
      t.content.trim()
    ) {
      turns.push({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_CHARS * 2) });
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

export async function POST(req: NextRequest) {
  // Login is required: this endpoint calls a rate-limited third-party AI API, so an
  // anonymous open pipe would be a direct abuse risk. Login is free.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please log in to use the AI counselor." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  const message: string = body.message.trim().slice(0, MAX_MESSAGE_CHARS);
  const examSystemCode: string = typeof body.examSystemCode === "string" ? body.examSystemCode : "JOSAA";
  const history = sanitizeHistory(body.history);

  // chat_sessions.user_id references users.id, so the row must exist first.
  await ensureUser(user);

  // Daily limit, counted from real chat_messages rows so it survives restarts and
  // works across instances.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ count: questionsToday }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.chatMessages)
    .innerJoin(schema.chatSessions, eq(schema.chatMessages.sessionId, schema.chatSessions.id))
    .where(
      and(
        eq(schema.chatSessions.userId, user.id),
        eq(schema.chatMessages.role, "user"),
        gte(schema.chatMessages.createdAt, oneDayAgo)
      )
    );

  if (questionsToday >= AI_DAILY_QUESTION_LIMIT) {
    return NextResponse.json(
      {
        error: `You've reached today's limit of ${AI_DAILY_QUESTION_LIMIT} AI counselor questions. Please try again tomorrow.`,
      },
      { status: 429 }
    );
  }

  const intent = routeIntent(message);
  let groundedContext = "";
  let toolUsed: string | null = null;

  if (intent === "RULE") {
    toolUsed = "counseling_rules";
    const topicPatterns: Record<string, RegExp> = {
      FREEZE: /freeze/i,
      FLOAT: /float/i,
      SLIDE: /slide/i,
      WITHDRAWAL: /withdraw/i,
      REFUND: /refund/i,
    };
    const matchedTopics = Object.keys(topicPatterns).filter((t) => topicPatterns[t].test(message));
    if (matchedTopics.length === 0) matchedTopics.push("");
    const results = await Promise.all(
      matchedTopics.map((topic) => queryCounselingRule({ examSystemCode, topic }))
    );
    groundedContext = JSON.stringify(
      matchedTopics.reduce((acc, topic, i) => {
        acc[topic || "GENERAL"] = results[i];
        return acc;
      }, {} as Record<string, unknown>)
    );
  } else if (intent === "CUTOFF") {
    toolUsed = "cutoffs";
    // Look up only what the student actually asked about, not an arbitrary sample.
    const known = await listInstituteNames(examSystemCode);
    const q = extractCutoffQuery(message, known);
    if (isQueryTooVague(q)) {
      groundedContext =
        "NEEDS_MORE_DETAIL: the question does not name an institute or a branch, so no cutoff rows were retrieved.";
    } else {
      const result = await queryCutoffs({
        examSystemCode,
        instituteNames: q.instituteNames,
        branchTerms: q.branchTerms,
        category: q.category,
        quota: q.quota,
        year: q.year,
        round: q.round,
      });
      groundedContext = JSON.stringify({
        filtersUsed: {
          institutes: q.instituteNames,
          branch: q.branchTerms,
          category: q.category ?? "any",
          quota: q.quota ?? "any",
          year: q.year ?? "latest first",
          round: q.round ?? "latest first",
        },
        ...result,
      }).slice(0, 6000);
    }
  } else {
    groundedContext = "No database lookup was needed for this question.";
  }

  // One session per conversation: reuse the client's session id if it is ours.
  let sessionId: string | null = null;
  if (typeof body.sessionId === "string" && body.sessionId) {
    const [owned] = await db
      .select({ id: schema.chatSessions.id })
      .from(schema.chatSessions)
      .where(and(eq(schema.chatSessions.id, body.sessionId), eq(schema.chatSessions.userId, user.id)))
      .limit(1);
    if (owned) sessionId = owned.id;
  }
  if (!sessionId) {
    const [created] = await db.insert(schema.chatSessions).values({ userId: user.id }).returning();
    sessionId = created.id;
  }
  const activeSessionId = sessionId;

  // Log the question first: the rate-limit count above reads from this table.
  await db.insert(schema.chatMessages).values({
    sessionId: activeSessionId,
    role: "user",
    content: message,
    toolUsed,
  });

  const model = currentModelName();
  const source = streamAi({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: message,
    groundedContext,
    history,
  });

  // The assistant reply is saved before the stream closes. Serverless hosts can freeze
  // a function the moment the response ends, so a write after that point may be lost.
  const stream = withCompletionHook(source, async (full) => {
    await db.insert(schema.chatMessages).values({
      sessionId: activeSessionId,
      role: "assistant",
      content: full,
      toolUsed,
      model,
    });
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-chat-intent": intent,
      "x-chat-session": activeSessionId,
      "x-questions-remaining-today": String(Math.max(0, AI_DAILY_QUESTION_LIMIT - questionsToday - 1)),
    },
  });
}

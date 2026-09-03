import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { queryCounselingRule, queryCutoffs } from "@/lib/ai/tools";
import { routeIntent } from "@/lib/ai/router";
import { streamAi } from "@/lib/ai/provider";
import { AI_DAILY_QUESTION_LIMIT_FREE } from "@/lib/config";

const SYSTEM_PROMPT = `You are the OpenCounsel AI Admission Counselor.
Rules you must always follow:
- Never invent cutoff ranks, fees, eligibility rules, deadlines, or seat rules.
- Only state factual cutoff/rule information that appears in the "grounded context" provided to you.
- If grounded context says DATA_UNAVAILABLE, say clearly that the information isn't available and suggest checking the official portal.
- Be concise. For simple questions (one topic, a definition, a yes/no), answer in 2-4 sentences with at most one short source citation. Do not use headers or bullet sections for simple questions.
- Only use a structured format (Short Answer / Evidence / What I Recommend) for genuinely complex, multi-part questions where structure actually helps.
- Always end every response with exactly this line on its own: "Verify the latest official counseling notification before making an irreversible decision."
- You do not decide eligibility or final choice ordering - the deterministic recommendation engine does that. You explain and assist only.`;

export async function POST(req: NextRequest) {
  // Auth is required: this endpoint calls a real, rate-limited third-party
  // AI API once AI_API_KEY is set, so an anonymous open pipe would be a
  // direct cost/abuse risk. Login is already free and frictionless
  // elsewhere in the app, so this is a low-cost way to close that gap.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Please log in to use the AI counselor." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  const message: string = body.message;
  const examSystemCode: string = body.examSystemCode ?? "JOSAA";

  // Daily question limit, enforced against real chat_messages rows rather
  // than an in-memory counter, so it survives server restarts and works
  // correctly across multiple instances.
  //
  // NOTE: AI_DAILY_QUESTION_LIMIT_PAID exists in config.ts but there's no
  // "isPaid"/tier column on the users table yet (payments are still mocked
  // - see lib/payments/provider.ts), so every logged-in user currently
  // gets the FREE limit. Once a real paid tier exists, branch on that flag
  // here to use AI_DAILY_QUESTION_LIMIT_PAID instead.
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

  if (questionsToday >= AI_DAILY_QUESTION_LIMIT_FREE) {
    return NextResponse.json(
      {
        error: `You've reached today's limit of ${AI_DAILY_QUESTION_LIMIT_FREE} AI counselor questions. Please try again tomorrow.`,
      },
      { status: 429 }
    );
  }

  const intent = routeIntent(message);
  let groundedContext = "";

  if (intent === "RULE") {
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
    const result = await queryCutoffs({ examSystemCode });
    groundedContext = JSON.stringify(result).slice(0, 4000);
  } else {
    groundedContext = "No database lookup was needed for this question.";
  }

  // Create a session for this exchange and log the user's message
  // immediately - this is also what the rate-limit count above reads from.
  const [session] = await db
    .insert(schema.chatSessions)
    .values({ userId: user.id })
    .returning();

  await db.insert(schema.chatMessages).values({
    sessionId: session.id,
    role: "user",
    content: message,
  });

  const stream = streamAi({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: message,
    groundedContext,
  });

  // Tee the stream: one branch goes to the client immediately, the other is
  // accumulated in the background and logged once complete. This is a
  // fire-and-forget write - it assumes a long-lived server process (this
  // app runs on Fly.io per fly.toml), not a serverless function that gets
  // torn down the instant the response is sent.
  const [clientStream, logStream] = stream.tee();

  void (async () => {
    try {
      const reader = logStream.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
      }
      await db.insert(schema.chatMessages).values({
        sessionId: session.id,
        role: "assistant",
        content: full,
      });
    } catch (err) {
      console.error("Failed to log AI response:", err);
    }
  })();

  return new Response(clientStream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-chat-intent": intent,
      "x-questions-remaining-today": String(
        Math.max(0, AI_DAILY_QUESTION_LIMIT_FREE - questionsToday - 1)
      ),
    },
  });
}
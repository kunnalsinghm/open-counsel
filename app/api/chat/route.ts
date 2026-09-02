import { NextRequest, NextResponse } from "next/server";
import { queryCounselingRule, queryCutoffs, routeIntent } from "@/lib/ai/tools";
import { streamAi } from "@/lib/ai/provider";

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
  const body = await req.json().catch(() => null);
  if (!body?.message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  const message: string = body.message;
  const examSystemCode: string = body.examSystemCode ?? "JOSAA";

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

  const stream = streamAi({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: message,
    groundedContext,
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-chat-intent": intent,
    },
  });
}

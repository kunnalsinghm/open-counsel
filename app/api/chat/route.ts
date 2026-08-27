import { NextRequest, NextResponse } from "next/server";
import { queryCounselingRule, queryCutoffs, routeIntent } from "@/lib/ai/tools";
import { callAi } from "@/lib/ai/provider";

const SYSTEM_PROMPT = `You are the OpenCounsel AI Admission Counselor.
Rules you must always follow:
- Never invent cutoff ranks, fees, eligibility rules, deadlines, or seat rules.
- Only state factual cutoff/rule information that appears in the "grounded context" provided to you.
- If grounded context says DATA_UNAVAILABLE, say clearly that the information isn't available and suggest checking the official portal.
- Structure factual answers as: Short Answer / Based On Your Profile / Evidence / What I Recommend / Important (always end with: "Verify the latest official counseling notification before making an irreversible decision.")
- You do not decide eligibility or final choice ordering — the deterministic recommendation engine does that. You explain and assist only.`;

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
    const topic = /freeze/i.test(message)
      ? "FREEZE"
      : /float/i.test(message)
      ? "FLOAT"
      : /slide/i.test(message)
      ? "SLIDE"
      : /withdraw/i.test(message)
      ? "WITHDRAWAL"
      : /refund/i.test(message)
      ? "REFUND"
      : "";
    const result = await queryCounselingRule({ examSystemCode, topic });
    groundedContext = JSON.stringify(result);
  } else if (intent === "CUTOFF") {
    const result = await queryCutoffs({ examSystemCode });
    groundedContext = JSON.stringify(result).slice(0, 4000);
  } else {
    groundedContext = "No database lookup was needed for this question.";
  }

  const aiResult = await callAi({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: message,
    groundedContext,
  });

  return NextResponse.json({ reply: aiResult.text, model: aiResult.model, intent });
}

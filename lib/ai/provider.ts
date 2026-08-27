/**
 * AI provider abstraction. In development / when AI_API_KEY is unset, this
 * falls back to a deterministic mock so the whole app is testable without
 * spending money on API calls. Swap the "call" implementation for a real
 * Anthropic/OpenAI SDK call once AI_API_KEY is configured.
 */

export interface AiCallParams {
  systemPrompt: string;
  userMessage: string;
  groundedContext: string; // JSON-stringified tool results already fetched
}

export interface AiCallResult {
  text: string;
  model: string;
  estimatedCostPaise: number;
}

const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5-20251001";

export async function callAi(params: AiCallParams): Promise<AiCallResult> {
  if (!AI_API_KEY) {
    // Mock mode: deterministic canned structure so the UI/UX and grounding
    // pipeline can be fully exercised without a live key.
    return {
      text:
        `### Short Answer\n(AI mock mode — set AI_API_KEY to enable real answers)\n\n` +
        `### Based On Your Profile\nMock response.\n\n` +
        `### Evidence\n${params.groundedContext || "No grounded data was retrieved for this question."}\n\n` +
        `### What I Recommend\nConfigure a real AI provider key to get live counseling answers.\n\n` +
        `### Important\nVerify the latest official counseling notification before making an irreversible decision.`,
      model: "mock",
      estimatedCostPaise: 0,
    };
  }

  // Real call would go here, e.g.:
  // const res = await fetch("https://api.anthropic.com/v1/messages", { ... });
  // Left unimplemented on purpose — wire up with your own AI_API_KEY.
  throw new Error(
    "AI_API_KEY is set but no live provider call is implemented yet. Fill in lib/ai/provider.ts."
  );
}

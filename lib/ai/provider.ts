/**
 * AI provider abstraction. In development / when AI_API_KEY is unset, this
 * falls back to a deterministic mock so the whole app is testable without
 * spending money on API calls. When AI_API_KEY is set, it calls Google's
 * Gemini API, which has a genuinely free tier (no credit card, no billing
 * setup) - get a key at https://aistudio.google.com/apikey.
 */
export interface AiCallParams {
  systemPrompt: string;
  userMessage: string;
  groundedContext: string;
}

export interface AiCallResult {
  text: string;
  model: string;
  estimatedCostPaise: number;
}

const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL ?? "gemini-3.6-flash";

function mockResponse(params: AiCallParams): AiCallResult {
  return {
    text:
      `(AI mock mode - set AI_API_KEY to enable real answers)\n\n` +
      `${params.groundedContext || "No grounded data was retrieved for this question."}\n\n` +
      `Configure a real AI provider key to get live counseling answers.\n\n` +
      `Verify the latest official counseling notification before making an irreversible decision.`,
    model: "mock",
    estimatedCostPaise: 0,
  };
}

function buildUserContent(params: AiCallParams): string {
  return params.groundedContext
    ? `${params.userMessage}\n\n---\nGrounded context retrieved from the database (use ONLY this for any factual claims - if it says DATA_UNAVAILABLE, say so plainly rather than guessing):\n${params.groundedContext}`
    : params.userMessage;
}

/**
 * Non-streaming call. Kept for callers that need the full text at once.
 */
export async function callAi(params: AiCallParams): Promise<AiCallResult> {
  if (!AI_API_KEY) {
    return mockResponse(params);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": AI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: buildUserContent(params) }] }],
        generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "low" } },
      }),
    });
  } catch (err) {
    console.error("AI provider network error:", err);
    return {
      text: "Sorry, I couldn't reach the AI service right now. Please try again in a moment.",
      model: AI_MODEL,
      estimatedCostPaise: 0,
    };
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("AI provider error:", res.status, errBody);
    if (res.status === 429) {
      return {
        text: "The AI counselor is getting a lot of questions right now (free-tier rate limit reached). Please try again in a minute.",
        model: AI_MODEL,
        estimatedCostPaise: 0,
      };
    }
    return {
      text: "Sorry, the AI service returned an error. Please try again, or verify the latest official counseling notification directly.",
      model: AI_MODEL,
      estimatedCostPaise: 0,
    };
  }

  const data = await res.json();
  const text: string =
    data.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? "")
      .join("\n")
      .trim() || "Sorry, I couldn't generate a response.";

  return { text, model: AI_MODEL, estimatedCostPaise: 0 };
}

/**
 * Streaming call. Returns a ReadableStream of plain text chunks the caller
 * can pipe straight through to the client. Falls back to a single mock
 * chunk when no API key is configured.
 */
export function streamAi(params: AiCallParams): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  if (!AI_API_KEY) {
    const mock = mockResponse(params);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(mock.text));
        controller.close();
      },
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:streamGenerateContent?alt=sse`;

  return new ReadableStream({
    async start(controller) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": AI_API_KEY as string },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: params.systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: buildUserContent(params) }] }],
            generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "low" } },
          }),
        });
      } catch (err) {
        console.error("AI provider streaming network error:", err);
        controller.enqueue(
          encoder.encode("Sorry, I couldn't reach the AI service right now. Please try again in a moment.")
        );
        controller.close();
        return;
      }

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        console.error("AI provider streaming error:", res.status, errBody);
        const message =
          res.status === 429
            ? "The AI counselor is getting a lot of questions right now (free-tier rate limit reached). Please try again in a minute."
            : "Sorry, the AI service returned an error. Please try again, or verify the latest official counseling notification directly.";
        controller.enqueue(encoder.encode(message));
        controller.close();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const chunkText: string =
                parsed.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
              if (chunkText) controller.enqueue(encoder.encode(chunkText));
            } catch {
              // Skip malformed SSE chunks rather than failing the whole stream.
            }
          }
        }
      } catch (err) {
        console.error("AI provider stream read error:", err);
      } finally {
        controller.close();
      }
    },
  });
}
/**
 * Wraps a text stream so that, once the last chunk has been sent to the client,
 * `onComplete(fullText)` is awaited BEFORE the stream is closed.
 *
 * Why: on serverless hosts (Vercel) the function can be frozen as soon as the
 * response finishes, so a "fire and forget" database write after the response
 * may never run. Holding the stream open until the write finishes keeps the
 * function alive. The student already has all the text by then, so they do not
 * notice the extra few milliseconds.
 */
export function withCompletionHook(
  source: ReadableStream<Uint8Array>,
  onComplete: (fullText: string) => Promise<void>
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let full = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          controller.enqueue(value);
        }
        full += decoder.decode();
      } catch (err) {
        console.error("Stream read error:", err);
      }

      try {
        await onComplete(full);
      } catch (err) {
        console.error("Completion hook failed:", err);
      }
      controller.close();
    },
  });
}

import { describe, it, expect } from "vitest";
import { withCompletionHook } from "./log-stream";

function streamOf(chunks: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((x) => c.enqueue(enc.encode(x)));
      c.close();
    },
  });
}

async function readAll(s: ReadableStream<Uint8Array>) {
  const dec = new TextDecoder();
  const r = s.getReader();
  let out = "";
  while (true) {
    const { done, value } = await r.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

describe("withCompletionHook", () => {
  it("passes every chunk through and hands the full text to the hook", async () => {
    let logged = "";
    const out = await readAll(
      withCompletionHook(streamOf(["Hel", "lo ", "world"]), async (t) => {
        logged = t;
      })
    );
    expect(out).toBe("Hello world");
    expect(logged).toBe("Hello world");
  });

  it("finishes the hook BEFORE the stream closes", async () => {
    let hookDone = false;
    const s = withCompletionHook(streamOf(["x"]), async () => {
      await new Promise((r) => setTimeout(r, 30));
      hookDone = true;
    });
    await readAll(s);
    expect(hookDone).toBe(true);
  });

  it("still closes the stream if the hook throws", async () => {
    const out = await readAll(
      withCompletionHook(streamOf(["ok"]), async () => {
        throw new Error("db down");
      })
    );
    expect(out).toBe("ok");
  });
});

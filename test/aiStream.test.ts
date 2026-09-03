import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamClaude, TRUNCATED_REPLY_NOTICE, type ClaudeStreamEvent } from "@/lib/ai";

/**
 * Streaming changes one thing that is easy to get wrong: a failure can arrive
 * after the response has already started. By then the status code is 200 and
 * unchangeable, so every failure has to reach the member as an event inside the
 * stream, or not at all.
 *
 * These pin that, plus the two things that quietly stop working if the SSE
 * parsing is wrong — text arriving split across chunk boundaries, and usage
 * totals that are sent in two separate frames.
 */

const KEY = "ANTHROPIC_API_KEY";

/** One SSE frame, as Anthropic sends them. */
function frame(payload: unknown): string {
  return `event: x\ndata: ${JSON.stringify(payload)}\n\n`;
}

const TEXT = (text: string) =>
  frame({ type: "content_block_delta", delta: { type: "text_delta", text } });

const START = frame({
  type: "message_start",
  message: {
    usage: { input_tokens: 30, cache_read_input_tokens: 2000, cache_creation_input_tokens: 5 },
  },
});

const END = frame({ type: "message_delta", usage: { output_tokens: 120 } });

/** The same closing frame, but reporting that the reply hit the token ceiling. */
const END_TRUNCATED = frame({
  type: "message_delta",
  delta: { stop_reason: "max_tokens" },
  usage: { output_tokens: 120 },
});

/** A body that emits the given strings as separate chunks. */
function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
    },
  });
}

function respondWith(chunks: string[], ok = true) {
  vi.stubGlobal("fetch", async () => ({
    ok,
    body: bodyOf(chunks),
    text: async () => "",
  }));
}

async function collect(): Promise<ClaudeStreamEvent[]> {
  const out: ClaudeStreamEvent[] = [];
  for await (const event of streamClaude("system", [{ role: "user", content: "hi" }], 100, "test")) {
    out.push(event);
  }
  return out;
}

const textOf = (events: ClaudeStreamEvent[]) =>
  events.filter((e) => e.type === "text").map((e) => (e as { value: string }).value).join("");

beforeEach(() => {
  vi.stubEnv(KEY, "test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("a normal stream", () => {
  it("yields text as it arrives, in order", async () => {
    respondWith([START, TEXT("Hello"), TEXT(" there"), END]);

    expect(textOf(await collect())).toBe("Hello there");
  });

  it("ends with exactly one terminal event", async () => {
    respondWith([START, TEXT("hi"), END]);

    const events = await collect();
    const terminal = events.filter((e) => e.type === "done" || e.type === "error");

    expect(terminal).toHaveLength(1);
    expect(events[events.length - 1].type).toBe("done");
  });

  /**
   * A chunk boundary can land anywhere, including inside a frame. Buffering
   * only up to the last complete separator is what makes that survivable —
   * without it the split frame is dropped and the member silently loses words.
   */
  it("survives a frame split across chunks", async () => {
    const whole = TEXT("split me");
    respondWith([START, whole.slice(0, 12), whole.slice(12), END]);

    expect(textOf(await collect())).toBe("split me");
  });

  it("skips an unparseable frame rather than losing the rest", async () => {
    respondWith([START, "event: x\ndata: {not json\n\n", TEXT("after"), END]);

    const events = await collect();
    expect(textOf(events)).toBe("after");
    expect(events[events.length - 1].type).toBe("done");
  });
});

describe("usage", () => {
  /**
   * Input and cache counts arrive in message_start, output only in the final
   * message_delta. Overwriting instead of merging would drop one half — and the
   * half it drops is whichever frame came first, which is not obvious from
   * reading either one.
   */
  it("keeps both halves of the token counts", async () => {
    respondWith([START, TEXT("hi"), END]);

    const done = (await collect()).at(-1) as { type: "done"; usage: Record<string, number> };

    expect(done.usage).toEqual({
      inputTokens: 30,
      outputTokens: 120,
      cacheReadTokens: 2000,
      cacheWriteTokens: 5,
    });
  });

  /**
   * The merge has to hold in both directions. A later frame carrying an empty
   * or partial usage block must not erase what an earlier one reported — and
   * "take the newest" looks correct right up until that frame arrives.
   */
  it("is not erased by a later frame that carries no usage", async () => {
    respondWith([START, TEXT("hi"), END, frame({ type: "message_delta", usage: {} })]);

    const done = (await collect()).at(-1) as { type: "done"; usage: Record<string, number> };

    expect(done.usage).toEqual({
      inputTokens: 30,
      outputTokens: 120,
      cacheReadTokens: 2000,
      cacheWriteTokens: 5,
    });
  });

  it("reports zeros rather than throwing when usage never arrives", async () => {
    respondWith([TEXT("hi")]);

    const done = (await collect()).at(-1) as { type: "done"; usage: Record<string, number> };

    expect(done.type).toBe("done");
    expect(done.usage.outputTokens).toBe(0);
  });
});

describe("failures", () => {
  it("reports a refused request as an error event, not an exception", async () => {
    respondWith([], false);

    const events = await collect();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
  });

  it("reports an unreachable API as an error event", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });

    const events = await collect();
    expect(events[0].type).toBe("error");
  });

  /**
   * The case streaming introduces and nothing else has: the response was a 200,
   * words were already sent, and then it broke. The status code cannot say so.
   */
  it("keeps the text it already sent when the stream errors part-way", async () => {
    respondWith([START, TEXT("half an ans"), frame({ type: "error", error: { message: "overloaded" } })]);

    const events = await collect();

    expect(textOf(events)).toBe("half an ans");
    expect(events[events.length - 1].type).toBe("error");
  });

  it("errors rather than yielding nothing when the key is missing", async () => {
    vi.stubEnv(KEY, "");
    respondWith([START, TEXT("hi"), END]);

    const events = await collect();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
  });
});

/**
 * A reply that hits max_tokens is the failure that does not look like one. The
 * stream completes, the status is 200, the usage totals are ordinary — and the
 * text stops mid-word. On screen that reads as the assistant having nothing
 * further to say, which is why it went a week on the live site being described
 * as "the coach gives nothing useful" rather than as a bug.
 */
describe("a reply that ran out of room", () => {
  it("says so, after the text and before the terminal event", async () => {
    respondWith([START, TEXT("You already have a Milwauk"), END_TRUNCATED]);

    const events = await collect();
    const notice = events.find((e) => e.type === "error");

    expect(textOf(events)).toBe("You already have a Milwauk");
    expect(notice).toEqual({ type: "error", message: TRUNCATED_REPLY_NOTICE });
    expect(events[events.length - 1].type).toBe("done");
  });

  it("still files the spend, because the call happened and cost money", async () => {
    respondWith([START, TEXT("cut off"), END_TRUNCATED]);

    const done = (await collect()).at(-1);

    expect(done).toMatchObject({ type: "done", usage: { outputTokens: 120, inputTokens: 30 } });
  });

  it("says nothing when the reply ended on its own", async () => {
    // The guard that matters. A notice on every complete answer would be worse
    // than no notice at all — members learn to ignore a warning that is always
    // there, and the one that means something goes with it.
    respondWith([START, TEXT("A complete answer."), END]);

    const events = await collect();

    expect(events.filter((e) => e.type === "error")).toEqual([]);
  });

  it("says nothing for a stop reason that is not the ceiling", async () => {
    respondWith([
      START,
      TEXT("Done properly."),
      frame({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 9 } }),
    ]);

    expect((await collect()).filter((e) => e.type === "error")).toEqual([]);
  });
});

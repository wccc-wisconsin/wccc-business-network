import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callClaude, parseClaudeJson } from "@/lib/ai";

/**
 * Reading a non-streamed reply, and the two ways that used to go wrong at once.
 *
 * Three of the seven AI surfaces parse their reply as JSON. When that parse
 * failed, every cause collapsed into one message — "couldn't generate matches
 * in the right format" — which sent whoever investigated it to look at the
 * schema. The two causes that actually happen are neither of them a schema
 * problem:
 *
 *   1. The reply ran out of room. A JSON array cut off mid-string does not
 *      parse, and retrying produces the same truncation. That is a budget to
 *      raise, not a format to fix, and only the model's stop reason can tell
 *      you — the wreckage looks identical either way.
 *   2. The model wrote a sentence before the JSON. Recoverable, and previously
 *      thrown away wholesale.
 *
 * This went live on 2026-08-30 and took the funding matcher down: max_tokens
 * had been sized for a much shorter answer, the replies started truncating,
 * and the panel reported a formatting error.
 */

const KEY = "ANTHROPIC_API_KEY";

/** A non-streaming Anthropic response. */
function reply(text: string, stopReason = "end_turn") {
  return {
    ok: true,
    json: async () => ({
      content: [{ type: "text", text }],
      stop_reason: stopReason,
      usage: { input_tokens: 100, output_tokens: 42 },
    }),
  };
}

beforeEach(() => {
  vi.stubEnv(KEY, "sk-test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("a reply that ran out of room", () => {
  it("is reported as truncated rather than as a normal reply", async () => {
    vi.stubGlobal("fetch", async () => reply('[{"ref":"W1","whyItFits":"It f', "max_tokens"));

    const result = await callClaude("system", [{ role: "user", content: "hi" }], 700, "test");

    expect(result.ok).toBe(true);
    // The text is still handed back — a prose route would rather show a cut-off
    // answer than nothing. The flag is what lets a JSON route decide otherwise.
    expect(result.ok && result.truncated).toBe(true);
    expect(result.ok && result.text).toContain("W1");
  });

  it("is not confused with a reply that simply finished", async () => {
    vi.stubGlobal("fetch", async () => reply('[{"ref":"W1"}]'));

    const result = await callClaude("system", [{ role: "user", content: "hi" }], 700, "test");

    expect(result.ok && result.truncated).toBe(false);
  });
});

describe("parsing a reply that was asked for JSON", () => {
  it("reads plain JSON", () => {
    expect(parseClaudeJson('[{"ref":"W1"}]')).toEqual([{ ref: "W1" }]);
  });

  it("reads JSON wrapped in a code fence", () => {
    expect(parseClaudeJson('```json\n[{"ref":"W1"}]\n```')).toEqual([{ ref: "W1" }]);
  });

  it("recovers JSON the model prefaced with a sentence", () => {
    // Previously thrown away whole, and reported to the member as a formatting
    // failure it could do nothing about.
    const text = 'Here are the matches:\n\n[{"ref":"W1","whyItFits":"Fits."}]';

    expect(parseClaudeJson(text)).toEqual([{ ref: "W1", whyItFits: "Fits." }]);
  });

  it("recovers JSON with prose after it too", () => {
    expect(parseClaudeJson('[{"ref":"W1"}]\n\nLet me know if you want more.')).toEqual([
      { ref: "W1" },
    ]);
  });

  it("stops at the end of the JSON, not at the last bracket in the reply", () => {
    // The case that separates a balanced scan from a greedy regex, and the one
    // a first pass at this test missed. `/[[{][\s\S]*[\]}]/` runs to the final
    // bracket anywhere in the text — here that is the one in the trailing
    // sentence — and swallows the prose between, producing nothing parseable.
    const text = '[{"ref":"W1"}]\n\nLet me know [if you want more] detail.';

    expect(parseClaudeJson(text)).toEqual([{ ref: "W1" }]);
  });

  it("is not fooled by a bracket inside a quoted value", () => {
    // A regex for the outermost brackets stops at the first "]" it sees, which
    // here sits inside a string — and returns a truncated object that parses,
    // which is worse than returning nothing.
    const text = '[{"ref":"W1","whyItFits":"Read WEDC\'s guide [section 2] first."}]';

    expect(parseClaudeJson<{ whyItFits: string }[]>(text)![0].whyItFits).toBe(
      "Read WEDC's guide [section 2] first.",
    );
  });

  it("handles an escaped quote inside a value", () => {
    const text = '[{"ref":"W1","whyItFits":"They said \\"no lender yet\\"."}]';

    expect(parseClaudeJson<{ whyItFits: string }[]>(text)![0].whyItFits).toBe(
      'They said "no lender yet".',
    );
  });

  it("refuses to half-parse a truncated array", () => {
    // The important one. Half an array is not a shorter answer, it is a wrong
    // one — three matches presented as though they were all of them. Truncation
    // must stay unparseable so it is reported as truncation.
    const text = '[{"ref":"W1","whyItFits":"Fits."},{"ref":"W2","whyItFits":"It f';

    expect(parseClaudeJson(text)).toBeNull();
  });

  it("returns null for a reply with no JSON in it at all", () => {
    expect(parseClaudeJson("I could not find any suitable matches.")).toBeNull();
  });

  it("reads an object as readily as an array", () => {
    // review-step and the Grill's brief both return objects.
    expect(parseClaudeJson('Sure:\n{"strongestPoint":"Clear pricing."}')).toEqual({
      strongestPoint: "Clear pricing.",
    });
  });
});

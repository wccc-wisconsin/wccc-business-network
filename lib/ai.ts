import "server-only";

// Thin wrapper around the Anthropic Messages API used by the AI Business
// Builder (review-step feedback, the AI Coach chat, and module summaries).
// Called directly via fetch rather than the SDK to keep this to one small
// file with no extra dependency. Requires ANTHROPIC_API_KEY to be set in
// the deployment's environment variables (Vercel: Settings -> Environment
// Variables) — that key must be added by a project admin, never entered by
// this app or committed to the repo.
import type { AiSpend } from "@/lib/appStore";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Overridable from the environment so the model can be changed in the Vercel
// dashboard without a code change and redeploy — useful if a key turns out not
// to have access to the default, which surfaces as an API error rather than
// anything obvious in the UI.
/**
 * The model every call in this file uses.
 *
 * Exported so lib/appStore.ts can stamp it onto a rating — a score that fell
 * cannot otherwise be told apart from a prompt that got worse and a model that
 * changed underneath it. Read at call time rather than captured, so a change to
 * the env var takes effect on the next request either way.
 */
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ClaudeResult =
  | { ok: true; text: string; usage: AiSpend }
  | { ok: false; error: string };

/**
 * How a caller describes its system prompt.
 *
 * A plain string behaves exactly as it always has: sent as-is, nothing cached.
 * That's the right choice for one-shot calls (document generation, the module
 * summary, the opportunity list), where nothing is sent twice inside the cache
 * window and marking it for caching would only add the 1.25x write surcharge.
 *
 * The object form is for the repeated calls — the Coach chat and the Decision
 * Grill, which re-send the same member context on every turn of a conversation.
 * `stable` is the part that is byte-identical across those turns and is marked
 * for caching; `volatile` is the tail that changes per turn (the Grill's
 * remaining-question count) and must sit after the cache breakpoint, because a
 * cache entry is matched on an exact prefix — a counter embedded in the middle
 * of the prompt would invalidate it every single turn.
 *
 * The two forms produce the same text for the model. Only billing and latency
 * differ.
 */
export type SystemPrompt = string | { stable: string; volatile?: string };

/**
 * Anthropic will not cache a prefix shorter than this, and returns no error
 * when it declines — it just silently doesn't cache. Documented per model
 * (1,024 for Sonnet); kept here as a named constant so the logging below can
 * explain a miss rather than leaving it looking like a bug.
 */
const MIN_CACHEABLE_TOKENS = 1024;

type SystemBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

/**
 * Builds the `system` field for the request.
 *
 * Returns a bare string for the string form so those requests go out byte-for-
 * byte as they did before this change — no behavioural risk on the routes that
 * don't opt in.
 */
function buildSystem(prompt: SystemPrompt): string | SystemBlock[] {
  if (typeof prompt === "string") return prompt;

  const blocks: SystemBlock[] = [
    { type: "text", text: prompt.stable, cache_control: { type: "ephemeral" } },
  ];
  // An empty or whitespace-only tail is dropped rather than sent: the API
  // rejects empty text blocks, and a caller computing the tail conditionally
  // shouldn't have to guard for it.
  if (prompt.volatile && prompt.volatile.trim() !== "") {
    blocks.push({ type: "text", text: prompt.volatile });
  }
  return blocks;
}

export async function callClaude(
  systemPrompt: SystemPrompt,
  messages: ChatMessage[],
  maxTokens = 700,
  /**
   * Route name, used only to label the usage log line. Optional so existing
   * callers keep working unchanged.
   */
  label = "unlabelled",
): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "AI features aren't configured yet — an admin needs to add ANTHROPIC_API_KEY in Vercel.",
    };
  }
  if (messages.length === 0) {
    return { ok: false, error: "Nothing to send to the AI." };
  }

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: buildSystem(systemPrompt),
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("callClaude: Anthropic API error", res.status, body);
      return { ok: false, error: "The AI assistant is temporarily unavailable. Please try again shortly." };
    }

    const data = await res.json();

    const usage = readSpend(data?.usage);
    logUsage(label, typeof systemPrompt !== "string", usage);

    // `content` is an array of blocks, and a text block is not guaranteed to
    // be at index 0 — the model can emit other block types ahead of it. This
    // used to read data.content[0].text, so any response that didn't lead with
    // text reported "didn't return a response" even though the reply was
    // present in a later block. Collect every text block instead of guessing
    // at a position.
    const blocks: unknown[] = Array.isArray(data?.content) ? data.content : [];
    const text = blocks
      .filter(
        (b): b is { type: "text"; text: string } =>
          !!b &&
          typeof b === "object" &&
          (b as { type?: unknown }).type === "text" &&
          typeof (b as { text?: unknown }).text === "string",
      )
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      // Log the shape, not just the payload — stop_reason and the block types
      // are what actually identify the cause when this shows up in Vercel logs.
      console.error("callClaude: no text block in response", {
        stopReason: data?.stop_reason,
        blockTypes: blocks.map((b) => (b as { type?: string })?.type),
        usage: data?.usage,
        data,
      });

      // A reply cut off at the token cap is a different problem from an empty
      // one, and the member can act on it (retry, or shorten their input), so
      // don't collapse both into the same message.
      if (data?.stop_reason === "max_tokens") {
        return {
          ok: false,
          error: "The AI assistant ran out of room before it finished. Please try again.",
        };
      }
      return { ok: false, error: "The AI assistant didn't return a response. Please try again." };
    }

    return { ok: true, text, usage };
  } catch (error) {
    console.error("callClaude: request failed", error);
    return { ok: false, error: "Couldn't reach the AI assistant. Please try again shortly." };
  }
}


/**
 * One piece of a streamed reply.
 *
 * `error` can arrive at any point, including after text has already been sent —
 * which is the whole reason this is a typed event stream rather than raw text.
 * A non-streaming route answers a failure with a 502 and a message; a streamed
 * one has already sent a 200 and some words by the time it finds out. The
 * member has to be told inside the stream or not at all.
 */
export type ClaudeStreamEvent =
  | { type: "text"; value: string }
  | { type: "error"; message: string }
  | { type: "done"; usage: AiSpend };

/** Anthropic's SSE frames, narrowed to the fields this cares about. */
type StreamFrame = {
  type?: unknown;
  delta?: { type?: unknown; text?: unknown };
  message?: { usage?: unknown };
  usage?: unknown;
  error?: { message?: unknown };
};

/**
 * Streams a reply, yielding text as it is written.
 *
 * Same prompt handling as callClaude — including the cache split — so a route
 * can switch between them without changing what the model receives. What
 * differs is only when the member sees the words.
 *
 * Always ends with exactly one terminal event, `done` or `error`, so a consumer
 * never has to guess whether a stream that stopped was finished or broken.
 *
 * Usage arrives in two halves: input and cache counts in `message_start`,
 * output in the final `message_delta`. Both are accumulated and reported on
 * `done`, so spend accounting works the same as it does for a whole-response
 * call.
 */
export async function* streamClaude(
  systemPrompt: SystemPrompt,
  messages: ChatMessage[],
  maxTokens = 700,
  label = "unlabelled",
): AsyncGenerator<ClaudeStreamEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    yield {
      type: "error",
      message: "AI features aren't configured yet — an admin needs to add ANTHROPIC_API_KEY in Vercel.",
    };
    return;
  }
  if (messages.length === 0) {
    yield { type: "error", message: "Nothing to send to the AI." };
    return;
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: buildSystem(systemPrompt),
        messages,
        stream: true,
      }),
    });
  } catch (error) {
    console.error("streamClaude: request failed", error);
    yield { type: "error", message: "Couldn't reach the AI assistant. Please try again shortly." };
    return;
  }

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    console.error("streamClaude: Anthropic API error", response.status, body);
    yield {
      type: "error",
      message: "The AI assistant is temporarily unavailable. Please try again shortly.",
    };
    return;
  }

  const usage: AiSpend = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  let sawText = false;

  try {
    for await (const frame of readSseFrames(response.body)) {
      if (frame.type === "content_block_delta") {
        const delta = frame.delta;
        if (delta?.type === "text_delta" && typeof delta.text === "string" && delta.text !== "") {
          sawText = true;
          yield { type: "text", value: delta.text };
        }
        continue;
      }

      // Input and cache counts are only ever sent here; output only in the
      // final message_delta. Merging rather than overwriting is what keeps
      // both halves.
      if (frame.type === "message_start") {
        Object.assign(usage, mergeSpend(usage, readSpend(frame.message?.usage)));
        continue;
      }
      if (frame.type === "message_delta") {
        Object.assign(usage, mergeSpend(usage, readSpend(frame.usage)));
        continue;
      }
      if (frame.type === "error") {
        const detail = frame.error?.message;
        console.error("streamClaude: stream error frame", detail);
        yield {
          type: "error",
          message: "The AI assistant stopped part-way through. Please try again.",
        };
        return;
      }
    }
  } catch (error) {
    // A connection dropped mid-stream. Whatever was already yielded is real
    // and stays on screen; the member is told the rest is missing rather than
    // being left with a sentence that stops.
    console.error("streamClaude: stream broke", error);
    yield {
      type: "error",
      message: sawText
        ? "The connection dropped part-way through that answer. Please try again."
        : "Couldn't reach the AI assistant. Please try again shortly.",
    };
    return;
  }

  logUsage(label, typeof systemPrompt !== "string", usage);
  yield { type: "done", usage };
}

/**
 * Keeps the larger of each count.
 *
 * `message_start` carries input and cache tokens with output at zero;
 * `message_delta` carries the final output with the rest absent. Taking the
 * maximum merges them without needing to know which frame carries what — and
 * is stable if a future API version sends a field in both.
 */
function mergeSpend(a: AiSpend, b: AiSpend): AiSpend {
  return {
    inputTokens: Math.max(a.inputTokens, b.inputTokens),
    outputTokens: Math.max(a.outputTokens, b.outputTokens),
    cacheReadTokens: Math.max(a.cacheReadTokens, b.cacheReadTokens),
    cacheWriteTokens: Math.max(a.cacheWriteTokens, b.cacheWriteTokens),
  };
}

/**
 * Parses an SSE body into frames.
 *
 * Only the `data:` lines matter — the `event:` line repeats the `type` already
 * inside the JSON. Frames are separated by a blank line, and a chunk boundary
 * can fall anywhere, including mid-line, so the buffer is only consumed up to
 * the last complete separator.
 *
 * Unparseable data is skipped rather than thrown on. A single malformed frame
 * should cost the member that fragment, not the rest of their answer.
 */
async function* readSseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamFrame> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);

        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            yield JSON.parse(payload) as StreamFrame;
          } catch {
            // Skip the fragment, keep the stream.
          }
        }

        separator = buffer.indexOf("\n\n");
      }
    }
  } finally {
    // Releasing matters on an early return — an abandoned reader keeps the
    // connection open for the rest of the function invocation.
    reader.releaseLock();
  }
}

/**
 * Reads the API's usage block into the four numbers that are billed separately.
 *
 * Every field is coerced through `num`, because a usage block that is missing,
 * partial, or shaped differently than expected must degrade to zeros rather
 * than throw. Nothing here is worth failing a member's answered request over —
 * and a row of zeros is visibly wrong in a way that a crashed request is not.
 */
function readSpend(usage: unknown): AiSpend {
  const u = (usage ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  return {
    inputTokens: num(u.input_tokens),
    outputTokens: num(u.output_tokens),
    cacheReadTokens: num(u.cache_read_input_tokens),
    cacheWriteTokens: num(u.cache_creation_input_tokens),
  };
}

/**
 * One line per call in the Vercel function logs, recording what the request
 * actually cost.
 *
 * This exists because the caching above is otherwise invisible: Anthropic
 * declines to cache a prefix under MIN_CACHEABLE_TOKENS and returns no error
 * when it does, so without this there is no way to tell a working cache from a
 * silently skipped one. `cacheRead` climbing on the second and later turns of a
 * conversation is the signal that it works.
 *
 * Deliberately console-only for now — no database write, so this adds no
 * latency to the request and no schema change. If per-member spend reporting
 * is wanted later, these are the numbers to persist.
 *
 * Wrapped in try/catch because a logging failure must never turn a successful
 * AI response into an error for the member.
 */
function logUsage(label: string, cacheRequested: boolean, usage: AiSpend): void {
  try {
    const { cacheWriteTokens: cacheWrite, cacheReadTokens: cacheRead } = usage;

    console.log("callClaude usage", {
      route: label,
      model: MODEL,
      inputTokens: usage.inputTokens + cacheWrite + cacheRead,
      outputTokens: usage.outputTokens,
      cacheWrite,
      cacheRead,
      // Distinguishes "we didn't ask for caching" from "we asked and the
      // prompt was too short to qualify" — the second is the one worth acting
      // on, and it looks identical in the numbers alone.
      cacheStatus: !cacheRequested
        ? "not-requested"
        : cacheRead > 0
          ? "hit"
          : cacheWrite > 0
            ? "written"
            : `skipped (prefix under ${MIN_CACHEABLE_TOKENS} tokens)`,
    });
  } catch {
    // Ignore — logging is never worth failing a request over.
  }
}

/**
 * Best-effort parse of a Claude response that was asked to return strict
 * JSON. Strips ```json fences if the model added them anyway, and falls
 * back to null (caller shows the raw text instead) rather than throwing.
 */
export function parseClaudeJson<T>(text: string): T | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

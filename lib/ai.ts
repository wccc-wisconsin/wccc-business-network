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
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

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

import "server-only";

// Thin wrapper around the Anthropic Messages API used by the AI Business
// Builder (review-step feedback, the AI Coach chat, and module summaries).
// Called directly via fetch rather than the SDK to keep this to one small
// file with no extra dependency. Requires ANTHROPIC_API_KEY to be set in
// the deployment's environment variables (Vercel: Settings -> Environment
// Variables) — that key must be added by a project admin, never entered by
// this app or committed to the repo.
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Overridable from the environment so the model can be changed in the Vercel
// dashboard without a code change and redeploy — useful if a key turns out not
// to have access to the default, which surfaces as an API error rather than
// anything obvious in the UI.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ClaudeResult = { ok: true; text: string } | { ok: false; error: string };

export async function callClaude(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 700,
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
        system: systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("callClaude: Anthropic API error", res.status, body);
      return { ok: false, error: "The AI assistant is temporarily unavailable. Please try again shortly." };
    }

    const data = await res.json();

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

    return { ok: true, text };
  } catch (error) {
    console.error("callClaude: request failed", error);
    return { ok: false, error: "Couldn't reach the AI assistant. Please try again shortly." };
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

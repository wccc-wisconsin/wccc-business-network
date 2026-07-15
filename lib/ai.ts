import "server-only";

// Thin wrapper around the Anthropic Messages API used by the AI Business
// Builder (review-step feedback, the AI Coach chat, and module summaries).
// Called directly via fetch rather than the SDK to keep this to one small
// file with no extra dependency. Requires ANTHROPIC_API_KEY to be set in
// the deployment's environment variables (Vercel: Settings -> Environment
// Variables) — that key must be added by a project admin, never entered by
// this app or committed to the repo.
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

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
    const text = data?.content?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      console.error("callClaude: empty response", data);
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

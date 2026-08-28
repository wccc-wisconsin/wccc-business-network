"use client";

import { useState, useTransition } from "react";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  /**
   * The module the member is currently viewing, when there is one. Omitted on
   * the dashboard, where the coach answers across their whole business rather
   * than one stage — the API route treats it as optional and builds the
   * member's full context either way.
   */
  moduleKey?: string;
  moduleLabel?: string;
};

// Freeform AI Coach chat. Conversation lives only in this component's state —
// not persisted across visits (the route injects the member's context fresh
// into the system prompt on every request, so nothing is lost by not saving
// history).
/**
 * Reads the NDJSON event stream, appending text to the reply as it arrives.
 *
 * The assistant message is created on the first `text` event and grown in place
 * after that, so nothing appears until there is something to show and the reply
 * is never briefly blank.
 *
 * An `error` can arrive after text has already rendered — the response was a
 * 200 long before the failure happened. Whatever arrived stays on screen and
 * the error is shown beneath it: a half-answer a member can read beats an empty
 * box, as long as they are told it is a half-answer.
 */
async function consumeStream(
  body: ReadableStream<Uint8Array>,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setError: (message: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;

  const handle = (line: string) => {
    if (!line.trim()) return;
    let event: { type?: string; value?: string; message?: string };
    try {
      event = JSON.parse(line);
    } catch {
      // A truncated trailing line. Nothing to show, nothing worth failing over.
      return;
    }

    if (event.type === "text" && typeof event.value === "string") {
      const text = event.value;
      if (!started) {
        started = true;
        setMessages((m) => [...m, { role: "assistant", content: text }]);
        return;
      }
      setMessages((m) => {
        const last = m[m.length - 1];
        if (!last || last.role !== "assistant") return m;
        return [...m.slice(0, -1), { role: "assistant", content: last.content + text }];
      });
      return;
    }

    if (event.type === "error") {
      setError(event.message || "Something went wrong.");
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        handle(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    handle(buffer);
  } finally {
    reader.releaseLock();
  }
}

export default function AICoach({ moduleKey, moduleLabel }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    const text = input.trim();
    if (!text) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/coach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ moduleKey, messages: next }),
        });
        // A rejection before the stream opens — not signed in, over the daily
        // cap — is still an ordinary JSON error response.
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Something went wrong.");
          return;
        }

        await consumeStream(res.body, setMessages, setError);
      } catch {
        setError("Couldn't reach the AI assistant. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-[8px] border border-white/10 bg-[#132f52] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">AI Coach</p>
      <h2 className="mt-1 font-serif text-xl font-bold text-white">
        {moduleLabel ? `Ask about ${moduleLabel}` : "Ask your coach"}
      </h2>
      <p className="mt-1 text-sm text-white/50">
        {moduleLabel
          ? "Freeform questions — the coach knows your business and where you are in this module."
          : "Freeform questions — the coach knows your business, your membership, and your progress across every module."}
      </p>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-white/40">No messages yet — ask a question below to get started.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-[8px] p-3 text-sm ${
              m.role === "user" ? "bg-white/10 text-white" : "bg-[#d7a84d]/10 text-white/85"
            }`}
          >
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
              {m.role === "user" ? "You" : "AI Coach"}
            </p>
            {m.content}
          </div>
        ))}
        {/* Only until the first words land — after that the reply itself is
            the progress indicator. */}
        {isPending && messages[messages.length - 1]?.role === "user" && (
          <p className="text-xs text-white/40">Thinking…</p>
        )}
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}

      <div className="mt-4 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={
            moduleLabel
              ? "Ask the AI Coach anything about this stage of your business…"
              : "Ask the AI Coach anything about your business…"
          }
          className="flex-1 rounded border border-white/15 bg-[#0f2d4a] px-3 py-2 text-sm text-white outline-none focus:border-[#d7a84d]/50"
        />
        <button
          type="button"
          onClick={send}
          disabled={isPending || !input.trim()}
          className="rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50 shrink-0 self-end"
        >
          Send
        </button>
      </div>
    </div>
  );
}

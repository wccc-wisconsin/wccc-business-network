"use client";

import { useState, useTransition } from "react";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  moduleKey: string;
  moduleLabel: string;
};

// Freeform AI Coach chat at the bottom of each module page. Conversation
// lives only in this component's state — not persisted across visits (the
// shared template only calls for the coach to be "aware of the member's
// industry/stage/progress", which the API route already injects fresh into
// the system prompt on every request, so nothing is lost by not saving history).
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
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Something went wrong.");
          return;
        }
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      } catch {
        setError("Couldn't reach the AI assistant. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-[8px] border border-white/10 bg-[#132f52] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">AI Coach</p>
      <h2 className="mt-1 font-serif text-xl font-bold text-white">Ask about {moduleLabel}</h2>
      <p className="mt-1 text-sm text-white/50">
        Freeform questions — the coach knows your industry, business, and progress in this module.
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
        {isPending && <p className="text-xs text-white/40">Thinking…</p>}
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
          placeholder="Ask the AI Coach anything about this stage of your business…"
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

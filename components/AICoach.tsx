"use client";

import { useState, useTransition } from "react";
import { saveExtractedFactsAction } from "@/app/actions";

type Message = { role: "user" | "assistant"; content: string };

/** A fact the coach thinks the member stated, waiting for them to confirm it. */
type Candidate = {
  key: string;
  value: string;
  quote: string;
  label: string;
  display: string;
};

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
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;
  // Accumulated alongside the React state so the caller can store the finished
  // reply without reading state it has not re-rendered with yet.
  let full = "";

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
      full += text;
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

  return full;
}

export default function AICoach({ moduleKey, moduleLabel }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The stored conversation this chat is. Null until the first save; after
  // that it is reused so each save replaces the same row rather than leaving a
  // trail of partial copies of one conversation.
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Facts proposed from this conversation, and the ones already dealt with.
  // Kept separate from `messages` because they are not part of the chat — they
  // are a question about it.
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);

  /**
   * Stores the conversation after each completed exchange.
   *
   * Deliberately not awaited by `send`: a failed save must not cost the member
   * the answer they are reading. The id is kept so the next save overwrites
   * this row.
   */
  function persist(all: Message[]) {
    fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moduleKey, conversationId, messages: all }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && typeof data.id === "string") setConversationId(data.id);
      })
      .catch(() => {
        // Silent on purpose. The member has their answer on screen; telling
        // them the transcript did not store would be alarming and unactionable.
      });
  }

  /**
   * "Save what we discussed" — asks what the conversation revealed.
   *
   * Nothing is written by this. It returns proposals, each carrying the
   * member's own words, and only a tap on a card saves one.
   */
  function proposeFacts() {
    setError(null);
    setCandidates(null);
    setSaving(true);

    fetch("/api/ai/extract-facts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok) {
          setError(data?.error || "Couldn't read that conversation just now.");
          return;
        }
        setCandidates(
          (data.candidates as Candidate[]).filter((c) => !savedKeys.includes(c.key)),
        );
      })
      .catch(() => setError("Couldn't reach the AI assistant. Please try again."))
      .finally(() => setSaving(false));
  }

  function confirmCandidate(candidate: Candidate) {
    setSavedKeys((keys) => [...keys, candidate.key]);
    setCandidates((list) => (list ?? []).filter((c) => c.key !== candidate.key));

    startTransition(async () => {
      const result = await saveExtractedFactsAction([
        { key: candidate.key, value: candidate.value },
      ]);
      if (!result.ok) {
        // Put it back rather than pretending it saved. A profile that claims a
        // value it does not hold is worse than a card the member has to tap
        // twice.
        setSavedKeys((keys) => keys.filter((key) => key !== candidate.key));
        setCandidates((list) => [...(list ?? []), candidate]);
        setError(result.error ?? "Couldn't save that to your profile.");
      }
    });
  }

  function dismissCandidate(key: string) {
    setCandidates((list) => (list ?? []).filter((c) => c.key !== key));
  }

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

        const reply = await consumeStream(res.body, setMessages, setError);
        if (reply) persist([...next, { role: "assistant", content: reply }]);
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

      {/* Confirmation cards.
          Each one shows the member's own words above the value being offered,
          so the proposal can be checked in a glance rather than trusted. That
          quote was verified against the transcript server-side — see
          lib/factExtraction.ts — so a card is never showing words the member
          did not type. */}
      {candidates !== null && candidates.length > 0 && (
        <div className="mt-4 space-y-2 rounded-[8px] border border-[#d7a84d]/25 bg-[#d7a84d]/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#d7a84d]">
            Save to your profile?
          </p>
          <p className="text-xs text-white/50">
            Nothing is saved unless you say so. Saved details help your coach and your compliance
            calendar without you repeating yourself.
          </p>
          {candidates.map((candidate) => (
            <div key={candidate.key} className="rounded border border-white/10 bg-[#0f2d4a] p-3">
              <p className="text-xs text-white/45">You said: &ldquo;{candidate.quote}&rdquo;</p>
              <p className="mt-1 text-sm text-white">
                <span className="text-white/60">{candidate.label}:</span> {candidate.display}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => confirmCandidate(candidate)}
                  className="rounded-full bg-[#d7a84d] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a]"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => dismissCandidate(candidate.key)}
                  className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white/60 transition hover:text-white"
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* An empty result is reported rather than left silent: a button that
          appears to do nothing reads as broken, and "nothing to save" is a
          perfectly normal outcome for a conversation that stayed general. */}
      {candidates !== null && candidates.length === 0 && (
        <p className="mt-3 text-xs text-white/40">
          Nothing in this conversation was specific enough to save to your profile.
        </p>
      )}

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

      {/* Offered only once there is a conversation to read, and pressed by the
          member rather than fired automatically. "The end of a chat" is not an
          event a browser gives us — people close the tab — and a background
          pass over words someone typed in confidence should be something they
          asked for. */}
      {messages.some((m) => m.role === "assistant") && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={proposeFacts}
            disabled={saving}
            className="rounded-full border border-[#d7a84d]/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#d7a84d] transition hover:bg-[#d7a84d]/10 disabled:opacity-50"
          >
            {saving ? "Reading…" : "Save what we discussed"}
          </button>
          <span className="text-[11px] text-white/35">
            Checks this chat for details worth keeping. You confirm each one.
          </span>
        </div>
      )}
    </div>
  );
}

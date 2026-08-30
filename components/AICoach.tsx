"use client";

import { useCallback, useId, useRef, useState, useTransition } from "react";
import { saveExtractedFactsAction } from "@/app/actions";
import type { ConversationSummary } from "@/lib/appStore";
import AnswerFeedback from "@/components/AnswerFeedback";

type Message = { role: "user" | "assistant"; content: string };

/** A fact the coach thinks the member stated, waiting for them to confirm it. */
type Candidate = {
  key: string;
  value: string;
  quote: string;
  label: string;
  display: string;
};

/**
 * A row in the history drawer: a stored conversation's summary, plus the module
 * label the API resolved for it. Never carries a transcript — that is fetched
 * only when a member actually reopens one, so listing twenty conversations puts
 * twenty opening lines on the wire rather than twenty chats.
 */
type HistoryEntry = ConversationSummary & { moduleLabel: string | null };

const whenFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

/**
 * "Aug 26" — the time of day is noise in a list you scan.
 *
 * Safe to format in the browser's own locale because the drawer is only ever
 * rendered after a click, never on the server, so there is no markup for it to
 * disagree with.
 */
function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : whenFormatter.format(date);
}

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

// Freeform AI Coach chat.
//
// The conversation on screen lives in this component's state and is also stored
// after each completed exchange, so a member can come back to it. The drawer
// under the header is the other half of that bargain: a portal that keeps
// transcripts a member can neither see nor remove would be the wrong trade,
// however useful those transcripts are to the coach.
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
  //
  // Held in a ref as well as in state, and written only through
  // `adoptConversation` so the two cannot drift apart. `persist` runs after an
  // await that lasts as long as a whole reply; reading the id out of the
  // closure it was created with would let a save that began before a delete
  // land after it, writing back the row the member just removed.
  const [conversationId, setConversationIdState] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Identifies replies for feedback before the conversation has an id of its
  // own. The first save lands a moment after the first reply finishes, so a
  // member who rates immediately would otherwise have nothing stable to key
  // against. Once `conversationId` arrives the real id takes over, and a
  // rating made under either key still upserts — the only cost is that a
  // rating given in the first second and one given later count as two
  // different answers, which is a rounding error against the alternative of
  // showing no buttons until a network round trip finishes.
  //
  // `useId` rather than a random value in a ref. Both were tried; the ref
  // broke two React rules at once — calling Math.random during render, and
  // reading `.current` during render — and useId is the API that exists for
  // exactly this: stable for the life of the component, unique per instance,
  // and safe to read while rendering.
  const feedbackNonce = useId();

  const adoptConversation = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setConversationIdState(id);
  }, []);

  // The save currently in flight, if any. Held so a delete can wait for it —
  // see removeConversation.
  const persistInFlight = useRef<Promise<void> | null>(null);

  // Past conversations. Loaded when the drawer opens rather than kept in step
  // as the member chats: a list that is only fetched at the moment it is shown
  // cannot be stale, and it is far the cheaper of the two.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  // Delete asks twice, in place. A window.confirm() would be shorter code and a
  // worse control: it freezes the page and reads as a browser error.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

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
    const request: Promise<void> = fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Read from the ref, not from state: this call is made from a closure
      // created before the reply streamed, and the id may have changed since.
      body: JSON.stringify({ moduleKey, conversationId: conversationIdRef.current, messages: all }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && typeof data.id === "string") adoptConversation(data.id);
      })
      .catch(() => {
        // Silent on purpose. The member has their answer on screen; telling
        // them the transcript did not store would be alarming and unactionable.
      })
      .finally(() => {
        // Only clear if this is still the newest save — a later one may have
        // started while this was finishing.
        if (persistInFlight.current === request) persistInFlight.current = null;
      });

    persistInFlight.current = request;
  }

  /**
   * Opens the drawer, loading the list each time rather than caching it.
   *
   * A member who has just been chatting expects to find that conversation in
   * here, and one who deleted something in another tab expects it gone. Both
   * come free from fetching on open; neither does from a cached list.
   */
  function toggleHistory() {
    setConfirmingDelete(null);

    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }

    setHistoryOpen(true);
    setHistoryError(null);
    setHistoryBusy(true);

    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok || !Array.isArray(data.conversations)) {
          setHistoryError(data?.error || "Couldn't load your past conversations.");
          return;
        }
        setHistory(data.conversations as HistoryEntry[]);
      })
      .catch(() => setHistoryError("Couldn't load your past conversations."))
      .finally(() => setHistoryBusy(false));
  }

  /**
   * Reopens a stored conversation in place of the one on screen.
   *
   * The transcript replaces the current messages rather than joining them: two
   * conversations spliced together would be saved back as one, and nothing
   * could separate them again. The fact candidates go for the same reason —
   * they were proposed from the conversation being replaced.
   */
  function resumeConversation(entry: HistoryEntry) {
    setHistoryError(null);
    setHistoryBusy(true);

    fetch(`/api/conversations?id=${encodeURIComponent(entry.id)}`)
      .then((res) => res.json())
      .then((data) => {
        const transcript = data?.conversation?.transcript;
        if (!data?.ok || !Array.isArray(transcript)) {
          setHistoryError(data?.error || "Couldn't open that conversation.");
          return;
        }
        setMessages(transcript as Message[]);
        adoptConversation(entry.id);
        setCandidates(null);
        setSavedKeys([]);
        setError(null);
        setHistoryOpen(false);
      })
      .catch(() => setHistoryError("Couldn't open that conversation."))
      .finally(() => setHistoryBusy(false));
  }

  /** Removes one stored conversation, for good. */
  function removeConversation(id: string) {
    setConfirmingDelete(null);
    setHistoryError(null);
    setHistoryBusy(true);

    // Any save still in flight is allowed to land first. A save that started
    // before this delete carries the same row id, and arriving after it would
    // write the conversation straight back — the member would delete something
    // and find it there again on the next open.
    const settled = persistInFlight.current ?? Promise.resolve();

    settled
      .then(() => fetch(`/api/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" }))
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok) {
          setHistoryError(data?.error || "Couldn't delete that conversation.");
          return;
        }
        setHistory((list) => (list ?? []).filter((entry) => entry.id !== id));
        // Detaching the id matters more than it looks: saveConversation upserts
        // on whatever id it is handed, so a chat still holding the id of a
        // deleted row would recreate that row on its very next message. Null
        // means the next save inserts a new conversation instead.
        if (conversationIdRef.current === id) adoptConversation(null);
      })
      .catch(() => setHistoryError("Couldn't delete that conversation."))
      .finally(() => setHistoryBusy(false));
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
          // The conversation id rides along so the coach's context can leave
          // this chat out of the history it is told about — see
          // conversationLines in lib/memberContext.ts.
          body: JSON.stringify({ moduleKey, conversationId: conversationIdRef.current, messages: next }),
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">AI Coach</p>
          <h2 className="mt-1 font-serif text-xl font-bold text-white">
            {moduleLabel ? `Ask about ${moduleLabel}` : "Ask your coach"}
          </h2>
          <p className="mt-1 text-sm text-white/50">
            {moduleLabel
              ? "Freeform questions — the coach knows your business and where you are in this module."
              : "Freeform questions — the coach knows your business, your membership, and your progress across every module."}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleHistory}
          aria-expanded={historyOpen}
          aria-controls="coach-history"
          className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/60 transition hover:border-[#d7a84d]/40 hover:text-white"
        >
          {historyOpen ? "Hide" : "Past chats"}
        </button>
      </div>

      {/* The history drawer.
          Everything the portal has stored of this member's chats, with a way
          to reopen or delete any of it. Mounted only while open so the list is
          fetched on demand and never rendered on the server — see formatWhen
          for why that also settles the date formatting. */}
      {historyOpen && (
        <div id="coach-history" className="mt-4 rounded-[8px] border border-white/10 bg-[#0f2d4a] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
            Your past conversations
          </p>
          <p className="mt-1 text-xs text-white/45">
            Saved as you chat, kept for a year, and visible only to you.
          </p>

          {historyError && (
            <p className="mt-2 text-xs font-semibold text-red-400">{historyError}</p>
          )}

          {history === null && historyBusy && (
            <p className="mt-3 text-xs text-white/40">Loading…</p>
          )}

          {history !== null && history.length === 0 && (
            <p className="mt-3 text-xs text-white/40">
              Nothing saved yet — a conversation appears here once the coach has answered.
            </p>
          )}

          {history !== null && history.length > 0 && (
            <ul className="mt-3 space-y-2">
              {history.map((entry) => {
                const isCurrent = entry.id === conversationId;
                const label = entry.opening || "Untitled conversation";
                const meta = [
                  entry.moduleLabel,
                  `${entry.messageCount} message${entry.messageCount === 1 ? "" : "s"}`,
                  formatWhen(entry.updatedAt),
                  isCurrent ? "open now" : null,
                ].filter(Boolean);

                return (
                  <li key={entry.id} className="rounded border border-white/10 bg-[#132f52] p-3">
                    <p className="text-sm text-white/85">{label}</p>
                    <p className="mt-1 text-[11px] text-white/40">{meta.join(" · ")}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {/* Reopening mid-reply would swap the transcript out from
                          under a stream that is still writing into it. */}
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => resumeConversation(entry)}
                          disabled={historyBusy || isPending}
                          aria-label={`Reopen conversation: ${label}`}
                          className="rounded-full bg-[#d7a84d] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}

                      {confirmingDelete === entry.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => removeConversation(entry.id)}
                            disabled={historyBusy}
                            className="rounded-full bg-red-500/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-red-500 disabled:opacity-50"
                          >
                            Delete for good
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(null)}
                            className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white/60 transition hover:text-white"
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(entry.id)}
                          disabled={historyBusy}
                          aria-label={`Delete conversation: ${label}`}
                          className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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
            {/* Not offered on a reply that is still being written — asking
                whether half an answer was useful is a question nobody can
                answer, and the buttons would move as the text grows. */}
            {m.role === "assistant" && !(isPending && i === messages.length - 1) && (
              <AnswerFeedback
                route="coach"
                targetKey={`coach:${conversationId ?? feedbackNonce}:${i}`}
              />
            )}
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

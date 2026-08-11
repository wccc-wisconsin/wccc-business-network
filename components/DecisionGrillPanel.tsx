"use client";

import { useState, useTransition } from "react";
import type { DecisionBrief, SavedDecision } from "@/lib/appStore";
import {
  MAX_ANSWER_LENGTH,
  MAX_GRILL_QUESTIONS,
  MAX_TOPIC_LENGTH,
  MIN_ANSWERS_BEFORE_BRIEF,
  SAVED_DECISIONS_LIMIT,
  decisionStarters,
} from "@/data/decisions";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  initialDecisions: SavedDecision[];
};

// "Decision Grill" — the member names a decision they're weighing, the AI
// interrogates it one question at a time, then writes them a decision brief
// that's saved to their dashboard.
//
// The transcript IS the request: messages[0] is the member's own statement of
// the decision and every later turn builds on it, so there's no separate topic
// field to keep in sync (see app/api/ai/grill/route.ts). Nothing is written to
// the database until the brief is generated — an abandoned half-grilling costs
// nothing and leaves nothing behind.
export default function DecisionGrillPanel({ initialDecisions }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [brief, setBrief] = useState<DecisionBrief | null>(null);
  const [history, setHistory] = useState<SavedDecision[]>(initialDecisions);
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which request is in flight, so the two spinners can't be inferred wrongly
  // from the transcript's shape (a failed brief also leaves it ending on an
  // unanswered turn).
  const [pendingPhase, setPendingPhase] = useState<"question" | "brief" | null>(null);
  const [isPending, startTransition] = useTransition();

  const isStarted = messages.length > 0;
  const questionsAsked = messages.filter((m) => m.role === "assistant").length;
  const answersGiven = Math.max(0, messages.filter((m) => m.role === "user").length - 1);
  const canFinish = answersGiven >= MIN_ANSWERS_BEFORE_BRIEF;
  const outOfQuestions = questionsAsked >= MAX_GRILL_QUESTIONS;
  const maxLength = isStarted ? MAX_ANSWER_LENGTH : MAX_TOPIC_LENGTH;

  function send(text: string) {
    const trimmed = text.trim().slice(0, maxLength);
    if (!trimmed || isPending || brief) return;

    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setError(null);

    // Showing the answer immediately keeps the thread readable, but if the
    // request fails it has to come back out — otherwise the transcript ends on
    // an unanswered turn and the next send would stack two answers in a row.
    function rollBack(message: string) {
      setMessages(messages);
      setInput(trimmed);
      setError(message);
    }

    setPendingPhase("question");
    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/grill", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phase: "question", messages: next }),
        });
        const data = await res.json();
        if (!data.ok) {
          rollBack(data.error || "Something went wrong.");
          return;
        }
        setMessages([...next, { role: "assistant", content: data.reply }]);
      } catch {
        rollBack("Couldn't reach the AI assistant. Please try again.");
      } finally {
        setPendingPhase(null);
      }
    });
  }

  /**
   * Generates the brief. Anything still sitting in the answer box is folded
   * into the transcript first — including the answer to the very last
   * question, which has no "Answer" button to send it (there's no question
   * left to ask, so sending it would only earn a rejection from the route).
   */
  function finish(pendingAnswer: string) {
    if (isPending || !canFinish || brief) return;
    setError(null);

    const trimmed = pendingAnswer.trim().slice(0, MAX_ANSWER_LENGTH);
    const final: Message[] = trimmed
      ? [...messages, { role: "user", content: trimmed }]
      : messages;
    setMessages(final);
    setInput("");

    setPendingPhase("brief");
    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/grill", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phase: "brief", messages: final }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Something went wrong.");
          return;
        }
        setBrief(data.decision.brief);
        setUnsaved(!data.saved);
        // Prepend rather than re-fetching the dashboard — the server already
        // handed back the saved row's id and timestamp.
        if (data.saved) {
          setHistory((h) => [data.decision, ...h].slice(0, SAVED_DECISIONS_LIMIT));
        }
      } catch {
        setError("Couldn't reach the AI assistant. Please try again.");
      } finally {
        setPendingPhase(null);
      }
    });
  }

  function reset() {
    setMessages([]);
    setInput("");
    setBrief(null);
    setUnsaved(false);
    setError(null);
  }

  return (
    <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">Decision Grill</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-white">
            Stuck on a decision? Get grilled on it.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Name a decision you&apos;re weighing. You&apos;ll get hard questions one at a time —
            not encouragement — then a written brief with the recommendation, the risks, and
            what to do next.
          </p>
        </div>
        {(isStarted || brief) && (
          <button
            type="button"
            onClick={reset}
            disabled={isPending}
            className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white/70 transition hover:border-white/40 hover:text-white disabled:opacity-50"
          >
            {brief ? "New decision" : "Start over"}
          </button>
        )}
      </div>

      {/* Opening state — a blank box is the main reason a tool like this goes
          unused, so offer concrete decisions to start from. */}
      {!isStarted && (
        <div className="mt-5 flex flex-wrap gap-2">
          {decisionStarters.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => send(starter)}
              disabled={isPending}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-[#d7a84d]/50 hover:text-white disabled:opacity-50"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {isStarted && (
        <div className="mt-5 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-[8px] p-3 text-sm leading-6 whitespace-pre-wrap ${
                m.role === "user" ? "bg-white/10 text-white" : "bg-[#d7a84d]/10 text-white/85"
              }`}
            >
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                {m.role === "user" ? (i === 0 ? "Your decision" : "You") : "The Grill"}
              </p>
              {m.content}
            </div>
          ))}
          {pendingPhase === "question" && <p className="text-xs text-white/40">Thinking…</p>}
        </div>
      )}

      {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}

      {/* The box stays open until a brief exists. Once the question budget is
          spent there's no "Answer" button — the last answer rides along with
          "Get my decision brief" below instead of being thrown away. */}
      {!brief && (
        <div className="mt-4 flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (outOfQuestions) finish(input);
                else send(input);
              }
            }}
            maxLength={maxLength}
            rows={2}
            placeholder={
              !isStarted
                ? "e.g. Should I hire my first employee, or keep using contractors?"
                : outOfQuestions
                  ? "Last answer — it'll go into your brief…"
                  : "Your answer — a sentence or two is plenty…"
            }
            className="flex-1 rounded border border-white/15 bg-[#0f2d4a] px-3 py-2 text-sm text-white outline-none focus:border-[#d7a84d]/50"
          />
          {!outOfQuestions && (
            <button
              type="button"
              onClick={() => send(input)}
              disabled={isPending || !input.trim()}
              className="shrink-0 self-end rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50"
            >
              {isStarted ? "Answer" : "Start"}
            </button>
          )}
        </div>
      )}

      {isStarted && !brief && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-xs text-white/45">
            {outOfQuestions
              ? "That's the full grilling — time for your brief."
              : canFinish
                ? `${answersGiven} answered · ${MAX_GRILL_QUESTIONS - questionsAsked} question${
                    MAX_GRILL_QUESTIONS - questionsAsked === 1 ? "" : "s"
                  } left. Keep going, or stop here.`
                : `${answersGiven} of ${MIN_ANSWERS_BEFORE_BRIEF} answers before a brief can be written.`}
          </p>
          <button
            type="button"
            onClick={() => finish(input)}
            disabled={isPending || !canFinish}
            className="shrink-0 rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-40"
            title={canFinish ? undefined : `Answer ${MIN_ANSWERS_BEFORE_BRIEF} questions first`}
          >
            {pendingPhase === "brief" ? "Writing…" : "Get my decision brief"}
          </button>
        </div>
      )}

      {brief && (
        <div className="mt-5">
          <BriefCard brief={brief} />
          {unsaved && (
            <p className="mt-3 text-xs text-white/45">
              Shown here for now — saving isn&apos;t switched on yet, so copy anything you want
              to keep before you leave this page.
            </p>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
            Past decisions
          </p>
          <div className="mt-3 space-y-2">
            {history.map((decision) => (
              <details
                key={decision.id}
                className="rounded-[8px] border border-white/10 bg-white/5 p-4"
              >
                <summary className="cursor-pointer text-sm font-semibold text-white">
                  {decision.topic}
                  <span className="ml-2 font-normal text-white/40">
                    {formatDate(decision.createdAt)}
                  </span>
                </summary>
                <div className="mt-4">
                  <BriefCard brief={decision.brief} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const confidenceStyles: Record<string, string> = {
  High: "bg-emerald-400/15 text-emerald-300",
  Medium: "bg-[#d7a84d]/20 text-[#d7a84d]",
  Low: "bg-orange-400/15 text-orange-300",
};

function BriefCard({ brief }: { brief: DecisionBrief }) {
  return (
    <article className="rounded-[8px] border border-[#d7a84d]/30 bg-[#0f2d4a] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-serif text-xl font-bold text-white">{brief.decision}</h3>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
            confidenceStyles[brief.confidence] ?? "bg-white/10 text-white/70"
          }`}
        >
          {brief.confidence} confidence
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-white/85">{brief.recommendation}</p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <BriefList title="What decides this" items={brief.keyFactors} />
        <BriefList title="Blind spots" items={brief.blindSpots} accent />
      </div>

      <div className="mt-5">
        <BriefHeading>Risks</BriefHeading>
        <ul className="mt-2 space-y-2">
          {brief.risks.map((item) => (
            <li key={item.risk} className="text-xs leading-5 text-white/65">
              <span className="font-semibold text-white/85">{item.risk}</span>
              <br />
              <span className="text-white/50">Reduce it by: </span>
              {item.mitigation}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <BriefHeading>Next steps</BriefHeading>
        <ol className="mt-2 space-y-2">
          {brief.nextSteps.map((item) => (
            <li key={item.step} className="text-xs leading-5 text-white/75">
              <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">
                {item.timeframe}
              </span>
              {item.step}
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-5 border-t border-white/10 pt-3 text-[11px] leading-5 text-white/35">
        A thinking aid, not professional advice. Confirm anything legal, tax, or financing
        related with a licensed professional before you act on it.
      </p>
    </article>
  );
}

function BriefHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7a84d]">{children}</p>
  );
}

function BriefList({
  title,
  items,
  accent = false,
}: {
  title: string;
  items: string[];
  accent?: boolean;
}) {
  return (
    <div>
      <BriefHeading>{title}</BriefHeading>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className={`text-xs leading-5 ${accent ? "text-white/80" : "text-white/65"}`}
          >
            <span className="mr-1.5 text-[#d7a84d]">{accent ? "!" : "·"}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

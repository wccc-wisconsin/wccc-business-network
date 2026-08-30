"use client";

import { useActionState, useState, useTransition } from "react";
import type { ModuleStep } from "@/data/modules";
import type { QuestionCarryOver } from "@/lib/carryOver";
import type { FormState } from "@/app/actions";
import { saveStepProgressAction } from "@/app/actions";
import AnswerFeedback from "@/components/AnswerFeedback";

type ReviewResult =
  | { kind: "structured"; strongestPoint: string; gap: string; wisconsinTip: string }
  | { kind: "raw"; text: string };

type Props = {
  moduleKey: string;
  step: ModuleStep;
  initialAnswers: Record<string, string>;
  initialCompleted: boolean;
  defaultOpen: boolean;
  /** Per-question prefill and context resolved from the member's facts. */
  carryOver: Record<string, QuestionCarryOver>;
};

function formatShortDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}

const initialFormState: FormState = { ok: false, error: null };

// One collapsible step in the guided-steps template: checkbox + guided
// question fields (saved together via saveStepProgressAction), plus a
// "Review my answers" button that calls /api/ai/review-step directly so
// feedback shows up inline without a full page action/redirect.
export default function StepCard({
  moduleKey,
  step,
  initialAnswers,
  initialCompleted,
  defaultOpen,
  carryOver,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // A carried-over value is seeded into the box, not just shown beside it, so
  // "Save" confirms it in one click instead of making the member retype what
  // the portal already knows. It is never silent: the provenance line below
  // the field says where it came from until the member edits it.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const q of step.questions) {
      base[q.key] = initialAnswers[q.key] ?? carryOver[q.key]?.prefill?.value ?? "";
    }
    return base;
  });

  // Questions still showing an untouched carried-over value. Editing one drops
  // it from the set, so the provenance line disappears the moment it stops
  // being true.
  const [carried, setCarried] = useState<Set<string>>(() => {
    const keys = step.questions
      .filter((q) => !initialAnswers[q.key] && carryOver[q.key]?.prefill)
      .map((q) => q.key);
    return new Set(keys);
  });

  const [completed, setCompleted] = useState(initialCompleted);
  const carriedCount = carried.size;
  const [state, formAction, isSaving] = useActionState(saveStepProgressAction, initialFormState);

  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isReviewing, startReview] = useTransition();

  function handleReview() {
    setReviewError(null);
    startReview(async () => {
      try {
        const res = await fetch("/api/ai/review-step", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ moduleKey, stepKey: step.key, answers: values }),
        });
        const data = await res.json();
        if (!data.ok) {
          setReviewError(data.error || "Something went wrong.");
          setReview(null);
          return;
        }
        setReview(data.review ? { kind: "structured", ...data.review } : { kind: "raw", text: data.raw });
      } catch {
        setReviewError("Couldn't reach the AI assistant. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-[8px] border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
              completed ? "border-emerald-400 bg-emerald-400/20 text-emerald-300" : "border-white/25 text-transparent"
            }`}
          >
            ✓
          </span>
          <span className="font-bold text-white">{step.title}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
              step.label === "essential" ? "bg-[#d7a84d]/20 text-[#d7a84d]" : "bg-white/10 text-white/50"
            }`}
          >
            {step.label}
          </span>
        </div>
        <span className="text-white/40">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-white/10 p-4">
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="moduleKey" value={moduleKey} />
            <input type="hidden" name="stepKey" value={step.key} />
            <input type="hidden" name="completed" value={completed ? "on" : ""} />

            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent"
              />
              Mark this step complete
            </label>

            {step.questions.map((q) => {
              const info = carryOver[q.key];
              const isCarried = carried.has(q.key);
              const prefill = info?.prefill;

              return (
                <div key={q.key}>
                  <label className="mb-1 block text-xs font-semibold text-white/60">{q.label}</label>

                  {info?.context.map((entry) => (
                    <p
                      key={entry.label}
                      className="mb-1 text-[11px] leading-5 text-white/45"
                    >
                      <span className="font-semibold text-white/60">{entry.label}:</span>{" "}
                      {entry.value}
                      {entry.stale && <span className="text-white/35"> · worth re-checking</span>}
                    </p>
                  ))}

                  <textarea
                    name={q.key}
                    value={values[q.key]}
                    onChange={(e) => {
                      const next = e.target.value;
                      setValues((v) => ({ ...v, [q.key]: next }));
                      if (isCarried) {
                        setCarried((set) => {
                          const copy = new Set(set);
                          copy.delete(q.key);
                          return copy;
                        });
                      }
                    }}
                    rows={2}
                    className={`w-full rounded border px-3 py-2 text-sm text-white outline-none focus:border-[#d7a84d]/50 ${
                      isCarried ? "border-[#d7a84d]/40 bg-[#0f2d4a]" : "border-white/15 bg-[#0f2d4a]"
                    }`}
                  />

                  {isCarried && prefill && (
                    <p className="mt-1 text-[11px] leading-5 text-[#d7a84d]/80">
                      Carried from {prefill.origin}
                      {formatShortDate(prefill.updatedAt) && ` · ${formatShortDate(prefill.updatedAt)}`}
                      {prefill.stale
                        ? " · check this is still right"
                        : " · edit if this has changed"}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Prefilled is not the same as answered. Saving is still an
                explicit act, and only saving marks the step complete — a
                carried-over value that nobody looked at shouldn't move the
                progress bar. */}
            {carriedCount > 0 && (
              <p className="text-xs text-white/55">
                {carriedCount} of {step.questions.length} answer
                {step.questions.length === 1 ? "" : "s"} carried over from what you&apos;ve
                already told us. Check them, then save.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleReview}
                disabled={isReviewing}
                className="rounded-full border border-[#d7a84d]/40 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#d7a84d] transition hover:bg-[#d7a84d]/10 disabled:opacity-50"
              >
                {isReviewing ? "Reviewing…" : "Review my answers"}
              </button>
              {state.error && <span className="text-xs text-red-400">{state.error}</span>}
            </div>
          </form>

          {reviewError && <p className="mt-3 text-xs font-semibold text-red-400">{reviewError}</p>}

          {review && (
            <div className="mt-4 space-y-2 rounded-[8px] border border-[#d7a84d]/20 bg-[#d7a84d]/5 p-4 text-sm">
              {review.kind === "structured" ? (
                <>
                  <p>
                    <span className="font-bold text-[#d7a84d]">Strongest point: </span>
                    <span className="text-white/80">{review.strongestPoint}</span>
                  </p>
                  <p>
                    <span className="font-bold text-[#d7a84d]">Gap: </span>
                    <span className="text-white/80">{review.gap}</span>
                  </p>
                  <p>
                    <span className="font-bold text-[#d7a84d]">Wisconsin tip: </span>
                    <span className="text-white/80">{review.wisconsinTip}</span>
                  </p>
                </>
              ) : (
                <p className="text-white/80">{review.text}</p>
              )}
              {/* Keyed on the step, not on this particular review. Re-reviewing
                  after an edit replaces the rating, which is right: there is
                  only ever one review on screen for a step, and it is the one
                  being judged. */}
              <AnswerFeedback
                route="review-step"
                targetKey={`review-step:${moduleKey}:${step.key}`}
                tone="light"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

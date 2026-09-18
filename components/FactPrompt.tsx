"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import type { FormState } from "@/app/actions";
import { saveFactsAtPointOfNeedAction } from "@/app/actions";
import type { FactDefinition } from "@/data/facts";
import { dismissPrompt, isPromptDismissed, type PromptSurface } from "@/lib/pointOfNeed";

type Props = {
  surface: PromptSurface;
  /** Only the facts still missing — the parent decides, see lib/pointOfNeed.ts. */
  questions: FactDefinition[];
  /** One sentence on what answering does to the list below. */
  intro: string;
  /** The deadline list sits on a cream card; Funding & Programs on navy. */
  tone: "light" | "dark";
};

const initialFormState: FormState = { ok: false, error: null };

/**
 * A few questions asked where their answers change what is on screen.
 *
 * Small on purpose: only the missing facts, each as the plain question from
 * the catalog, one Save button, one way to skip. The parent renders nothing
 * when there is nothing left to ask, so a member who answered these in the
 * Snapshot, a guided step or a Coach card never sees this at all — that is the
 * "never ask twice" rule, enforced by which questions are passed in rather
 * than by anything this component decides.
 *
 * Saving goes through the same fact store as every other answer
 * (upsertMemberFacts, via saveFactsAtPointOfNeedAction). On success the action
 * revalidates the dashboard, so the parent re-renders with the list narrowed
 * and this prompt shorter or gone. Nothing here tracks "saved" state for that
 * reason: the server's view of what is still missing is the only one that
 * matters, and mirroring it in the browser would be a second source of truth.
 *
 * Skipping is a browser-side memory, read through useSyncExternalStore rather
 * than an effect so the server render (never dismissed) and the first client
 * render agree, then the stored answer takes over without a state write inside
 * an effect. A skipped prompt never blocks the list: the rows below are the
 * full, unfiltered set, exactly as they were before this existed.
 */
export default function FactPrompt({ surface, questions, intro, tone }: Props) {
  const [state, formAction, isSaving] = useActionState(saveFactsAtPointOfNeedAction, initialFormState);

  const storedDismissal = useSyncExternalStore(
    subscribeToNothing,
    () => isPromptDismissed(surface, window.localStorage),
    () => false,
  );
  const [dismissedNow, setDismissedNow] = useState(false);

  if (storedDismissal || dismissedNow || questions.length === 0) return null;

  const light = tone === "light";
  const card = light
    ? "border-[#0f2d4a]/15 bg-white text-[#0f2d4a]"
    : "border-[#d7a84d]/30 bg-white/5 text-white";
  const label = light ? "text-[#0f2d4a]" : "text-white";
  const help = light ? "text-slate-500" : "text-white/45";
  const field = light
    ? "border-[#0f2d4a]/20 bg-[#fdfaf5] text-[#0f2d4a] focus:border-[#9b6b1f]"
    : "border-white/15 bg-[#0f2d4a] text-white focus:border-[#d7a84d]/50";
  const skip = light ? "text-slate-500 hover:text-[#0f2d4a]" : "text-white/50 hover:text-white";

  function skipForNow() {
    dismissPrompt(surface, window.localStorage);
    setDismissedNow(true);
  }

  return (
    <form action={formAction} className={`mb-4 rounded-[8px] border p-4 ${card}`}>
      <input type="hidden" name="surface" value={surface} />

      <p className={`text-xs font-bold uppercase tracking-[0.15em] ${light ? "text-[#9b6b1f]" : "text-[#d7a84d]"}`}>
        {questions.length === 1 ? "One quick question" : `${questions.length} quick questions`}
      </p>
      <p className={`mt-1 text-sm leading-6 ${light ? "text-slate-600" : "text-white/65"}`}>{intro}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {questions.map((def) => {
          const name = `fact_${def.key}`;
          return (
            <div key={def.key}>
              <label htmlFor={`${surface}-${name}`} className={`mb-1 block text-xs font-semibold ${label}`}>
                {def.question}
              </label>
              {def.type === "choice" ? (
                <select
                  id={`${surface}-${name}`}
                  name={name}
                  defaultValue=""
                  className={`w-full rounded border px-3 py-2 text-sm outline-none ${field}`}
                >
                  <option value="">Choose one…</option>
                  {def.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`${surface}-${name}`}
                  name={name}
                  type={def.type === "date" ? "date" : "text"}
                  placeholder={def.placeholder}
                  className={`w-full rounded border px-3 py-2 text-sm outline-none ${field}`}
                />
              )}
              {/* Every fact says what it is for — constraint 3 in data/facts.ts.
                  A question with no stated purpose is just a longer form. */}
              <p className={`mt-1 text-[11px] leading-5 ${help}`}>{def.purpose}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={skipForNow}
          className={`text-xs font-bold uppercase tracking-[0.1em] ${skip}`}
        >
          Skip for now
        </button>
        {state.error && (
          <span className={`text-xs ${light ? "text-red-700" : "text-red-400"}`}>{state.error}</span>
        )}
      </div>
    </form>
  );
}

/**
 * localStorage has no change event for the same tab, and the only writer is
 * this component (which also sets local state), so there is nothing to
 * subscribe to. useSyncExternalStore still needs the function.
 */
function subscribeToNothing() {
  return () => {};
}

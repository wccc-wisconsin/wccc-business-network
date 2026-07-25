"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/actions";
import { saveBusinessAssessmentAction } from "@/app/actions";
import { assessmentQuestions } from "@/data/assessment";
import { businessModules } from "@/data/modules";
import type { BusinessAssessment } from "@/lib/appStore";

type Props = {
  initialAssessment: BusinessAssessment | null;
};

const initialFormState: FormState = { ok: false, error: null };

// "Business Snapshot" — a 7-question card on the dashboard that classifies
// a member's business stage and, from their stated top priority, unlocks
// one roadmap module for free regardless of membership tier (see
// isModuleUnlocked in data/modules.ts and saveBusinessAssessmentAction in
// app/actions.ts). Uncontrolled radios (defaultChecked, like the onboarding
// form) — no need to mirror answers into React state since the server
// action reads straight off FormData.
//
// Collapsing back to the results view after a successful save is handled
// by remounting, not an effect: app/dashboard/page.tsx keys this component
// on the assessment's `updatedAt`, so once saveBusinessAssessmentAction
// succeeds and revalidatePath("/dashboard") brings back a fresh row (with a
// new updatedAt), React tears down this instance and re-initializes
// `isEditing` from the new `initialAssessment` below. On a failed save the
// row (and its updatedAt) don't change, so the key stays put, nothing
// remounts, and the in-progress form + error message stay visible.
export default function BusinessAssessmentCard({ initialAssessment }: Props) {
  const [isEditing, setIsEditing] = useState(!initialAssessment);
  const [state, formAction, isSaving] = useActionState(saveBusinessAssessmentAction, initialFormState);

  const unlockedModule = initialAssessment?.freeModuleKey
    ? businessModules.find((m) => m.key === initialAssessment.freeModuleKey)
    : null;

  return (
    <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">Business Snapshot</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-white">
            {initialAssessment ? "Your business, at a glance" : "Tell us where your business stands"}
          </h2>
          <p className="mt-1 text-sm text-white/50">
            {initialAssessment
              ? "7 quick questions — update anytime as your business changes."
              : "7 quick questions unlock one roadmap module free, matched to what you need most right now."}
          </p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="shrink-0 rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a]"
          >
            {initialAssessment ? "Update my answers" : "Take the snapshot"}
          </button>
        )}
      </div>

      {!isEditing && initialAssessment && (
        <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex flex-col items-start gap-1 rounded-[8px] border border-[#d7a84d]/25 bg-[#d7a84d]/10 px-4 py-3 sm:items-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7a84d]">Stage</span>
            <span className="font-serif text-lg font-bold text-white whitespace-nowrap">{initialAssessment.stage}</span>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-white/60">
              <span>Business maturity score</span>
              <span>{initialAssessment.score}/100</span>
            </div>
            <div className="h-2 rounded-full bg-white/12">
              <div className="h-2 rounded-full bg-[#d7a84d]" style={{ width: `${initialAssessment.score}%` }} />
            </div>
          </div>
        </div>
      )}

      {!isEditing && unlockedModule && (
        <div className="mt-4 rounded-[8px] border border-emerald-400/30 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{unlockedModule.icon}</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-300">Unlocked free for you</p>
              <p className="text-sm font-bold text-white">
                {unlockedModule.label} — {unlockedModule.tagline}
              </p>
            </div>
          </div>

          {unlockedModule.resources.length > 0 && (
            <>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                Start with these
              </p>
              <ul className="mt-2 space-y-1.5">
                {unlockedModule.resources.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="mt-0.5 shrink-0 text-emerald-300">☐</span>
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}

          <Link
            href={`/dashboard/roadmap/${unlockedModule.key}`}
            className="mt-4 inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-300 transition hover:bg-emerald-400/30"
          >
            Start {unlockedModule.label} →
          </Link>
        </div>
      )}

      {isEditing && (
        <form action={formAction} className="mt-5 space-y-6">
          {assessmentQuestions.map((q) => (
            <fieldset key={q.key} className="space-y-2">
              <legend className="text-sm font-bold text-white">{q.label}</legend>
              {q.helpText && <p className="text-xs text-white/50">{q.helpText}</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-start gap-2 rounded border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80 transition hover:border-[#d7a84d]/40 has-[:checked]:border-[#d7a84d] has-[:checked]:bg-[#d7a84d]/10"
                  >
                    <input
                      type="radio"
                      name={q.key}
                      value={opt.value}
                      defaultChecked={initialAssessment?.answers[q.key] === opt.value}
                      required
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#d7a84d]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-[#d7a84d] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save my snapshot"}
            </button>
            {initialAssessment && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold uppercase tracking-[0.1em] text-white/50 hover:text-white"
              >
                Cancel
              </button>
            )}
            {state.error && <span className="text-xs text-red-400">{state.error}</span>}
          </div>
        </form>
      )}
    </section>
  );
}

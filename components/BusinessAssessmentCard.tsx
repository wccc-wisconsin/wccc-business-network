"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/actions";
import { saveBusinessAssessmentAction } from "@/app/actions";
import { assessmentQuestions, profileQuestions } from "@/data/assessment";
import { factDefinition, requiredFactKeys } from "@/data/facts";
import { businessModules } from "@/data/modules";
import type { BusinessAssessment } from "@/lib/appStore";

type Props = {
  initialAssessment: BusinessAssessment | null;
  /** Raw stored fact values, keyed by fact key — option values, not labels. */
  initialFacts: Record<string, string>;
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
export default function BusinessAssessmentCard({ initialAssessment, initialFacts }: Props) {
  const [isEditing, setIsEditing] = useState(!initialAssessment);
  // Collapsed by default once the snapshot has been taken: at that point the
  // card is a result the member has already seen, and leaving it expanded
  // pushed the roadmap and everything below it off the first screen. A member
  // who hasn't taken it yet still gets it open, since that's the one case
  // where the card is the thing they should act on.
  const [isOpen, setIsOpen] = useState(!initialAssessment);
  const [state, formAction, isSaving] = useActionState(saveBusinessAssessmentAction, initialFormState);

  const unlockedModule = initialAssessment?.freeModuleKey
    ? businessModules.find((m) => m.key === initialAssessment.freeModuleKey)
    : null;

  // Counted across the whole catalog, not just the questions on this card:
  // facts also arrive from the guided steps, and a meter that ignored those
  // would keep telling a member they had work to do that they'd already done.
  const factsOnFile = requiredFactKeys.filter((key) => (initialFacts[key] ?? "") !== "").length;

  // Editing always forces the body open — collapsing a form mid-edit would
  // hide unsaved answers with no indication of where they went.
  const expanded = isOpen || isEditing;

  // Collapsed, the header has to carry the result on its own, otherwise
  // collapsing loses the stage and the free-module unlock entirely.
  const collapsedSummary = initialAssessment
    ? `${initialAssessment.stage}${unlockedModule ? ` · ${unlockedModule.label} unlocked free` : ""}`
    : "7 quick questions unlock one roadmap module free, matched to what you need most right now.";

  return (
    <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          aria-expanded={expanded}
          aria-controls="business-snapshot-body"
          className="flex flex-1 items-start gap-3 text-left"
        >
          <span className="mt-1 text-lg leading-none text-white/40" aria-hidden="true">
            {expanded ? "−" : "+"}
          </span>
          <span>
            <span className="block text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
              Business Snapshot
            </span>
            <span className="mt-1 block font-serif text-2xl font-bold text-white">
              {initialAssessment ? "Your business, at a glance" : "Tell us where your business stands"}
            </span>
            <span className="mt-1 block text-sm text-white/50">
              {expanded && initialAssessment
                ? "7 quick questions — update anytime as your business changes."
                : collapsedSummary}
            </span>
          </span>
        </button>
        {!isEditing && expanded && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="shrink-0 rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a]"
          >
            {initialAssessment ? "Update my answers" : "Take the snapshot"}
          </button>
        )}
      </div>

      <div id="business-snapshot-body" hidden={!expanded}>

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

      {!isEditing && initialAssessment && (
        <div className="mt-4 rounded-[8px] border border-white/10 bg-white/5 px-4 py-3">
          <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-white/60">
            <span>Business profile</span>
            <span>
              {factsOnFile} of {requiredFactKeys.length} details on file
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/12">
            <div
              className="h-1.5 rounded-full bg-[#d7a84d]"
              style={{ width: `${Math.round((factsOnFile / requiredFactKeys.length) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-5 text-white/45">
            These fill in as you work through your modules — every one you answer is one you
            won&apos;t be asked again.
          </p>
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

          {/* Optional, unscored, and visibly separated from the quiz above.
              Nothing here is `required`: these are facts about the business
              rather than inputs to the score, so a blank one costs the member
              nothing beyond being asked again later in a module. */}
          <div className="space-y-4 rounded-[8px] border border-white/10 bg-white/5 p-4">
            <div>
              <p className="text-sm font-bold text-white">A few details about the business</p>
              <p className="mt-1 text-xs leading-5 text-white/50">
                Optional — skip anything you&apos;re unsure of. Whatever you fill in here gets
                carried into your roadmap modules and filters your deadline list, so you
                won&apos;t be asked for it twice.
              </p>
            </div>

            {profileQuestions.map((key) => {
              const def = factDefinition(key);
              if (!def) return null;
              const name = `fact_${key}`;
              const current = initialFacts[key] ?? "";

              return (
                <div key={key}>
                  <label htmlFor={name} className="mb-1 block text-xs font-semibold text-white/70">
                    {def.question}
                  </label>

                  {def.type === "choice" ? (
                    <select
                      id={name}
                      name={name}
                      defaultValue={current}
                      className="w-full rounded border border-white/15 bg-[#0f2d4a] px-3 py-2 text-sm text-white outline-none focus:border-[#d7a84d]/50"
                    >
                      <option value="">Prefer not to answer yet</option>
                      {def.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={name}
                      name={name}
                      type={def.type === "date" ? "date" : "text"}
                      defaultValue={current}
                      placeholder={def.placeholder}
                      className="w-full rounded border border-white/15 bg-[#0f2d4a] px-3 py-2 text-sm text-white outline-none focus:border-[#d7a84d]/50"
                    />
                  )}

                  <p className="mt-1 text-[11px] leading-5 text-white/40">{def.purpose}</p>
                </div>
              );
            })}
          </div>

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

      </div>
    </section>
  );
}

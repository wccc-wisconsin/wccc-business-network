"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions";
import { updateMemberProfileAction } from "@/app/actions";
import { industryOptions } from "@/data/industries";

const initialFormState: FormState = { ok: false, error: null };

// The four answers onboarding collects, and the only place they can be changed.
//
// Onboarding redirects to the dashboard as soon as `industry` is set, so before
// this card existed those answers were frozen for the life of an account: a
// member who moved city, renamed their business or mis-picked their industry
// had no way to correct it, and every AI surface went on describing them by it.
// Industry mattered most — it is passed to Grants.gov as the funding search
// term, so a wrong one quietly returns the wrong money forever.
//
// Shaped like components/BusinessAssessmentCard.tsx on purpose: collapsed
// summary, one Edit button, uncontrolled inputs read straight off FormData by
// the server action. A member who has seen one card knows how the other works.
type Props = {
  name: string;
  businessName: string;
  industry: string;
  city: string;
  email: string;
};

export default function MemberProfileCard({ name, businessName, industry, city, email }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isSaving] = useActionState(updateMemberProfileAction, initialFormState);

  const summary = [businessName || null, industry || null, city ? `${city}, WI` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">Your details</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-white">{name}</h2>
          <p className="mt-1 text-sm text-white/50">
            {summary || "No business details yet — add them so your coach knows who it is helping."}
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="shrink-0 rounded-full border border-[#d7a84d]/40 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#d7a84d] transition hover:bg-[#d7a84d]/10"
          >
            Edit
          </button>
        )}
      </div>

      {/* The form does not close itself on submit.
          It did, in the first version of this card, and that swallowed every
          failure: `state.error` is rendered inside this form, so unmounting
          it the moment the member pressed Save meant a rejected industry or a
          dead database showed nothing at all and the member simply watched
          their change not happen.

          Closing happens the same way the Business Snapshot does it —
          app/dashboard/page.tsx keys this component on the four values, so a
          save that changes any of them remounts the card and it comes back
          collapsed, showing what was stored. A save that changes nothing
          leaves the form open saying so, which is the honest outcome. */}
      {isEditing && (
        <form action={formAction} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-name" className="mb-1 block text-xs font-semibold text-white/70">
                Your name
              </label>
              <input
                id="profile-name"
                name="name"
                required
                defaultValue={name}
                className="w-full rounded border border-white/15 bg-[#0f2d4a] px-3 py-2 text-sm text-white outline-none focus:border-[#d7a84d]/50"
              />
            </div>

            <div>
              <label
                htmlFor="profile-business"
                className="mb-1 block text-xs font-semibold text-white/70"
              >
                Business or organisation
              </label>
              <input
                id="profile-business"
                name="businessName"
                defaultValue={businessName}
                placeholder="Leave blank if not applicable"
                className="w-full rounded border border-white/15 bg-[#0f2d4a] px-3 py-2 text-sm text-white outline-none focus:border-[#d7a84d]/50"
              />
            </div>

            <div>
              <label
                htmlFor="profile-industry"
                className="mb-1 block text-xs font-semibold text-white/70"
              >
                Industry
              </label>
              <select
                id="profile-industry"
                name="industry"
                required
                defaultValue={industry}
                className="w-full rounded border border-white/15 bg-[#0f2d4a] px-3 py-2 text-sm text-white outline-none focus:border-[#d7a84d]/50"
              >
                {/* A member whose stored industry predates this list would
                    otherwise see an empty select and, on saving, be rejected by
                    the action for a value they never chose. Shown as its own
                    option so the form is honest about what is stored, and
                    editable to something the list does offer. */}
                {!industryOptions.some((option) => option.value === industry) && industry && (
                  <option value={industry}>{industry} (no longer offered)</option>
                )}
                {industryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] leading-5 text-white/40">
                Used to search federal funding for you, so it is worth getting right.
              </p>
            </div>

            <div>
              <label htmlFor="profile-city" className="mb-1 block text-xs font-semibold text-white/70">
                City or region
              </label>
              <input
                id="profile-city"
                name="city"
                defaultValue={city}
                placeholder="Milwaukee"
                className="w-full rounded border border-white/15 bg-[#0f2d4a] px-3 py-2 text-sm text-white outline-none focus:border-[#d7a84d]/50"
              />
            </div>
          </div>

          {/* Read-only, and shown so the card is a complete picture of the
              account. Clerk owns it — changing it here would put the members
              table out of step with the identity the member signs in with. */}
          <p className="text-[11px] text-white/35">
            Signed in as {email}. Email is managed by your sign-in account.
          </p>

          {state.error && <p className="text-xs font-semibold text-red-400">{state.error}</p>}
          {state.ok && !state.error && (
            <p className="text-xs font-semibold text-emerald-300">Saved.</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-[#d7a84d] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white/60 transition hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

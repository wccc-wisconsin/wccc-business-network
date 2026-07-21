"use client";

import { useState, useTransition } from "react";
import type { Opportunity } from "@/lib/appStore";

type Matches = { items: Opportunity[]; generatedAt: string } | null;

type Props = {
  initialOpportunities: Matches;
};

const typeStyles: Record<string, string> = {
  Grant: "bg-emerald-400/15 text-emerald-300",
  Loan: "bg-sky-400/15 text-sky-300",
  Certification: "bg-purple-400/15 text-purple-300",
  Program: "bg-white/10 text-white/70",
  Advising: "bg-orange-400/15 text-orange-300",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}

// "Find funding & programs" — calls /api/ai/opportunities to generate a
// short, personalized list of grants/loans/certifications/programs for this
// member, based on their industry/city/stage. Deliberately excludes
// contracts/RFPs, which are covered by the roadmap's own "Opportunity" stage.
// Regenerating replaces the previous list (saveMemberOpportunities overwrites,
// same as the module summary pattern).
export default function OpportunitiesPanel({ initialOpportunities }: Props) {
  const [matches, setMatches] = useState<Matches>(initialOpportunities);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/opportunities", { method: "POST" });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Something went wrong.");
          return;
        }
        setMatches(data.opportunities);
      } catch {
        setError("Couldn't reach the AI assistant. Please try again.");
      }
    });
  }

  return (
    <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
            Funding &amp; Programs
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-white">Funding &amp; programs for your business</h2>
          <p className="mt-1 text-sm text-white/50">
            {matches
              ? `Last generated ${formatDate(matches.generatedAt)} — grants, loans, certifications, and programs matched to your profile.`
              : "Grants, loans, certifications, and programs matched to your industry, city, and membership stage."}
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="shrink-0 rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50"
        >
          {isPending ? "Finding…" : matches ? "Refresh matches" : "Find matches"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}

      {matches && matches.items.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {matches.items.map((item) => (
            <article key={item.title} className="rounded-[8px] border border-white/10 bg-white/5 p-4">
              <span
                className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                  typeStyles[item.type] ?? "bg-white/10 text-white/70"
                }`}
              >
                {item.type}
              </span>
              <h3 className="mt-2 text-sm font-bold text-white">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-white/65">{item.description}</p>
              <p className="mt-2 text-xs leading-5 text-white/50">
                <span className="font-semibold text-white/70">Why it fits: </span>
                {item.whyItFits}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#d7a84d]">
                Next step: {item.nextStep}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/50">
          Nothing generated yet — click &ldquo;Find matches&rdquo; for a personalized list.
        </p>
      )}
    </section>
  );
}

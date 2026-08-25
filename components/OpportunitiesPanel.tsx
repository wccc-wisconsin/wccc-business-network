"use client";

import { useState, useTransition } from "react";
import type { Opportunity } from "@/lib/appStore";

type Matches = { items: Opportunity[]; generatedAt: string } | null;

/**
 * Where this generation's entries came from. Returned by /api/ai/opportunities
 * but deliberately not saved with the matches — it describes the sources of one
 * generation, so showing it again after a reload would claim a freshness the
 * stored rows don't have. Hence null until the member generates in this session.
 */
type Sources = {
  federalCount: number;
  wisconsinCount: number;
  federalError: string | null;
  wisconsinLastVerified: string | null;
} | null;

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

/**
 * Formats a plain YYYY-MM-DD calendar date.
 *
 * Not `new Date("2026-09-01")`: the spec parses a date-only string as UTC
 * midnight, which in America/Chicago renders as the day *before*. A grant
 * deadline shown a day early is a bug that only ever appears in the timezone
 * every member is actually in. Constructing from parts gives local midnight.
 */
function formatIsoDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}

/** Days from today to an ISO calendar date. Negative once it has passed. */
function daysUntil(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// "Find funding & programs" — calls /api/ai/opportunities, which retrieves a
// catalog of real opportunities (live from Grants.gov, plus Wisconsin entries a
// person at WCCC has verified) and has the model select from it. Nothing shown
// here is recalled by the model: every title, deadline and link comes from the
// catalog, and every card links out to its own source so a member can check it.
// Regenerating replaces the previous list (saveMemberOpportunities overwrites,
// same as the module summary pattern).
export default function OpportunitiesPanel({ initialOpportunities }: Props) {
  const [matches, setMatches] = useState<Matches>(initialOpportunities);
  const [sources, setSources] = useState<Sources>(null);
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
        setSources(data.sources ?? null);
      } catch {
        setError("Couldn't reach the AI assistant. Please try again.");
      }
    });
  }

  return (
    <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
            Funding &amp; Programs
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-white">Funding &amp; programs for your business</h2>
          <p className="mt-1 text-sm text-white/50">
            {matches
              ? `Last generated ${formatDate(matches.generatedAt)} — matched to your industry, city, and membership stage.`
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

      {/* Provenance. The member is told where these came from and what is
          missing, rather than being left to assume the list is complete. */}
      {sources && (
        <div className="mt-3 space-y-1 text-xs text-white/45">
          {/* Only counts that are actually non-zero get a clause. "Selected
              from 0 live federal listings" is technically true and reads as a
              malfunction, which buries the error line below it. */}
          {(sources.federalCount > 0 || sources.wisconsinCount > 0) && (
            <p>
              Selected from{" "}
              {[
                sources.federalCount > 0 &&
                  `${sources.federalCount} live federal ${
                    sources.federalCount === 1 ? "listing" : "listings"
                  } on Grants.gov`,
                sources.wisconsinCount > 0 &&
                  `${sources.wisconsinCount} Wisconsin ${
                    sources.wisconsinCount === 1 ? "program" : "programs"
                  }${
                    sources.wisconsinLastVerified
                      ? ` last checked ${formatIsoDay(sources.wisconsinLastVerified)}`
                      : ""
                  }`,
              ]
                .filter(Boolean)
                .join(" and ")}
              .
            </p>
          )}
          {sources.federalError && (
            <p className="font-semibold text-amber-300/80">
              Federal listings couldn&rsquo;t be loaded this time ({sources.federalError}) — the
              results below don&rsquo;t include them.
            </p>
          )}
          {sources.wisconsinCount === 0 && (
            <p>
              Wisconsin state and local programs aren&rsquo;t included yet — they&rsquo;re awaiting
              review by WCCC, and nothing is listed here until someone has confirmed it.
            </p>
          )}
          <p>Always confirm details on the program&rsquo;s own site before applying.</p>
        </div>
      )}

      {matches && matches.items.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {matches.items.map((item, index) => {
            const days = item.closeDate ? daysUntil(item.closeDate) : null;

            return (
              <article
                key={`${index}-${item.title}`}
                className="rounded-[8px] border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      typeStyles[item.type] ?? "bg-white/10 text-white/70"
                    }`}
                  >
                    {item.type}
                  </span>
                  {/* Federal vs Wisconsin matters to a member: one is a live
                      listing, the other a standing service someone checked. */}
                  {item.source && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                      {item.source === "federal" ? "Federal" : "Wisconsin"}
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-1 text-xs leading-5 text-white/65">{item.description}</p>

                {/* Deadlines are the fact that decides what a member acts on
                    this month, so the countdown is spelled out rather than
                    leaving them to subtract dates. Under two weeks turns amber:
                    still worth attempting, but not next weekend's job. */}
                {item.closeDate && (
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      days !== null && days <= 14 ? "text-amber-300" : "text-white/60"
                    }`}
                  >
                    Closes {formatIsoDay(item.closeDate)}
                    {days !== null && days >= 0 && ` — ${days === 0 ? "today" : `${days} days left`}`}
                  </p>
                )}

                <p className="mt-2 text-xs leading-5 text-white/50">
                  <span className="font-semibold text-white/70">Why it fits: </span>
                  {item.whyItFits}
                </p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#d7a84d]">
                  Next step: {item.nextStep}
                </p>

                {/* The link is the whole point of retrieval: the member can
                    check the source rather than taking the portal's word. */}
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-xs font-semibold text-white/70 underline underline-offset-4 transition hover:text-white"
                  >
                    View the official listing →
                  </a>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/50">
          Nothing generated yet — click &ldquo;Find matches&rdquo; for a personalized list.
        </p>
      )}
    </section>
  );
}

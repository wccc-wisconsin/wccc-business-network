"use client";

import { useState, useTransition } from "react";

type Summary = { title: string; content: string; updatedAt: string } | null;

type Props = {
  moduleKey: string;
  defaultTitle: string;
  initialSummary: Summary;
};

// "Save summary" — turns everything a member has written across a module's
// steps into one saved artifact (calls /api/ai/summarize-module, which also
// persists it via saveModuleSummary). Regenerating overwrites the previous one.
export default function ModuleSummaryPanel({ moduleKey, defaultTitle, initialSummary }: Props) {
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/summarize-module", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ moduleKey }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Something went wrong.");
          return;
        }
        setSummary(data.summary);
      } catch {
        setError("Couldn't reach the AI assistant. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-[8px] border border-white/10 bg-[#132f52] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">Save summary</p>
          <h2 className="mt-1 font-serif text-xl font-bold text-white">{summary?.title ?? defaultTitle}</h2>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50"
        >
          {isPending ? "Generating…" : summary ? "Regenerate" : "Generate summary"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}

      {summary ? (
        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/80">{summary.content}</p>
      ) : (
        <p className="mt-4 text-sm text-white/50">
          Answer at least one step above, then generate a short saved summary from what you&apos;ve written.
        </p>
      )}
    </div>
  );
}

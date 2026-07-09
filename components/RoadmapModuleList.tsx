"use client";

import { useEffect, useState } from "react";
import type { BusinessModule, MembershipTierKey } from "@/data/modules";
import { tierMeetsMinimum } from "@/data/modules";

type Props = {
  modules: BusinessModule[];
  membershipTier: MembershipTierKey;
  tierLabels: Record<string, string>;
};

// Card-deck stepper: one roadmap stage front-and-center at a time, with a
// peek of the next couple of stages stacked behind it. Forward/back arrows
// and a row of dots move through the deck. Shared by the single-track view
// (app/dashboard/page.tsx) and the tabbed view (DashboardRoadmapTabs.tsx)
// so the two can't drift apart.
export default function RoadmapModuleList({ modules, membershipTier, tierLabels }: Props) {
  const [index, setIndex] = useState(0);
  const total = modules.length;

  // Arrow-key navigation. Only one deck is ever mounted on the dashboard
  // at a time, so a plain window listener is safe here. Skip when the
  // keystroke originated in a text field (e.g. the event/program forms
  // elsewhere on the dashboard) so arrow keys still move the text cursor
  // instead of flipping cards out from under the user.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, total - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (total === 0) return null;

  const clamped = Math.min(index, total - 1);
  const canGoBack = clamped > 0;
  const canGoForward = clamped < total - 1;

  return (
    <div>
      <div className="relative min-h-[320px] sm:min-h-[260px]">
        {modules.map((mod, i) => {
          const depth = i - clamped;
          if (depth < 0 || depth > 2) return null; // only render the active card + 2 peeking behind it
          const unlocked = tierMeetsMinimum(membershipTier, mod.minTier);
          return (
            <div
              key={mod.key}
              aria-hidden={depth !== 0}
              className={`absolute inset-0 flex flex-col rounded-[8px] border p-5 sm:p-6 transition-all duration-300 ease-out motion-reduce:transition-none ${
                unlocked ? "border-[#d7a84d]/30 bg-[#d7a84d]/5" : "border-white/10 bg-white/[0.03]"
              }`}
              style={{
                transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.05})`,
                zIndex: total - depth,
                opacity: depth === 0 ? 1 : 0.4 - depth * 0.12,
                pointerEvents: depth === 0 ? "auto" : "none",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
                  Stage {i + 1} of {total}
                </span>
                <span className="text-3xl">{mod.icon}</span>
              </div>

              <p className={`mt-4 font-serif text-2xl font-bold ${unlocked ? "text-[#d7a84d]" : "text-white/60"}`}>
                {mod.label}
              </p>
              <p className="mt-1 text-sm text-white/50">{mod.tagline}</p>

              <div className="mt-5">
                {unlocked ? (
                  <div className="flex flex-wrap gap-2">
                    {mod.resources.map((r) => (
                      <span key={r} className="rounded-full border border-[#d7a84d]/25 bg-[#d7a84d]/10 px-3 py-1 text-xs text-white/80">
                        {r}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/40">🔒 Unlock at {tierLabels[mod.minTier]} tier</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={!canGoBack}
          aria-label="Previous stage"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d7a84d]/30 text-lg text-[#d7a84d] transition hover:bg-[#d7a84d]/10 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ‹
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {modules.map((mod, i) => (
            <button
              key={mod.key}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to stage ${i + 1}: ${mod.label}`}
              aria-current={i === clamped ? "true" : undefined}
              className={`h-2.5 rounded-full transition-all ${
                i === clamped ? "w-6 bg-[#d7a84d]" : "w-2.5 bg-white/20 hover:bg-white/35"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(i + 1, total - 1))}
          disabled={!canGoForward}
          aria-label="Next stage"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d7a84d]/30 text-lg text-[#d7a84d] transition hover:bg-[#d7a84d]/10 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ›
        </button>
      </div>
    </div>
  );
}

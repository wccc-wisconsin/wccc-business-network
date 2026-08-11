"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import Link from "next/link";
import type { BusinessModule, MembershipTierKey } from "@/data/modules";
import { isModuleUnlocked, tierMeetsMinimum } from "@/data/modules";

type Props = {
  modules: BusinessModule[];
  membershipTier: MembershipTierKey;
  tierLabels: Record<string, string>;
  /** The member's Business Snapshot free-unlock choice, if any — see data/assessment.ts. */
  freeModuleKey?: string | null;
};

// Card-deck stepper: one roadmap stage front-and-center at a time, with the
// previous stage peeking in from the left edge and the next stage peeking
// in from the right — never stacked directly behind the active card, so
// their text never bleeds through it. Forward/back arrows and a row of
// dots move through the deck, clicking a peeking card jumps to it, and on
// touch screens a horizontal swipe moves it a card at a time.
// Shared by the single-track view (app/dashboard/page.tsx) and the tabbed
// view (DashboardRoadmapTabs.tsx) so the two can't drift apart.
/** Horizontal travel below which a touch is treated as a tap, not a swipe. */
const SWIPE_MIN_PX = 45;

export default function RoadmapModuleList({ modules, membershipTier, tierLabels, freeModuleKey }: Props) {
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

  // Swipe. The arrows and dots are the only way through the deck otherwise,
  // and on a phone a horizontal drag is what people try first.
  //
  // Nothing here calls preventDefault and the handlers are React's (which
  // attach passively for touch), so a vertical drag still scrolls the page
  // normally — the gesture is only claimed when it's clearly sideways.
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;

    setIndex((i) =>
      dx < 0 ? Math.min(i + 1, total - 1) : Math.max(i - 1, 0),
    );
  }

  if (total === 0) return null;

  const clamped = Math.min(index, total - 1);
  const canGoBack = clamped > 0;
  const canGoForward = clamped < total - 1;

  return (
    <div>
      {/* Cards are absolutely positioned and stretched to this box, and the box
          clips — so its height has to clear the tallest card at each width.
          Phones are the tight case: the card is only ~200px of usable width
          there, so a stage's four resource pills wrap onto far more rows than
          they do on a laptop and 320px cut the "Learn more" link off. */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative min-h-[420px] overflow-hidden sm:min-h-[300px] lg:min-h-[260px]"
      >
        {modules.map((mod, i) => {
          const offset = i - clamped;
          if (offset < -1 || offset > 1) return null; // only render prev / active / next
          const isActive = offset === 0;
          const unlockedByTier = tierMeetsMinimum(membershipTier, mod.minTier);
          const unlocked = isModuleUnlocked(membershipTier, mod, freeModuleKey);
          const unlockedByFreeGrant = unlocked && !unlockedByTier;
          return (
            <div
              key={mod.key}
              aria-hidden={!isActive}
              onClick={!isActive ? () => setIndex(i) : undefined}
              className={`absolute inset-y-0 left-1/2 w-[88%] max-w-xl flex flex-col rounded-[8px] border p-5 sm:p-6 transition-all duration-300 ease-out motion-reduce:transition-none ${
                unlocked ? "border-[#d7a84d]/30 bg-[#d7a84d]/5" : "border-white/10 bg-white/[0.03]"
              } ${!isActive ? "cursor-pointer" : ""}`}
              style={{
                transform: `translateX(calc(-50% + ${offset * 62}%)) scale(${isActive ? 1 : 0.88})`,
                zIndex: isActive ? 10 : 5,
                opacity: isActive ? 1 : 0.35,
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

              {unlockedByFreeGrant && (
                <span className="mt-3 inline-block w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                  ✓ Unlocked free from your Business Snapshot
                </span>
              )}

              <div className="mt-5">
                {unlocked ? (
                  <div className="flex flex-wrap gap-2">
                    {/* max-w-full is load-bearing on phones: these are flex
                        items, whose default min-width keeps them as wide as
                        their text, so a label like "WI DFI business
                        registration guide" ran past the edge of the card
                        instead of wrapping inside it. */}
                    {mod.resources.map((r) => (
                      <span
                        key={r}
                        className="max-w-full rounded-full border border-[#d7a84d]/25 bg-[#d7a84d]/10 px-3 py-1 text-xs break-words text-white/80"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/40">🔒 Unlock at {tierLabels[mod.minTier]} tier</p>
                )}
              </div>

              <div className="mt-auto pt-5">
                <Link
                  href={`/dashboard/roadmap/${mod.key}`}
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.15em] text-[#d7a84d] hover:text-white"
                >
                  Learn more →
                </Link>
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

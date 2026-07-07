"use client";

import { useState } from "react";
import type { BusinessModule, MembershipTierKey } from "@/data/modules";
import { tierMeetsMinimum } from "@/data/modules";

export type RoadmapTrack = {
  key: string;
  eyebrow: string;
  heading: string;
  modules: BusinessModule[];
};

type Props = {
  tracks: RoadmapTrack[];
  membershipTier: MembershipTierKey;
  tierLabels: Record<string, string>;
};

// Tabbed view for members whose journey unlocks more than one roadmap
// (e.g. journey === "both"), so Business Networking and Personal
// Networking each get their own spotlighted tab instead of being
// stacked one after another.
export default function DashboardRoadmapTabs({ tracks, membershipTier, tierLabels }: Props) {
  const [activeKey, setActiveKey] = useState(tracks[0]?.key);
  const active = tracks.find((t) => t.key === activeKey) ?? tracks[0];

  if (!active) return null;

  return (
    <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-6">
      <div className="mb-5 flex flex-wrap gap-2 border-b border-white/10 pb-5">
        {tracks.map((track) => (
          <button
            key={track.key}
            type="button"
            onClick={() => setActiveKey(track.key)}
            aria-pressed={track.key === active.key}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] transition ${
              track.key === active.key
                ? "bg-[#d7a84d] text-[#0f2d4a]"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {track.eyebrow}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">{active.eyebrow}</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-white">{active.heading}</h2>
        <p className="mt-1 text-sm text-white/50">
          {active.modules.length} stages of resources. Your {tierLabels[membershipTier]} membership unlocks{" "}
          {active.modules.filter((m) => tierMeetsMinimum(membershipTier, m.minTier)).length} of {active.modules.length}.
        </p>
      </div>

      <div className="space-y-3">
        {active.modules.map((mod, i) => {
          const unlocked = tierMeetsMinimum(membershipTier, mod.minTier);
          return (
            <div
              key={mod.key}
              className={`rounded-[8px] border p-4 sm:flex sm:items-start sm:gap-5 ${
                unlocked ? "border-[#d7a84d]/30 bg-[#d7a84d]/5" : "border-white/10 bg-white/[0.03] opacity-70"
              }`}
            >
              <div className="flex items-center gap-3 sm:w-56 shrink-0">
                <span className="text-2xl">{mod.icon}</span>
                <div>
                  <p className={`text-sm font-bold uppercase tracking-[0.08em] ${unlocked ? "text-[#d7a84d]" : "text-white/60"}`}>
                    {i + 1}. {mod.label}
                  </p>
                  <p className="text-xs text-white/50">{mod.tagline}</p>
                </div>
              </div>
              <div className="mt-3 sm:mt-0 flex-1">
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
    </section>
  );
}

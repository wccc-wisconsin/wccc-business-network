"use client";

import { useState } from "react";
import type { BusinessModule, MembershipTierKey } from "@/data/modules";
import { tierMeetsMinimum } from "@/data/modules";
import RoadmapModuleList from "@/components/RoadmapModuleList";

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

      <RoadmapModuleList key={active.key} modules={active.modules} membershipTier={membershipTier} tierLabels={tierLabels} />
    </section>
  );
}

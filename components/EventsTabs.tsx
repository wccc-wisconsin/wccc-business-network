"use client";

import { useState, type ReactNode } from "react";

type Props = {
  events: ReactNode;
  compliance: ReactNode;
};

// Two tabs over one card: WCCC events, and the compliance deadline calendar.
//
// Both answer "what's coming up", so they belong in the same place rather than
// as two competing sections — and dates a member can't act on shouldn't take
// space at the top of the dashboard ahead of the roadmap.
//
// The panels are passed in as rendered server content (the events list uses
// server actions for Register), so this only owns which one is visible.
export default function EventsTabs({ events, compliance }: Props) {
  const [tab, setTab] = useState<"events" | "compliance">("events");

  const tabs = [
    { key: "events" as const, label: "Events" },
    { key: "compliance" as const, label: "Deadlines" },
  ];

  return (
    <div className="rounded-[8px] bg-[#f8f1e7] p-5 text-[#0f2d4a]">
      <div
        role="tablist"
        aria-label="Events and deadlines"
        className="mb-5 flex gap-1 border-b border-[#0f2d4a]/10"
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2 font-serif text-2xl font-bold transition ${
                active
                  ? "border-[#9b6b1f] text-[#0f2d4a]"
                  : "border-transparent text-[#0f2d4a]/35 hover:text-[#0f2d4a]/60"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Both panels stay mounted and one is hidden, rather than unmounting the
          inactive one — switching tabs shouldn't discard a Register button
          mid-submit or make the card jump as content re-renders. */}
      <div role="tabpanel" id="panel-events" aria-labelledby="tab-events" hidden={tab !== "events"}>
        {events}
      </div>
      <div
        role="tabpanel"
        id="panel-compliance"
        aria-labelledby="tab-compliance"
        hidden={tab !== "compliance"}
      >
        {compliance}
      </div>
    </div>
  );
}

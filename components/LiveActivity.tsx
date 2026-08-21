import { getPortalActivitySummary } from "@/lib/appStore";

// This is deliberately separate from <Stats /> above it. Stats.tsx shows
// WCCC's curated, all-time impact numbers (240+ businesses served, etc.) —
// those are organizational figures, not something this app can compute.
// This strip shows what the member portal itself has recorded, so it starts
// small and grows as the portal gets used. Mixing the two would either
// understate WCCC's real reach or overstate what the app has actually
// tracked, so they're kept visually and semantically distinct.
export default async function LiveActivity() {
  const summary = await getPortalActivitySummary();

  // Event registrations, event check-ins and program enrollments used to sit
  // beside this. All three could only ever be fed by the placeholder events
  // and programs that have now been removed, so they'd read a permanent 0 —
  // which says "nobody uses this" rather than "this isn't a feature". The one
  // number left is the one the portal genuinely accumulates.
  const items = [{ label: "Members on the portal", value: summary.totalMembers }];

  return (
    <section className="bg-[#0f2d4a] px-4 py-8 sm:px-6 sm:py-10" aria-label="Live member portal activity">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
          Live from the member portal
        </p>
        {/* Sized to the number of stats rather than a fixed 4-up grid, so
            dropping the three dead counts doesn't leave one card stranded
            across a full-width row. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-[8px] border border-white/10 bg-white/5 p-5"
            >
              <div className="font-serif text-3xl font-bold text-white">{item.value}</div>
              <div className="mt-1 text-sm text-white/60">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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

  const items = [
    { label: "Members on the portal", value: summary.totalMembers },
    { label: "Event registrations", value: summary.totalEventRegistrations },
    { label: "Event check-ins", value: summary.totalEventAttendance },
    { label: "Program enrollments", value: summary.totalProgramEnrollments },
  ];

  return (
    <section className="bg-[#0f2d4a] px-6 py-10" aria-label="Live member portal activity">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
          Live from the member portal
        </p>
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

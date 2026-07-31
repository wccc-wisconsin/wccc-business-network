import {
  LAST_VERIFIED,
  complianceItems,
  daysUntil,
  upcomingCompliance,
} from "@/data/compliance";

/**
 * Upcoming filing deadlines for Wisconsin small businesses.
 *
 * A server component with no member input and no AI call: the dates are known,
 * so they render instantly on page load rather than sitting behind a button.
 * That's the whole point — an owner shouldn't have to ask what's due.
 *
 * Each row names who it applies to and links to the agency, because the portal
 * doesn't collect entity type or formation date and therefore cannot know
 * which of these are actually this member's. Saying "your report is due" when
 * it might not be is the failure mode worth avoiding.
 */

/** Below this many remaining items, the data needs another year added. */
const NEEDS_REFRESH_THRESHOLD = 4;

const HOW_MANY_SHOWN = 5;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function countdown(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 30) return `In ${days} days`;
  if (days < 60) return "In about a month";
  return `In about ${Math.round(days / 30)} months`;
}

/** Red inside a week, amber inside a month, plain after that. */
function urgencyClasses(days: number) {
  if (days <= 7) return "border-red-400/40 bg-red-400/10 text-red-300";
  if (days <= 30) return "border-[#d7a84d]/40 bg-[#d7a84d]/10 text-[#d7a84d]";
  return "border-white/15 bg-white/5 text-white/60";
}

export default function ComplianceCalendar() {
  const now = new Date();
  const upcoming = upcomingCompliance(now, HOW_MANY_SHOWN);
  const remaining = complianceItems.filter((i) => daysUntil(i.date, now) >= 0).length;
  const needsRefresh = remaining < NEEDS_REFRESH_THRESHOLD;

  return (
    <section className="mt-6 rounded-[8px] border border-white/10 bg-[#132f52] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
            Compliance Calendar
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-white">What&apos;s coming due</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Wisconsin and federal filing deadlines. Not all of these apply to every business —
            each one says who it&apos;s for. Confirm your own dates with the agency.
          </p>
        </div>
        <span className="shrink-0 text-xs text-white/35">
          Checked {formatDate(LAST_VERIFIED)}
        </span>
      </div>

      {upcoming.length === 0 ? (
        <p className="mt-5 text-sm text-white/60">
          No dates on file. The deadline list needs updating — email info@wisccc.org.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {upcoming.map((item) => {
            const days = daysUntil(item.date, now);
            return (
              <li
                key={item.key}
                className="rounded-[8px] border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#d7a84d]/80">
                      {item.appliesTo}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${urgencyClasses(days)}`}
                  >
                    {countdown(days)}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-white/65">{item.detail}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-white/45">{formatDate(item.date)}</span>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#d7a84d] transition hover:text-[#e8bd6a]"
                  >
                    {item.sourceName} ↗
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Shown to members too, not hidden in a log: a calendar quietly running
          out of dates is exactly how this feature would rot without anyone
          noticing. */}
      {needsRefresh && (
        <p className="mt-4 rounded-[8px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-300">
          Only {remaining} deadline{remaining === 1 ? "" : "s"} left on file — this calendar needs
          next year&apos;s dates added. Email info@wisccc.org if it looks out of date.
        </p>
      )}
    </section>
  );
}

import {
  LAST_VERIFIED,
  complianceItems,
  daysUntil,
  upcomingCompliance,
} from "@/data/compliance";

/**
 * Upcoming filing deadlines for Wisconsin small businesses — payroll tax,
 * estimated tax, and the Wisconsin annual report. These carry penalties when
 * missed, which is the whole reason the portal surfaces them.
 *
 * No member input and no AI call: the dates are known, so they render on page
 * load rather than sitting behind a button.
 *
 * Renders content only, with no outer card — it lives inside the Events
 * section's tab panel (see EventsTabs), which supplies the chrome. Styled for
 * that section's light cream card rather than the dark dashboard background.
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
  if (days <= 7) return "border-red-300 bg-red-50 text-red-700";
  if (days <= 30) return "border-[#d7a84d] bg-[#fdf6ec] text-[#9b6b1f]";
  return "border-[#0f2d4a]/15 bg-white text-slate-500";
}

export default function ComplianceCalendar() {
  const now = new Date();
  const upcoming = upcomingCompliance(now, HOW_MANY_SHOWN);
  const remaining = complianceItems.filter((i) => daysUntil(i.date, now) >= 0).length;
  const needsRefresh = remaining < NEEDS_REFRESH_THRESHOLD;

  return (
    <div>
      <p className="text-sm leading-6 text-slate-600">
        Wisconsin and federal filing deadlines. Not all of these apply to every business — each
        one says who it&apos;s for. Confirm your own dates with the agency.
      </p>

      {upcoming.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No dates on file. The deadline list needs updating — email info@wisccc.org.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {upcoming.map((item) => {
            const days = daysUntil(item.date, now);
            return (
              <li
                key={item.key}
                className="rounded-[8px] border border-[#0f2d4a]/10 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold">{item.title}</h3>
                    <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.15em] text-[#9b6b1f]">
                      {item.appliesTo}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${urgencyClasses(days)}`}
                  >
                    {countdown(days)}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-semibold text-slate-500">{formatDate(item.date)}</span>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#9b6b1f] underline-offset-2 hover:underline"
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
          out of dates is exactly how this feature would rot unnoticed. */}
      {needsRefresh && (
        <p className="mt-4 rounded-[8px] border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Only {remaining} deadline{remaining === 1 ? "" : "s"} left on file — this calendar needs
          next year&apos;s dates added. Email info@wisccc.org if it looks out of date.
        </p>
      )}

      <p className="mt-4 text-xs text-slate-400">Dates last checked {formatDate(LAST_VERIFIED)}</p>
    </div>
  );
}

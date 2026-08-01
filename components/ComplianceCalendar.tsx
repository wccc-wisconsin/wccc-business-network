import { LAST_VERIFIED, complianceItems, daysUntil } from "@/data/compliance";
import { deadlinesForMember, type MemberDeadline } from "@/lib/deadlines";
import type { MemberFact } from "@/lib/appStore";

/**
 * Upcoming deadlines for one member — the shared Wisconsin/federal filing
 * calendar narrowed to what applies to them, plus the renewal dates they've
 * recorded themselves (insurance, licence, certification, SAM.gov, lease).
 *
 * No AI call and no member input at render time: the dates are known and the
 * filtering is arithmetic, so it all resolves on page load.
 *
 * Renders content only, with no outer card — it lives inside the Events
 * section's tab panel (see EventsTabs), which supplies the chrome. Styled for
 * that section's light cream card rather than the dark dashboard background.
 *
 * Rows the member's facts couldn't settle are still shown, carrying the same
 * "who this is for" line they always had. See lib/deadlines.ts for why the
 * uncertain case errs toward showing.
 */

/** Below this many remaining items, the data needs another year added. */
const NEEDS_REFRESH_THRESHOLD = 4;

const HOW_MANY_SHOWN = 5;

type Props = {
  /** The member's facts. Empty is fine — nothing is filtered without them. */
  facts: Record<string, MemberFact>;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function countdown(days: number) {
  if (days < 0) {
    const overdue = Math.abs(days);
    if (overdue === 1) return "Yesterday";
    if (overdue < 30) return `${overdue} days ago`;
    return `${Math.round(overdue / 30)} months ago`;
  }
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

function DeadlineRow({ item, days }: { item: MemberDeadline; days: number }) {
  return (
    <li className="rounded-[8px] border border-[#0f2d4a]/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold">{item.title}</h3>
          <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.15em] text-[#9b6b1f]">
            {item.appliesTo}
            {item.origin === "profile" && " · from your profile"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${urgencyClasses(days)}`}
        >
          {countdown(days)}
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>

      {/* Only shown when the member's facts left it open. A row we're sure
          about doesn't need hedging, and hedging everything trains people to
          ignore the hedge. */}
      {item.certainty === "unknown" && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Shown because we don&apos;t yet know whether this one is yours. Fill in your Business
          Snapshot and it&apos;ll drop off if it isn&apos;t.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold text-slate-500">{formatDate(item.date)}</span>
        {item.sourceUrl && item.sourceName && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#9b6b1f] underline-offset-2 hover:underline"
          >
            {item.sourceName} ↗
          </a>
        )}
      </div>
    </li>
  );
}

export default function ComplianceCalendar({ facts }: Props) {
  const now = new Date();
  const { upcoming, lapsed, filteredOut, totalUpcoming } = deadlinesForMember(
    facts,
    now,
    HOW_MANY_SHOWN,
  );

  // Counted against the shared calendar only. Profile dates are the member's
  // own and say nothing about whether WCCC's list needs next year's dates.
  const remainingCalendar = complianceItems.filter((i) => daysUntil(i.date, now) >= 0).length;
  const needsRefresh = remainingCalendar < NEEDS_REFRESH_THRESHOLD;

  return (
    <div>
      <p className="text-sm leading-6 text-slate-600">
        {filteredOut > 0
          ? "Filing deadlines, narrowed to the ones that look like yours based on your Business Snapshot. Confirm your own dates with the agency."
          : "Wisconsin and federal filing deadlines. Not all of these apply to every business — each one says who it's for. Confirm your own dates with the agency."}
      </p>

      {lapsed.length > 0 && (
        <div className="mt-4 rounded-[8px] border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-red-700">
            Needs your attention
          </p>
          <ul className="mt-2 space-y-1">
            {lapsed.map((item) => (
              <li key={item.key} className="text-sm leading-6 text-red-800">
                <span className="font-bold">{item.title}</span> — {formatDate(item.date)}, which
                has passed. Update it in your Business Snapshot, or confirm it&apos;s renewed.
              </li>
            ))}
          </ul>
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No dates on file. The deadline list needs updating — email info@wisccc.org.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {upcoming.map((item) => (
            <DeadlineRow key={item.key} item={item} days={daysUntil(item.date, now)} />
          ))}
        </ul>
      )}

      {/* Filtering is stated, not silent: a member who can't tell that rows
          were removed has no way to spot it being wrong. */}
      {filteredOut > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {filteredOut} filing{filteredOut === 1 ? "" : "s"} hidden because your profile says
          {filteredOut === 1 ? " it doesn't" : " they don't"} apply to you.
          {totalUpcoming > upcoming.length &&
            ` Showing the next ${upcoming.length} of ${totalUpcoming}.`}
        </p>
      )}

      {/* Shown to members too, not hidden in a log: a calendar quietly running
          out of dates is exactly how this feature would rot unnoticed. */}
      {needsRefresh && (
        <p className="mt-4 rounded-[8px] border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Only {remainingCalendar} deadline{remainingCalendar === 1 ? "" : "s"} left on file —
          this calendar needs next year&apos;s dates added. Email info@wisccc.org if it looks out
          of date.
        </p>
      )}

      <p className="mt-4 text-xs text-slate-400">Dates last checked {formatDate(LAST_VERIFIED)}</p>
    </div>
  );
}

/**
 * Compliance deadlines for Wisconsin small businesses.
 *
 * Deliberately a list of explicit, individually dated occurrences rather than
 * recurrence rules the app computes. A calendar that tells an owner the wrong
 * filing date is worse than having no calendar at all, and rule-based date
 * maths is where that goes wrong — quarter boundaries, weekend shifts, and
 * federal holidays each add a way to be quietly off by a day. Every date below
 * was checked against a published source, and adding next year's dates is a
 * deliberate act by a person rather than something a loop guesses.
 *
 * Maintaining this: when the list runs low the dashboard panel says so on
 * screen (see NEEDS_REFRESH_THRESHOLD in components/ComplianceCalendar.tsx).
 * Add the following year's dates, confirm each against the agency, and move
 * LAST_VERIFIED forward.
 */

/** When a person last checked these dates against the sources. */
export const LAST_VERIFIED = "2026-07-30";

export type ComplianceItem = {
  key: string;
  /** ISO date (YYYY-MM-DD). Treated as a calendar date, not an instant. */
  date: string;
  title: string;
  /** Who this actually applies to — shown on screen so nobody assumes it's them. */
  appliesTo: string;
  detail: string;
  sourceName: string;
  sourceUrl: string;
};

/**
 * Wisconsin annual reports are due by the end of the calendar quarter
 * containing the entity's formation anniversary: formed Jan–Mar → 31 March,
 * Apr–Jun → 30 June, Jul–Sep → 30 September, Oct–Dec → 31 December. Foreign
 * entities (formed in another state, then registered here) are due 31 March
 * regardless. The first report is due the year after formation. Wisconsin does
 * not grant extensions.
 *
 * Because that date depends on when the member's entity was formed — which the
 * portal doesn't collect — all four quarter-ends are listed, each labelled
 * with who it applies to, rather than guessing at one.
 */
const WI_DFI_SOURCE = {
  sourceName: "Wisconsin DFI — Corporations Bureau",
  sourceUrl: "https://www.wdfi.org/corporations/",
};

const IRS_SOURCE = {
  sourceName: "IRS",
  sourceUrl: "https://www.irs.gov/businesses/small-businesses-self-employed",
};

export const complianceItems: ComplianceItem[] = [
  {
    key: "941-q2-2026",
    date: "2026-07-31",
    title: "Form 941 — Q2 payroll tax return",
    appliesTo: "Businesses with employees",
    detail:
      "Quarterly federal payroll tax return covering April–June. Employers who deposited all taxes in full and on time generally get 10 extra days.",
    ...IRS_SOURCE,
  },
  {
    key: "est-tax-q3-2026",
    date: "2026-09-15",
    title: "Federal estimated tax — Q3 payment",
    appliesTo: "Owners paying themselves without withholding",
    detail:
      "Third quarterly estimated payment for the 2026 tax year. Sole proprietors, partners, and most LLC owners pay this rather than having tax withheld.",
    ...IRS_SOURCE,
  },
  {
    key: "wi-annual-q3-2026",
    date: "2026-09-30",
    title: "Wisconsin annual report",
    appliesTo: "LLCs and corporations formed July–September",
    detail:
      "Due by the end of the calendar quarter containing your formation anniversary. $25 online, $40 by mail. Wisconsin does not grant extensions.",
    ...WI_DFI_SOURCE,
  },
  {
    key: "941-q3-2026",
    date: "2026-11-02",
    title: "Form 941 — Q3 payroll tax return",
    appliesTo: "Businesses with employees",
    detail:
      "Covers July–September. Normally 31 October, moved to the next business day because that date falls on a Saturday in 2026.",
    ...IRS_SOURCE,
  },
  {
    key: "wi-annual-q4-2026",
    date: "2026-12-31",
    title: "Wisconsin annual report",
    appliesTo: "LLCs and corporations formed October–December",
    detail:
      "Due by the end of the calendar quarter containing your formation anniversary. $25 online, $40 by mail.",
    ...WI_DFI_SOURCE,
  },
  {
    key: "est-tax-q4-2026",
    date: "2027-01-15",
    title: "Federal estimated tax — Q4 payment",
    appliesTo: "Owners paying themselves without withholding",
    detail: "Final quarterly estimated payment for the 2026 tax year.",
    ...IRS_SOURCE,
  },
  {
    key: "941-q4-2026",
    date: "2027-02-01",
    title: "Form 941 — Q4 payroll tax return",
    appliesTo: "Businesses with employees",
    detail:
      "Covers October–December. Normally 31 January, moved to the next business day because that date falls on a Sunday.",
    ...IRS_SOURCE,
  },
  {
    key: "wi-annual-q1-2027",
    date: "2027-03-31",
    title: "Wisconsin annual report",
    appliesTo: "LLCs and corporations formed January–March, and all foreign entities",
    detail:
      "Entities formed in another state and registered in Wisconsin file by 31 March regardless of when they registered.",
    ...WI_DFI_SOURCE,
  },
  {
    key: "est-tax-q1-2027",
    date: "2027-04-15",
    title: "Federal estimated tax — Q1 payment",
    appliesTo: "Owners paying themselves without withholding",
    detail: "First quarterly estimated payment for the 2027 tax year.",
    ...IRS_SOURCE,
  },
  {
    key: "wi-annual-q2-2027",
    date: "2027-06-30",
    title: "Wisconsin annual report",
    appliesTo: "LLCs and corporations formed April–June",
    detail:
      "Due by the end of the calendar quarter containing your formation anniversary. $25 online, $40 by mail.",
    ...WI_DFI_SOURCE,
  },
];

/**
 * Parses an ISO calendar date to UTC midnight.
 *
 * `new Date("2026-09-15")` is already UTC midnight, but `new Date(2026, 8, 15)`
 * is local midnight — mixing the two shifts dates by a day for anyone west of
 * UTC, which is every member this serves. Everything here stays in UTC so a
 * deadline lands on the same calendar day regardless of where it's rendered.
 */
export function parseComplianceDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Whole days from `now` until `iso`. Negative once the date has passed. */
export function daysUntil(iso: string, now: Date): number {
  const target = parseComplianceDate(iso);
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Upcoming items only (today counts as upcoming), soonest first. */
export function upcomingCompliance(now: Date, limit?: number): ComplianceItem[] {
  const upcoming = complianceItems
    .filter((item) => daysUntil(item.date, now) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  return typeof limit === "number" ? upcoming.slice(0, limit) : upcoming;
}

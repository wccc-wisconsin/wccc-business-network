import {
  complianceItems,
  daysUntil,
  parseComplianceDate,
  type ComplianceAudience,
  type ComplianceItem,
} from "@/data/compliance";
import { factDefinition } from "@/data/facts";
import type { MemberFact } from "@/lib/appStore";

/**
 * One member's deadline list: the shared filing calendar narrowed to the ones
 * that actually apply to them, plus the dates only they know about.
 *
 * The shared calendar in data/compliance.ts can't know whether a member runs
 * payroll or when their entity was formed, so it lists everything and labels
 * each row with who it's for. That was the honest thing to do with no facts on
 * file — but it means a solo caterer reads seven rows to find the two that are
 * hers. Now that the portal collects those facts, it can do the reading.
 *
 * Two rules govern everything below:
 *
 * 1. Uncertainty shows the row. A fact that's missing, or set to "not sure",
 *    leaves an item in the list flagged `unknown`. The cost of hiding a filing
 *    that turned out to apply is a penalty; the cost of showing one that
 *    didn't is a few seconds. Those are not comparable, so they aren't
 *    weighted equally.
 *
 * 2. No date is ever invented. Renewal items come from dates the member typed.
 *    Nothing is rolled forward a year on their behalf — a lapsed date is
 *    surfaced as lapsed and left for them to correct, because a confidently
 *    wrong renewal date is worse than an obviously stale one.
 */

export type DeadlineCertainty = "applies" | "unknown";

export type MemberDeadline = {
  key: string;
  date: string;
  title: string;
  appliesTo: string;
  detail: string;
  sourceName?: string;
  sourceUrl?: string;
  /** Shared filing calendar, or a date this member gave us. */
  origin: "calendar" | "profile";
  certainty: DeadlineCertainty;
  /** True when a profile date has already passed and needs updating. */
  lapsed?: boolean;
};

/** Calendar quarter (1-4) containing an ISO date, or null if unparseable. */
function quarterOf(iso: string): 1 | 2 | 3 | 4 | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const month = Number(iso.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

function value(facts: Record<string, MemberFact>, key: string): string | null {
  const raw = facts[key]?.value?.trim();
  return raw ? raw : null;
}

/**
 * Whether one calendar item applies to this member.
 *
 * Returns "no" only when a fact positively rules it out. Everything else is
 * "applies" or "unknown", per rule 1 above.
 */
function audienceVerdict(
  audience: ComplianceAudience,
  facts: Record<string, MemberFact>,
): "applies" | "no" | "unknown" {
  if (audience.kind === "employers") {
    const who = value(facts, "has_employees");
    if (!who) return "unknown";
    // Contractors are 1099 and don't create a payroll-tax filing; only W-2
    // people do. "both" covers a business with each.
    if (who === "w2" || who === "both") return "applies";
    if (who === "none" || who === "contractors") return "no";
    return "unknown";
  }

  if (audience.kind === "estimated-tax") {
    const pays = value(facts, "pays_estimated_tax");
    if (pays === "yes") return "applies";
    if (pays === "no") return "no";
    return "unknown";
  }

  // Annual report. Foreign entities file 31 March regardless of when they
  // registered, so that check comes first and settles the question on its own.
  const formedIn = value(facts, "formation_state");
  if (formedIn === "other") {
    return audience.includesForeign ? "applies" : "no";
  }

  const formationDate = value(facts, "formation_date");
  if (!formationDate) return "unknown";

  const quarter = quarterOf(formationDate);
  if (quarter === null) return "unknown";

  // A Wisconsin entity files in the quarter containing its formation
  // anniversary. Known formation state and date settle this exactly, which is
  // why this is the one filter that can confidently remove three of four rows.
  if (quarter !== audience.quarter) return "no";
  // The quarter matches, but a foreign-entity row reached here only because
  // we don't know where they were formed — so it's a maybe, not a yes.
  return formedIn === "wi" || !audience.includesForeign ? "applies" : "unknown";
}

function fromCalendar(item: ComplianceItem, facts: Record<string, MemberFact>): MemberDeadline | null {
  if (!item.audience) {
    return { ...item, origin: "calendar", certainty: "applies" };
  }
  const verdict = audienceVerdict(item.audience, facts);
  if (verdict === "no") return null;
  return { ...item, origin: "calendar", certainty: verdict };
}

/** Adds whole years to an ISO date, normalising 29 February to 1 March. */
function addYears(iso: string, years: number): string {
  const base = parseComplianceDate(iso);
  const shifted = new Date(
    Date.UTC(base.getUTCFullYear() + years, base.getUTCMonth(), base.getUTCDate()),
  );
  return shifted.toISOString().slice(0, 10);
}

/**
 * Deadlines built from the member's own dates.
 *
 * Each entry names the fact it came from, so a wrong date is traceable to the
 * field the member can fix rather than looking like the portal made it up.
 */
type RenewalSpec = {
  factKey: string;
  title: string;
  appliesTo: string;
  detail: string;
  /** Adds this many years to the stored date. 0 means the date is the deadline. */
  addYears: number;
  sourceName?: string;
  sourceUrl?: string;
};

const renewalSpecs: RenewalSpec[] = [
  {
    factKey: "insurance_renewal_date",
    title: "Business insurance renews",
    appliesTo: "Your policy",
    detail:
      "Worth quoting against other carriers a month out — renewal is when you have the most leverage and the least time pressure.",
    addYears: 0,
  },
  {
    factKey: "license_renewal_date",
    title: "Industry licence or permit expires",
    appliesTo: "Your licence",
    detail:
      "Trading on an expired licence is the kind of gap that stops a job mid-contract. Confirm the renewal window with the issuing agency.",
    addYears: 0,
  },
  {
    factKey: "certification_renewal_date",
    title: "Certification comes up for renewal",
    appliesTo: "Your MBE / WBE / DBE / 8(a) status",
    detail:
      "Recertification usually needs current financials and ownership documents. Lapsing removes you from buyers' certified-vendor lists until it's restored.",
    addYears: 0,
  },
  {
    factKey: "sam_registration_date",
    title: "SAM.gov registration expires",
    appliesTo: "Federal contracting eligibility",
    detail:
      "SAM registration must be renewed every 12 months. This date is 12 months on from the last renewal you recorded. An expired registration makes you ineligible for federal awards, and it lapses without warning.",
    addYears: 1,
    sourceName: "SAM.gov",
    sourceUrl: "https://sam.gov/",
  },
  {
    factKey: "lease_end_date",
    title: "Lease ends",
    appliesTo: "Your premises",
    detail:
      "Start renewal or relocation conversations well ahead of this — options narrow sharply in the final weeks.",
    addYears: 0,
  },
];

function fromProfile(facts: Record<string, MemberFact>, now: Date): MemberDeadline[] {
  const out: MemberDeadline[] = [];

  for (const spec of renewalSpecs) {
    const def = factDefinition(spec.factKey);
    const stored = value(facts, spec.factKey);
    if (!def || !stored || !/^\d{4}-\d{2}-\d{2}$/.test(stored)) continue;

    const date = spec.addYears === 0 ? stored : addYears(stored, spec.addYears);
    const days = daysUntil(date, now);

    out.push({
      key: `profile-${spec.factKey}`,
      date,
      title: spec.title,
      appliesTo: spec.appliesTo,
      detail:
        days < 0
          ? `${spec.detail} This date has passed — update it in your Business Snapshot, or confirm it's been renewed.`
          : spec.detail,
      sourceName: spec.sourceName,
      sourceUrl: spec.sourceUrl,
      origin: "profile",
      certainty: "applies",
      lapsed: days < 0,
    });
  }

  return out;
}

export type MemberDeadlineView = {
  /** Upcoming items, soonest first, already trimmed to `limit`. */
  upcoming: MemberDeadline[];
  /** Profile dates that have already passed and need the member's attention. */
  lapsed: MemberDeadline[];
  /** How many calendar rows the member's facts removed as not applicable. */
  filteredOut: number;
  /** Total upcoming before the limit was applied. */
  totalUpcoming: number;
};

/**
 * The whole deadline picture for one member.
 *
 * `filteredOut` is returned so the UI can say "3 filings don't apply to you"
 * rather than silently showing a shorter list. A member who can't see that
 * filtering happened has no way to notice when it's wrong.
 */
export function deadlinesForMember(
  facts: Record<string, MemberFact>,
  now: Date,
  limit?: number,
): MemberDeadlineView {
  const calendar = complianceItems
    .map((item) => fromCalendar(item, facts))
    .filter((item): item is MemberDeadline => item !== null);

  const filteredOut = complianceItems.length - calendar.length;
  const all = [...calendar, ...fromProfile(facts, now)];

  const lapsed = all
    .filter((item) => daysUntil(item.date, now) < 0 && item.origin === "profile")
    .sort((a, b) => b.date.localeCompare(a.date));

  const upcoming = all
    .filter((item) => daysUntil(item.date, now) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    upcoming: typeof limit === "number" ? upcoming.slice(0, limit) : upcoming,
    lapsed,
    filteredOut,
    totalUpcoming: upcoming.length,
  };
}

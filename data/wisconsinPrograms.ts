/**
 * Wisconsin funding and business-support organizations — curated, not fetched.
 *
 * Grants.gov gives federal opportunities live (see lib/grantsGov.ts). Wisconsin
 * has no equivalent: WEDC, WWBIC, the SBDC, DFI, WHEDA and SCORE publish web
 * pages, not an API. So this half of the catalog is a hand-maintained file, and
 * a hand-maintained file has one specific way of going wrong — it keeps
 * confidently describing a program for years after the program ended.
 *
 * Three rules keep that from reaching a member:
 *
 * 1. NOTHING IS SHOWN UNTIL A HUMAN AT WCCC CHECKS IT. Every entry ships with
 *    `verified: false`, and `activeWisconsinPrograms()` returns only verified
 *    ones. The catalog builder and the AI prompt both read through that
 *    function, so an unverified entry is not merely hidden from the UI — it is
 *    never given to the model either, and therefore cannot be described,
 *    paraphrased, or "helpfully" mentioned. Until someone reviews this file,
 *    the Wisconsin half of the panel is empty and says so. That is the intended
 *    behaviour, not a bug and not an unfinished state.
 *
 * 2. VERIFICATION EXPIRES. `lastVerified` plus STALE_AFTER_DAYS: an entry
 *    checked eighteen months ago is not a checked entry, it is an old one. Once
 *    it lapses it drops out of the catalog exactly as though it had never been
 *    verified, and re-appears when someone re-checks it. This is the same
 *    principle as `staleAfterDays` on the member facts in data/facts.ts, for
 *    the same reason.
 *
 * 3. ORGANISATIONS AND STANDING SERVICES, NOT NAMED TIME-LIMITED PROGRAMS.
 *    "WWBIC provides microloans" stays true across funding cycles. "The 2026
 *    XYZ Grant, applications close March 14" is true for about five months and
 *    false forever after. Entries below deliberately describe what an
 *    organisation does and where to look, and leave specific current programs
 *    and deadlines to the organisation's own site — which is always linked, and
 *    is always more current than this file can be.
 *
 * On 2026-08-23 every URL below was fetched and each description was checked
 * against what the organisation says about itself, correcting three that were
 * wrong or unsupported (SCORE's workshops are free rather than low-cost; the
 * claim that WWBIC is a CDFI could not be confirmed and was removed; the
 * supplier-diversity entry pointed at a department front page instead of the
 * program). That was a machine reading a web page, which is a starting point
 * and not a sign-off — it cannot judge whether an organisation is the right
 * referral for a WCCC member, and a page can say a program exists long after
 * the money for it has gone. So every `verified` below is still `false`, and
 * flipping one stays a person's decision.
 *
 * See WISCONSIN-PROGRAMS-REVIEW.md for the checklist, which records what that
 * pre-check found for each entry.
 *
 * To verify an entry: open its `url`, confirm the organisation still offers
 * roughly what the description says, then set `verified: true` and
 * `lastVerified` to today's date in YYYY-MM-DD. Never set `verified: true`
 * without opening the page — an unverified entry costs a member nothing,
 * and a wrong one costs them a wasted application.
 */

export type WisconsinProgramType = "Grant" | "Loan" | "Certification" | "Program" | "Advising";

export type WisconsinProgram = {
  /** Stable identifier. Never reuse one for a different organisation. */
  id: string;
  name: string;
  type: WisconsinProgramType;
  /** What they do and who it is for. One or two sentences, no deadlines. */
  description: string;
  /** Official page. Members are sent here rather than to a summary of it. */
  url: string;
  /**
   * YYYY-MM-DD a person at WCCC last opened the URL and confirmed the entry.
   * Null means never — which is where every entry starts.
   */
  lastVerified: string | null;
  /**
   * Set to true ONLY by a human who has just checked the URL. This is the
   * single switch between "drafted" and "shown to members as fact".
   */
  verified: boolean;
};

/**
 * How long a verification stands before the entry drops out of the catalog.
 *
 * Six months. Short enough that a program discontinued in the spring is gone by
 * the autumn; long enough that reviewing this file is a twice-a-year job rather
 * than a chore anyone starts resenting. A review cadence people abandon is
 * worse than a slightly longer one they keep.
 */
export const STALE_AFTER_DAYS = 180;

export const wisconsinPrograms: WisconsinProgram[] = [
  {
    id: "wedc",
    name: "Wisconsin Economic Development Corporation (WEDC)",
    type: "Program",
    description:
      "The state's economic development agency. Runs grant and loan programs for Wisconsin businesses, including entrepreneurship and small-business support, and publishes which are currently open.",
    url: "https://wedc.org/",
    lastVerified: null,
    verified: false,
  },
  {
    id: "wwbic",
    name: "Wisconsin Women's Business Initiative Corporation (WWBIC)",
    type: "Loan",
    description:
      "Business loans, business and personal finance training, coaching, and post-loan support. Despite the name it serves entrepreneurs generally, with six regional offices covering the state.",
    url: "https://www.wwbic.com/",
    lastVerified: null,
    verified: false,
  },
  {
    id: "wisconsin-sbdc",
    name: "Wisconsin Small Business Development Center (SBDC)",
    type: "Advising",
    description:
      "No-cost, confidential consulting and business education from a nationally accredited network, based at Universities of Wisconsin campuses. Covers starting a business, securing financing, and growth.",
    url: "https://wisconsinsbdc.org/",
    lastVerified: null,
    verified: false,
  },
  {
    id: "wheda",
    name: "Wisconsin Housing and Economic Development Authority (WHEDA)",
    type: "Loan",
    description:
      "State authority focused primarily on affordable housing, whose economic development side provides small-business and agricultural loan guarantees. Arranged through a partner lender rather than directly.",
    url: "https://www.wheda.com/",
    lastVerified: null,
    verified: false,
  },
  {
    id: "wisconsin-dfi",
    name: "Wisconsin Department of Financial Institutions (DFI)",
    type: "Program",
    description:
      "Where Wisconsin entities are registered and annual reports filed. Its Business Entity Search and Certificate of Status are how a member confirms good standing before applying for funding that requires it.",
    url: "https://dfi.wi.gov/",
    lastVerified: null,
    verified: false,
  },
  {
    id: "score-wisconsin",
    name: "SCORE — Wisconsin chapters",
    type: "Advising",
    description:
      "Free mentoring from experienced business volunteers, for the life of the business, plus free workshops and webinars. Local chapters across Wisconsin; funded in part by the SBA.",
    url: "https://www.score.org/",
    lastVerified: null,
    verified: false,
  },
  {
    id: "sba-wisconsin",
    name: "U.S. Small Business Administration — Wisconsin District Office",
    type: "Loan",
    description:
      "SBA funding programs arranged through participating lenders, plus counselling, federal contracting certifications, and disaster recovery. The Milwaukee district office covers all 72 Wisconsin counties.",
    url: "https://www.sba.gov/district/wisconsin",
    lastVerified: null,
    verified: false,
  },
  {
    id: "wisconsin-supplier-diversity",
    name: "Wisconsin Supplier Diversity Program certification",
    type: "Certification",
    description:
      "State certification as an MBE, WBE, or service-disabled-veteran-owned business, for firms at least 51% owned, managed and controlled by qualifying owners. Opens state contracting opportunities; certified DVB firms may receive a 5% bid preference.",
    url: "https://supplierdiversity.wi.gov/Pages/Home.aspx",
    lastVerified: null,
    verified: false,
  },
  {
    id: "county-revolving-loan-funds",
    name: "County and municipal revolving loan funds",
    type: "Loan",
    description:
      "Many Wisconsin counties and cities operate their own small revolving loan funds for local businesses, with terms and eligibility set locally. Availability varies by county — check with the county's economic development office.",
    url: "https://wedc.org/",
    lastVerified: null,
    verified: false,
  },
];

/**
 * The entries that may be shown to a member: verified by a person, and verified
 * recently enough that the verification still means something.
 *
 * Everything that reads this file goes through here — the catalog builder, the
 * AI prompt, and the UI. Reading `wisconsinPrograms` directly anywhere else
 * would defeat rules 1 and 2 above, so don't.
 */
export function activeWisconsinPrograms(now = new Date()): WisconsinProgram[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - STALE_AFTER_DAYS);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  return wisconsinPrograms.filter(
    (program) => program.verified && program.lastVerified !== null && program.lastVerified >= cutoffIso,
  );
}

/**
 * The most recent verification date across the active entries, for the "last
 * checked" line the panel shows. Null when nothing is active, which is the
 * state the file ships in.
 */
export function wisconsinLastVerified(now = new Date()): string | null {
  const active = activeWisconsinPrograms(now);
  if (active.length === 0) return null;

  return active.reduce<string>(
    (latest, program) => (program.lastVerified! > latest ? program.lastVerified! : latest),
    active[0].lastVerified!,
  );
}

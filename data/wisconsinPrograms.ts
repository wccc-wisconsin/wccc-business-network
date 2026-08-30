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
 * 1. NOTHING IS SHOWN UNTIL A HUMAN AT WCCC CHECKS IT. A new entry is written
 *    with `verified: false`, and `activeWisconsinPrograms()` returns only
 *    verified ones. The catalog builder and the AI prompt both read through
 *    that function, so an unverified entry is not merely hidden from the UI —
 *    it is never given to the model either, and therefore cannot be described,
 *    paraphrased, or "helpfully" mentioned. An empty Wisconsin panel is the
 *    intended behaviour of an unreviewed file, not a bug and not an unfinished
 *    state. Add an entry and it stays invisible until somebody says otherwise.
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
 * These eight were checked three times before any of them was shown to anyone:
 * machine-read against their own sites on 2026-08-23 and again on 2026-08-28,
 * then re-read on 2026-08-29 and signed off by WCCC as organisations it would
 * actually send a member to. That last part is the one a machine cannot do —
 * a page can say a program exists long after the money for it has gone, and
 * nothing on a website says whether a chamber would make the referral.
 *
 * The 2026-08-29 pass changed two descriptions rather than merely confirming
 * them, which is the argument for doing it at all:
 *
 *   - **Supplier diversity.** The stored text said the 5% bid preference was
 *     for DVB firms only, which is what the program's own home page says. The
 *     State Procurement Manual (PRO-606) has it as a *permissive* MBE/DVB
 *     preference with the MBE half currently paused. Rather than store a figure
 *     with a moving part in it, the entry now points at the policy. A number
 *     that is right today and paused tomorrow is precisely rule 3's problem.
 *   - **WEDC.** "publishes which are currently open" could not be confirmed —
 *     the programs directory renders client-side and served no open/closed
 *     labels to check. Softened to what is visible.
 *
 * A ninth entry, "county and municipal revolving loan funds", was dropped in
 * that pass instead of being verified. It was a category rather than an
 * organisation: no single web page describes it, and it pointed at WEDC as a
 * stand-in, so a member clicking it landed somewhere that does not run the
 * thing they clicked. Per-county entries for the counties WCCC members are
 * actually in would be the useful version, and each needs its own confirmation.
 *
 * See WISCONSIN-PROGRAMS-REVIEW.md for the checklist and what each pass found.
 *
 * To verify an entry: open its `url`, confirm the organisation still offers
 * roughly what the description says, then set `verified: true` and
 * `lastVerified` to today's date in YYYY-MM-DD. Never set `verified: true`
 * without opening the page — an unverified entry costs a member nothing,
 * and a wrong one costs them a wasted application.
 */

export type WisconsinProgramType = "Grant" | "Loan" | "Certification" | "Program" | "Advising";

/**
 * A condition a member has to meet for an entry to be worth showing them.
 *
 * The same shape and the same purpose as `ComplianceAudience` in
 * data/compliance.ts: a claim about who something is for, written so it can be
 * checked against the facts in data/facts.ts rather than only read by a human.
 * `fitNote` below is the sentence a person reads; this is the machine-checkable
 * half, and the two must agree.
 *
 * Kept deliberately small. Only two of the eight entries carry one, because
 * only two have a condition that is genuinely disqualifying rather than merely
 * a matter of degree — and a requirement invented to make the list look
 * thorough would filter members away from help on a guess. Everything softer
 * than "this cannot work for you" belongs in `fitNote`, where the model can
 * weigh it instead of the code enforcing it.
 */
export type WisconsinRequirement =
  /**
   * The member's ownership has to qualify them for the certification. Anything
   * other than "none" passes, including "decline" and an unanswered question —
   * see wisconsinFit.ts. A certification nobody can use is a wasted click; a
   * certification withheld from someone who qualifies is a lost contract.
   */
  | { kind: "qualifying-ownership" }
  /**
   * The product is arranged through the member's own lender rather than
   * applied for directly, so a member with no banking relationship cannot use
   * it yet. `bank_account` is the closest thing the portal asks, and its own
   * `purpose` line already says lenders treat it as a gate.
   */
  | { kind: "lender-relationship" };

export type WisconsinProgram = {
  /** Stable identifier. Never reuse one for a different organisation. */
  id: string;
  name: string;
  type: WisconsinProgramType;
  /** What they do and who it is for. One or two sentences, no deadlines. */
  description: string;
  /**
   * Who this actually suits, and who it wastes time for. Shown to the model
   * alongside the description, never to the member as fact.
   *
   * The description says what an organisation *is*, which is the part a member
   * could have found themselves. This is the part a chamber knows and a search
   * result does not: that WHEDA is no use before you have a lender, that the
   * SBDC is rarely a wrong referral, that certification opens nothing on its
   * own. Without it the matcher is inferring suitability from a one-line
   * summary, which it will do fluently and often wrongly.
   *
   * Same rule as `description`: no dates, no dollar figures, no percentages
   * that are not the statutory ownership test. It is checked by the same test.
   */
  fitNote: string;
  /**
   * Conditions that disqualify a member, checked in code before the model sees
   * the catalog. Absent means the entry suits anyone — which is true of six of
   * the eight.
   */
  requirements?: WisconsinRequirement[];
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
      "The state's economic development agency. Runs grant and loan programs for Wisconsin businesses, including entrepreneurship and small-business support, and lists what it currently offers in its Programs directory.",
    fitNote:
      "A directory of state programs rather than one product, so it suits a member who already knows what they are trying to fund. Someone still deciding whether to form a business is better served by the SBDC or SCORE first — WEDC will not tell them what to look for.",
    url: "https://wedc.org/",
    lastVerified: "2026-08-29",
    verified: true,
  },
  {
    id: "wwbic",
    name: "Wisconsin Women's Business Initiative Corporation (WWBIC)",
    type: "Loan",
    description:
      "Business loans, business and personal finance training, coaching, and post-loan support. Despite the name it serves entrepreneurs generally, with six regional offices covering the state.",
    fitNote:
      "The right first call for an owner a bank has declined, or who has no lending history to show one. It lends directly and pairs the loan with coaching, so unlike a guarantee it needs no existing banking relationship — which makes it the most useful entry here for a newly formed or cash-only business.",
    url: "https://www.wwbic.com/",
    lastVerified: "2026-08-29",
    verified: true,
  },
  {
    id: "wisconsin-sbdc",
    name: "Wisconsin Small Business Development Center (SBDC)",
    type: "Advising",
    description:
      "No-cost, confidential consulting and business education from a nationally accredited network, based at Universities of Wisconsin campuses. Covers starting a business, securing financing, and growth.",
    fitNote:
      "Rarely a wrong referral: it costs nothing, covers every stage, and the consulting is open-ended rather than tied to a product. Most valuable to a member who cannot yet name what they need, which is exactly the member who gets least from a funding list.",
    url: "https://wisconsinsbdc.org/",
    lastVerified: "2026-08-29",
    verified: true,
  },
  {
    id: "wheda",
    name: "Wisconsin Housing and Economic Development Authority (WHEDA)",
    type: "Loan",
    description:
      "State authority focused primarily on affordable housing, whose economic development side provides small-business and agricultural loan guarantees. Arranged through a partner lender rather than directly.",
    fitNote:
      "A guarantee that sits behind a loan from the member's own lender, not something a member applies for directly. Of no use to someone who has not yet got a banking relationship or a lender in mind — for them WWBIC is the entry that works.",
    url: "https://www.wheda.com/",
    lastVerified: "2026-08-29",
    verified: true,
    requirements: [{ kind: "lender-relationship" }],
  },
  {
    id: "wisconsin-dfi",
    name: "Wisconsin Department of Financial Institutions (DFI)",
    type: "Program",
    description:
      "Where Wisconsin entities are registered and annual reports filed. Its Business Entity Search and Certificate of Status are how a member confirms good standing before applying for funding that requires it.",
    fitNote:
      "Not a funding source, and applies to every registered entity plus anyone about to become one. The reason to send a member here is a filing, a name check, or proving good standing — which several funders ask for before they will look at an application.",
    url: "https://dfi.wi.gov/",
    lastVerified: "2026-08-29",
    verified: true,
  },
  {
    id: "score-wisconsin",
    name: "SCORE — Wisconsin chapters",
    type: "Advising",
    description:
      "Free mentoring from experienced business volunteers, for the life of the business, plus free workshops and webinars. Local chapters across Wisconsin; funded in part by the SBA.",
    fitNote:
      "The lowest-commitment referral on this list: free, open-ended, and no application. Suits an owner who wants a sounding board rather than a product, and costs them nothing if it turns out not to help.",
    url: "https://www.score.org/",
    lastVerified: "2026-08-29",
    verified: true,
  },
  {
    id: "sba-wisconsin",
    name: "U.S. Small Business Administration — Wisconsin District Office",
    type: "Loan",
    description:
      "SBA funding programs arranged through participating lenders, plus counselling, federal contracting certifications, and disaster recovery. The Milwaukee district office covers all 72 Wisconsin counties.",
    fitNote:
      "Three different things behind one door — lender-arranged loans, free counselling, and federal contracting certification. Which half matters depends on whether the member is chasing money, advice, or government work, so it is worth naming which one when recommending it.",
    url: "https://www.sba.gov/district/wisconsin",
    lastVerified: "2026-08-29",
    verified: true,
  },
  {
    id: "wisconsin-supplier-diversity",
    name: "Wisconsin Supplier Diversity Program certification",
    type: "Certification",
    description:
      "State certification as a minority-owned (MBE), woman-owned (WBE) or service-disabled-veteran-owned (DVB) business, for firms at least 51% owned, managed and controlled by qualifying owners. Opens state contracting opportunities; bid preferences are set by state procurement policy and are changed and paused from time to time, so confirm the current rule with the program rather than relying on a figure.",
    fitNote:
      "Only worth pursuing by an owner whose ownership qualifies and who actually wants to sell to state government. Certification opens nothing by itself — it is a prerequisite for bidding, not a benefit — so it is a poor recommendation for a member whose customers are all private.",
    url: "https://supplierdiversity.wi.gov/Pages/Home.aspx",
    lastVerified: "2026-08-29",
    verified: true,
    requirements: [{ kind: "qualifying-ownership" }],
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
 * The last date on which the soonest-lapsing entry is still shown, or null
 * when nothing is active.
 *
 * The boundary is inclusive, matching `activeWisconsinPrograms`: an entry
 * verified on L is shown through L + STALE_AFTER_DAYS and is gone the day
 * after. So this is the last good day, not the first bad one — which is the
 * date a person needs, because it is the deadline they are working to.
 *
 * Exists so the 180-day arithmetic lives in exactly one file. The test that
 * warns before expiry reads it, and anything that ever wants to show a
 * countdown should read it too rather than recomputing the offset.
 */
export function wisconsinVerificationExpiry(now = new Date()): string | null {
  const active = activeWisconsinPrograms(now);
  if (active.length === 0) return null;

  const earliest = active.reduce<string>(
    (soonest, program) => (program.lastVerified! < soonest ? program.lastVerified! : soonest),
    active[0].lastVerified!,
  );

  const expires = new Date(`${earliest}T00:00:00.000Z`);
  expires.setUTCDate(expires.getUTCDate() + STALE_AFTER_DAYS);
  return expires.toISOString().slice(0, 10);
}

/**
 * Why the Wisconsin half of the catalog is empty, when it is.
 *
 * Three states that used to share one sentence on screen, and they need
 * different things from different people:
 *
 *   - `ok`         — there are entries to show.
 *   - `expired`    — entries were verified and the verification has lapsed.
 *                    Someone re-reads eight pages and bumps a date.
 *   - `unreviewed` — nothing here has ever been signed off. Someone at WCCC
 *                    decides whether these are organisations to send a member
 *                    to, which is a different and slower conversation.
 *
 * Telling a member "awaiting review by WCCC" when the truth is "our check
 * lapsed in February" points them at the wrong person and makes the portal
 * look unfinished rather than out of date.
 */
export function wisconsinCatalogState(now = new Date()): "ok" | "expired" | "unreviewed" {
  if (activeWisconsinPrograms(now).length > 0) return "ok";

  // Verified-but-undated is impossible in practice — the filter drops it and a
  // test rejects it in the shipped data — but it is treated as unreviewed here
  // rather than expired, because a missing date is not evidence of a lapse.
  const everVerified = wisconsinPrograms.some(
    (program) => program.verified && program.lastVerified !== null,
  );

  return everVerified ? "expired" : "unreviewed";
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

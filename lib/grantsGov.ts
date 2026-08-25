import "server-only";

/**
 * Grants.gov Search2 — live federal funding opportunities.
 *
 * Why this file exists: /api/ai/opportunities used to ask Claude to name five
 * funding programs from memory. The prompt was carefully written and hedged
 * against invention, but recall is still recall — a model's training data has a
 * cutoff, federal grant cycles do not, and the failure mode is a member being
 * shown a program that closed last year as though it were open. Nothing in the
 * old design could catch that, because there was nothing to check the answer
 * against.
 *
 * This gives the model a real list to choose from instead. Search2 is a free
 * POST endpoint with no API key and no signup, documented at
 * https://grants.gov/api/common/search2.
 *
 * This was originally written without a live call — the sandboxes it was built
 * in block api.grants.gov at the network layer — so the shapes came from the
 * published documentation and the code table at
 * https://www.grants.gov/api/status-codes rather than from an observed
 * response. `scripts/check-grants-api.mjs` was written to close that gap, and
 * on 2026-08-23 it was run against the live endpoint. Result:
 *
 *   - The response envelope, `oppHits` fields, MM/DD/YYYY close dates, the
 *     status filter and both eligibility codes all held.
 *   - One did not: the agency's display name arrives as `agency`, not
 *     `agencyName` as the documentation shows. Uncaught, this would have shown
 *     members "HHS-NIH11" where the agency name belongs — not broken, but
 *     wrong enough to matter on a card whose whole job is to be checkable.
 *     Fixed below, and `agencyName` is still read as a fallback in case some
 *     responses do use it.
 *
 * The live run also confirmed the eligibility reasoning: code 22 comes back
 * labelled "For profit organizations other than small businesses" and 25 as
 * "Others (see text field...)", which is exactly why neither is sent.
 *
 * Everything below still parses defensively and every failure returns
 * `ok: false` rather than throwing or guessing. Re-run the check script after
 * changing anything here.
 */

const SEARCH2_URL = "https://api.grants.gov/v1/api/search2";

/**
 * Latency budget.
 *
 * This matters more than it looks. /api/ai/opportunities now does a live HTTP
 * call *before* the Claude call, and the whole route runs inside one Vercel
 * function invocation with a platform timeout (10s by default on Hobby). A
 * per-request timeout alone is not enough: the fallback query means there can
 * be two of them, so an 8s ceiling per call is really a 16s ceiling before the
 * model has been asked anything, and the member gets a platform timeout page
 * rather than one of this file's polite error messages.
 *
 * So there are two limits. REQUEST_TIMEOUT_MS bounds any single call;
 * TOTAL_BUDGET_MS bounds both of them together and leaves the rest of the
 * invocation for Claude. Whichever is closer wins.
 */
const REQUEST_TIMEOUT_MS = 6000;
const TOTAL_BUDGET_MS = 9000;

/**
 * Below this much remaining budget the fallback query is skipped rather than
 * started. A query that will be aborted mid-flight costs the member the wait
 * and Grants.gov the work, and returns nothing to show for either.
 */
const MIN_FALLBACK_BUDGET_MS = 2500;

/**
 * Applicant eligibility codes, from https://www.grants.gov/api/status-codes.
 *
 * Only two are sent. The reasoning, because the omissions are the interesting
 * part:
 *
 *   23 — "Small businesses". The portal's entire audience.
 *   99 — "Unrestricted". Open to any entity type, so a small business qualifies.
 *
 * Deliberately NOT sent:
 *
 *   22 — "For-profit organizations other than small businesses". The label is
 *        explicit: this code means the opportunity excludes small businesses.
 *        Including it would surface grants WCCC members are barred from, which
 *        is worse than surfacing nothing.
 *   25 — "Others (see text field entitled 'Additional Information on
 *        Eligibility')". Unfilterable by construction — whether a member
 *        qualifies lives in prose the search endpoint does not return. Members
 *        would have to open every one to find out.
 *
 * This is why eligibility filtering matters more here than result volume: most
 * federal grants go to governments, universities and 501(c)(3)s, so an
 * unfiltered keyword search returns mostly opportunities a small business
 * cannot apply for.
 */
const ELIGIBILITY_SMALL_BUSINESS = "23";
const ELIGIBILITY_UNRESTRICTED = "99";
const ELIGIBILITIES = `${ELIGIBILITY_SMALL_BUSINESS}|${ELIGIBILITY_UNRESTRICTED}`;

/**
 * Expected labels for the codes above, checked against the facet the API
 * returns with each response (see `warnOnEligibilityDrift`).
 *
 * The codes are a published table, not a contract — if Grants.gov ever
 * renumbers them, this client would go on filtering happily on the wrong
 * meaning and nothing would look broken. Comparing what we sent against what
 * came back turns a silent wrong answer into a log line.
 */
const EXPECTED_ELIGIBILITY_LABELS: Record<string, string> = {
  [ELIGIBILITY_SMALL_BUSINESS]: "small business",
  [ELIGIBILITY_UNRESTRICTED]: "unrestricted",
};

/** Forecasted and posted only. "closed" and "archived" are the whole problem. */
const OPP_STATUSES = "forecasted|posted";

/** Asked for, before local filtering trims it. */
const ROWS = 25;

export type FederalGrant = {
  /** Grants.gov internal id — also the deep link target. */
  id: string;
  /** Public opportunity number, e.g. "USDA-NIFA-RBS-1234". */
  number: string;
  title: string;
  agencyName: string;
  /** ISO date, or null when the API gave nothing parseable. */
  closeDate: string | null;
  /** "posted" | "forecasted" — forecasted means not yet open for applications. */
  status: string;
  url: string;
};

type Search2Hit = {
  id?: unknown;
  number?: unknown;
  title?: unknown;
  /** The agency's display name. What the live endpoint actually sends. */
  agency?: unknown;
  /** What the documentation shows. Kept as a fallback — see the file header. */
  agencyName?: unknown;
  /** Short code, e.g. "HHS-NIH11". Last resort: it is not a readable name. */
  agencyCode?: unknown;
  closeDate?: unknown;
  oppStatus?: unknown;
};

export type GrantsResult =
  | { ok: true; grants: FederalGrant[] }
  | { ok: false; reason: string };

/**
 * Caching deliberately does not live in this file.
 *
 * It used to: an in-memory Map keyed by keyword, with an hour's TTL. The
 * comment on it conceded the problem — a serverless instance is ephemeral, so a
 * cold start began empty and nothing was shared between instances. At this
 * portal's traffic almost every request is a cold start, so it rarely hit.
 *
 * lib/grantsCache.ts now holds the policy, backed by the grants_cache table, and
 * this file is left as what it always should have been: a client that talks to
 * Search2 and parses the answer. That separation is why the tests here can mock
 * `fetch` alone and never touch Supabase.
 */

/**
 * Grants.gov returns dates as MM/DD/YYYY. `new Date(string)` would parse that
 * too, but it also cheerfully parses nonsense into an Invalid Date that only
 * surfaces later as "NaN" on screen, so the shape is checked first.
 *
 * Returns an ISO date (no time component — these are calendar deadlines, and
 * attaching a UTC midnight to them makes them display as the previous day for
 * anyone west of Greenwich, which includes every member).
 */
function parseGrantsDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, month, day, year] = match;
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;

  return `${year}-${month}-${day}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Compares the eligibility facet in the response against the codes we sent.
 * Console-only and best-effort — a mismatch is worth knowing about but is never
 * worth failing a member's request over, and the filter is still more right
 * than no filter even if a label moved.
 */
function warnOnEligibilityDrift(facet: unknown): void {
  try {
    if (!Array.isArray(facet)) return;

    for (const [code, expectedFragment] of Object.entries(EXPECTED_ELIGIBILITY_LABELS)) {
      const entry = facet.find(
        (item) => item && typeof item === "object" && asString((item as Record<string, unknown>).value) === code,
      ) as Record<string, unknown> | undefined;

      // Absent is normal: the facet only lists codes present in this result
      // set, and a narrow keyword can legitimately match neither.
      if (!entry) continue;

      const label = asString(entry.label).toLowerCase();
      if (label && !label.includes(expectedFragment)) {
        console.warn("grantsGov: eligibility code drift", {
          code,
          expectedToContain: expectedFragment,
          actualLabel: entry.label,
          action: "verify codes at https://www.grants.gov/api/status-codes",
        });
      }
    }
  } catch {
    // Ignore — a diagnostic must never break the thing it is diagnosing.
  }
}

/**
 * Drops anything whose deadline has already passed.
 *
 * Belt and braces on top of the `oppStatuses` filter: an opportunity's status
 * is updated by the posting agency, and "closed yesterday but still marked
 * posted" is exactly the kind of lag that would put a dead deadline in front of
 * a member. A missing close date is kept — forecasted opportunities often have
 * none yet, and dropping them would hide the ones with the most lead time.
 */
function isStillOpen(grant: FederalGrant, today: string): boolean {
  if (!grant.closeDate) return true;
  return grant.closeDate >= today;
}

/**
 * One Search2 call. Returns `ok: false` with a member-safe reason on any
 * failure — network, timeout, HTTP error, API-level error code, or a response
 * whose shape doesn't match. Never throws.
 */
async function search(keyword: string, timeoutMs: number): Promise<GrantsResult> {
  const body = {
    keyword,
    eligibilities: ELIGIBILITIES,
    oppStatuses: OPP_STATUSES,
    rows: ROWS,
    startRecordNum: 0,
  };

  let payload: unknown;
  try {
    const res = await fetch(SEARCH2_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      // This route already has its own cache above, and Next would not cache a
      // POST anyway. Being explicit stops a future Next default from
      // reintroducing stale grant data without anyone noticing.
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("grantsGov: HTTP error", { status: res.status, keyword });
      return { ok: false, reason: `Grants.gov returned HTTP ${res.status}.` };
    }

    payload = await res.json();
  } catch (error) {
    // AbortSignal.timeout throws a TimeoutError; a DNS or TLS failure throws
    // something else. Both mean the same thing to the caller.
    console.error("grantsGov: request failed", { keyword, error });
    return { ok: false, reason: "Couldn't reach Grants.gov." };
  }

  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "Grants.gov returned an unexpected response." };
  }

  const root = payload as Record<string, unknown>;

  // The endpoint answers HTTP 200 with a non-zero errorcode for application
  // level failures, so a successful fetch is not a successful search.
  if (typeof root.errorcode === "number" && root.errorcode !== 0) {
    console.error("grantsGov: API error", { errorcode: root.errorcode, msg: root.msg });
    return { ok: false, reason: "Grants.gov reported an error." };
  }

  const data = root.data;
  if (!data || typeof data !== "object") {
    return { ok: false, reason: "Grants.gov returned an unexpected response." };
  }

  const dataObj = data as Record<string, unknown>;
  warnOnEligibilityDrift(dataObj.eligibilities);

  const hits = dataObj.oppHits;
  if (!Array.isArray(hits)) {
    return { ok: false, reason: "Grants.gov returned an unexpected response." };
  }

  const grants: FederalGrant[] = [];
  for (const raw of hits) {
    if (!raw || typeof raw !== "object") continue;
    const hit = raw as Search2Hit;

    const id = asString(hit.id);
    const title = asString(hit.title);
    // Without an id there is no link, and without a title there is nothing to
    // show. Either missing means the row is unusable rather than merely thin.
    if (!id || !title) continue;

    grants.push({
      id,
      number: asString(hit.number),
      title,
      // `agency` first: that is the readable name the live endpoint sends.
      // `agencyCode` is the last resort because "HHS-NIH11" tells a member
      // nothing — better a generic label than a string that looks like a bug.
      agencyName:
        asString(hit.agency) || asString(hit.agencyName) || asString(hit.agencyCode) || "Federal agency",
      closeDate: parseGrantsDate(hit.closeDate),
      status: asString(hit.oppStatus) || "posted",
      url: `https://www.grants.gov/search-results-detail/${encodeURIComponent(id)}`,
    });
  }

  return { ok: true, grants };
}

/**
 * Federal grants a small business in this industry could apply for, fetched
 * live. Callers should go through lib/grantsCache.ts rather than calling this
 * directly — the only caller that should reach it uncached is the daily refresh
 * job.
 *
 * Two calls at most, and the second only when it will change the answer. An
 * industry keyword is precise but can legitimately return nothing — "florist"
 * is not how federal opportunity titles are written — and an empty funding
 * panel reads as broken rather than as accurate. So a thin industry result
 * falls back to a broad "small business" search, which is still retrieval
 * against live data and still eligibility-filtered.
 *
 * Rejected alternative: firing both concurrently and merging. It halves the
 * worst-case latency but doubles the load on a free public API for the common
 * case where the first call was enough.
 */
export async function fetchFederalGrants(industry: string): Promise<GrantsResult> {
  const keyword = industry.trim() || "small business";
  // Only used to decide whether the broad fallback would just repeat the
  // primary query. It was the cache key before caching moved out of this file.
  const normalized = keyword.toLowerCase();

  const today = new Date().toISOString().slice(0, 10);
  const MIN_USEFUL_RESULTS = 3;

  // Both calls share one budget — see TOTAL_BUDGET_MS.
  const startedAt = Date.now();
  const remainingBudget = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);

  const primary = await search(keyword, Math.min(REQUEST_TIMEOUT_MS, TOTAL_BUDGET_MS));
  if (!primary.ok) return primary;

  const grants = primary.grants.filter((grant) => isStillOpen(grant, today));

  if (
    grants.length < MIN_USEFUL_RESULTS &&
    normalized !== "small business" &&
    remainingBudget() >= MIN_FALLBACK_BUDGET_MS
  ) {
    const fallback = await search("small business", Math.min(REQUEST_TIMEOUT_MS, remainingBudget()));
    if (fallback.ok) {
      const seen = new Set(grants.map((grant) => grant.id));
      for (const grant of fallback.grants) {
        if (!seen.has(grant.id) && isStillOpen(grant, today)) {
          seen.add(grant.id);
          grants.push(grant);
        }
      }
    }
    // A failed fallback is not a failed request — the primary results, however
    // few, are real and still worth showing.
  }

  // Soonest deadline first, undated last. A member scanning this list is
  // deciding what to act on this month, and "closes in three weeks" is the
  // fact that decides it. Undated entries are forecasted opportunities, which
  // are the least urgent by definition.
  grants.sort((a, b) => {
    if (a.closeDate && b.closeDate) return a.closeDate.localeCompare(b.closeDate);
    if (a.closeDate) return -1;
    if (b.closeDate) return 1;
    return 0;
  });

  return { ok: true, grants };
}

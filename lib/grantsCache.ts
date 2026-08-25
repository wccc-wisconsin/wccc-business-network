import "server-only";

import {
  getCachedGrants,
  listCachedGrantAges,
  listMemberIndustries,
  saveCachedGrants,
} from "@/lib/appStore";
import { fetchFederalGrants, type FederalGrant } from "@/lib/grantsGov";

/**
 * When Grants.gov is actually called.
 *
 * Before this file, the answer was "on almost every click". /api/ai/opportunities
 * called lib/grantsGov.ts directly, which cached in a Map inside the serverless
 * instance. That Map's own comment conceded the flaw: a cold start begins empty
 * and nothing is shared between instances. At this portal's traffic almost every
 * request is a cold start, so a member clicking "Find matches" typically paid for
 * a live HTTP call to a free public API, inside the same function invocation that
 * then had to call Claude — which is why lib/grantsGov.ts needs a 9-second budget
 * and the route needs `maxDuration = 60`.
 *
 * Now the reads come from the grants_cache table, warmed once a day by
 * /api/cron/refresh-grants. Three things follow, and the third is the one that
 * matters most:
 *
 *   1. Grants.gov is called roughly once a day per keyword rather than once per
 *      click, which is what a considerate client of a free no-signup API looks
 *      like.
 *   2. The request path becomes one indexed read, so the latency budget stops
 *      being load-bearing on the member's request.
 *   3. When Grants.gov is unreachable, a member sees yesterday's grants marked
 *      as such instead of an empty panel. Stale-but-labelled beats dark.
 *
 * The read path is still read-through, not cache-only. A member whose industry
 * nobody has searched before — or whose row the refresh job has not reached —
 * gets a live call and a written row rather than nothing. The cron makes that
 * the rare case; it is not required for correctness.
 */

/**
 * How old a cached row may be and still be served without a live call.
 *
 * Deliberately longer than the daily refresh interval. At exactly 24 hours,
 * every row would spend the minutes before each night's run technically stale,
 * and any request landing in that window would fire a live call — reintroducing
 * on the request path the exact cost this file removes. The grace window means
 * only a refresh job that has actually stopped working causes live calls.
 */
export const FRESH_FOR_MS = 36 * 60 * 60 * 1000;

export type FederalGrantsResult =
  | {
      ok: true;
      grants: FederalGrant[];
      /** ISO timestamp of the fetch these rows came from, or null if unknown. */
      fetchedAt: string | null;
      /** True when Grants.gov could not be reached and this is an older copy. */
      stale: boolean;
    }
  | { ok: false; reason: string };

/** Keywords are stored lowercased, so "Food Service" and "food service" share a row. */
export function normalizeKeyword(industry: string): string {
  return industry.trim().toLowerCase() || "small business";
}

function ageMs(fetchedAt: string, now: number): number {
  const at = Date.parse(fetchedAt);
  // An unparseable timestamp is treated as infinitely old rather than as fresh.
  // Getting this backwards would pin a bad row in place forever.
  return Number.isNaN(at) ? Number.POSITIVE_INFINITY : now - at;
}

/**
 * Federal grants for one industry, from the cache where possible.
 *
 * Order of preference: a fresh cached row, then a live fetch, then a stale
 * cached row. That last step is the point — a member whose search coincides
 * with a Grants.gov outage gets last night's list labelled as last night's,
 * rather than a panel that reads as broken.
 */
export async function getFederalGrants(industry: string): Promise<FederalGrantsResult> {
  const keyword = normalizeKeyword(industry);
  const cached = await getCachedGrants(keyword);
  const now = Date.now();

  if (cached && ageMs(cached.fetchedAt, now) < FRESH_FOR_MS) {
    return { ok: true, grants: cached.grants, fetchedAt: cached.fetchedAt, stale: false };
  }

  const live = await fetchFederalGrants(keyword);

  if (live.ok) {
    // Awaited rather than fired and forgotten: an unawaited promise in a
    // serverless function can be killed when the response is returned, which
    // would leave the row unwritten and the next request paying for the same
    // call again. A failed write is logged in appStore and ignored here — the
    // member still gets their grants.
    await saveCachedGrants(keyword, live.grants);
    return { ok: true, grants: live.grants, fetchedAt: new Date(now).toISOString(), stale: false };
  }

  if (cached) {
    console.warn("grantsCache: serving stale rows after a failed fetch", {
      keyword,
      fetchedAt: cached.fetchedAt,
      reason: live.reason,
    });
    return { ok: true, grants: cached.grants, fetchedAt: cached.fetchedAt, stale: true };
  }

  return { ok: false, reason: live.reason };
}

export type RefreshOutcome = {
  keyword: string;
  ok: boolean;
  /** Grants written, when ok. */
  count?: number;
  reason?: string;
};

export type RefreshReport = {
  refreshed: RefreshOutcome[];
  /** Keywords that were due but not reached before the budget ran out. */
  skipped: string[];
};

/**
 * The keywords the daily job should warm, stalest first.
 *
 * Stalest-first is what makes a truncated run self-healing. If the budget only
 * covers half the list, the half it skipped is the half it starts with tomorrow,
 * so every keyword still gets refreshed rather than the tail never being reached.
 *
 * "small business" is always included because lib/grantsGov.ts falls back to it
 * whenever an industry search comes back thin, so it is the most-read row in the
 * table regardless of who has signed up.
 */
export async function keywordsToRefresh(): Promise<string[]> {
  const [industries, ages] = await Promise.all([listMemberIndustries(), listCachedGrantAges()]);

  const due = new Set<string>(["small business", ...industries]);
  const fetchedAt = new Map(ages.map((row) => [row.keyword, row.fetchedAt]));
  const now = Date.now();

  // Never-cached keywords sort first (infinite age), then oldest to newest.
  return [...due].sort((a, b) => {
    const ageA = fetchedAt.has(a) ? ageMs(fetchedAt.get(a)!, now) : Number.POSITIVE_INFINITY;
    const ageB = fetchedAt.has(b) ? ageMs(fetchedAt.get(b)!, now) : Number.POSITIVE_INFINITY;
    if (ageA === ageB) return a.localeCompare(b);
    return ageB - ageA;
  });
}

/**
 * Refreshes cached keywords until the budget runs out.
 *
 * Sequential, not concurrent. Fanning out would finish sooner but would point a
 * burst of requests at a free public API that publishes no rate limit and
 * documents a 429 — and there is nobody waiting on this, so there is nothing to
 * spend the goodwill on.
 *
 * Whatever it does not reach is named in `skipped` rather than silently dropped,
 * so a run that only got through four of eleven keywords says so in the logs
 * instead of reading like a clean sweep.
 */
export async function refreshCachedGrants(budgetMs: number): Promise<RefreshReport> {
  const keywords = await keywordsToRefresh();
  const startedAt = Date.now();
  const refreshed: RefreshOutcome[] = [];

  let index = 0;
  for (; index < keywords.length; index++) {
    if (Date.now() - startedAt >= budgetMs) break;

    const keyword = keywords[index];
    const result = await fetchFederalGrants(keyword);

    if (!result.ok) {
      // Left alone rather than overwritten: whatever is in the row is real data
      // from a previous successful fetch, and older-but-real beats empty.
      refreshed.push({ keyword, ok: false, reason: result.reason });
      continue;
    }

    const saved = await saveCachedGrants(keyword, result.grants);
    refreshed.push(
      saved.ok
        ? { keyword, ok: true, count: result.grants.length }
        : { keyword, ok: false, reason: "Fetched, but the write failed." },
    );
  }

  return { refreshed, skipped: keywords.slice(index) };
}

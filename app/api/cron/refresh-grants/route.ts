import { NextRequest, NextResponse } from "next/server";
import { refreshCachedGrants } from "@/lib/grantsCache";

// Daily Grants.gov refresh. Scheduled in vercel.json.
//
// This is the job that makes lib/grantsCache.ts worth having: it warms every
// keyword members actually search on, so the request path reads a table instead
// of calling a free public API inside a member's request. See the file header in
// lib/grantsCache.ts for why that matters.
//
// Nothing about a member is read or written here. It touches one table,
// grants_cache, and the rows are public federal listings.

/**
 * The refresh is sequential and each fetch has its own budget in
 * lib/grantsGov.ts, so a run with many keywords can take a while. 60 is the
 * Vercel Hobby ceiling and applies on either plan.
 */
export const maxDuration = 60;

/**
 * Leaves room inside maxDuration to write the response and for the platform's
 * own overhead. A run cut off by the platform reports nothing at all, which is
 * the one outcome that makes a broken refresh invisible.
 */
const REFRESH_BUDGET_MS = 45_000;

/**
 * Fails closed when CRON_SECRET is unset.
 *
 * The opposite choice — no secret configured means no check — would leave a
 * public endpoint that fires a burst of outbound requests to Grants.gov on
 * demand, from anyone who guesses the path. An unconfigured job that refuses to
 * run is a visible problem; an open one is not.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that variable is
 * set on the project, so this needs no client-side change — just the variable,
 * in Vercel → Settings → Environment Variables.
 */
function authorize(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("refresh-grants: CRON_SECRET is not set — refusing to run");
    return NextResponse.json(
      { ok: false, error: "Refresh is not configured." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Not authorised." }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;

  const startedAt = Date.now();
  const report = await refreshCachedGrants(REFRESH_BUDGET_MS);

  const succeeded = report.refreshed.filter((entry) => entry.ok);
  const failed = report.refreshed.filter((entry) => !entry.ok);

  // One structured line per run, because this is the only place a quietly
  // broken refresh becomes visible. A member never sees this job fail — they
  // just see grants that stop moving.
  console.log("refresh-grants: run complete", {
    durationMs: Date.now() - startedAt,
    succeeded: succeeded.length,
    failed: failed.map((entry) => ({ keyword: entry.keyword, reason: entry.reason })),
    skipped: report.skipped,
  });

  // 200 even when individual keywords failed: the run itself worked, and a
  // non-2xx would make Vercel report the whole job as failing when nine of ten
  // keywords refreshed fine. The body carries the detail.
  return NextResponse.json({
    ok: true,
    refreshed: succeeded.length,
    failed: failed.length,
    skipped: report.skipped.length,
    detail: report,
  });
}

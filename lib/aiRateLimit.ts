import "server-only";
import { NextResponse } from "next/server";
import { countAiCallsSince, recordAiCall } from "@/lib/appStore";

/**
 * Per-member daily caps on the AI features.
 *
 * Every route under app/api/ai/ spends real money per request, and until now
 * only the document generator had a ceiling. The rest checked that you were
 * signed in and then called the model as often as you asked — so one member
 * with a stuck retry loop, or one account handed round, could run up the bill
 * with nothing to stop it.
 *
 * Two limits apply together:
 *
 *   - a per-route cap, sized to how the feature is actually used, and
 *   - a total across all routes, which catches someone spreading the load
 *     across features to stay under each individual cap.
 *
 * Both are generous enough that a member using the portal properly will never
 * see them. Someone who does is either stuck in a loop or automating, and both
 * are worth interrupting.
 *
 * The window is rolling 24 hours, not midnight-to-midnight: a calendar reset
 * hands out a fresh allowance the moment it ticks over, so the cap can be
 * doubled by waiting for it.
 */
export const AI_ROUTE_LIMITS = {
  /** Chat. Highest cap — a real conversation is many turns. */
  coach: 60,
  /** Interrogates one decision over several turns, then writes a brief. */
  grill: 60,
  /** Feedback on one guided step. Fired per step, and there are many. */
  "review-step": 60,
  /** Generates a full document. Slowest and most expensive per call. */
  document: 20,
  /** Regenerates the member's whole funding/support match list. */
  opportunities: 20,
  /** Writes a module's summary artifact. Once per module in practice. */
  "summarize-module": 20,
} as const;

export type AiRoute = keyof typeof AI_ROUTE_LIMITS;

/**
 * Ceiling across every route combined. Deliberately below the sum of the
 * individual caps (260) — the per-route numbers are each sized for a member
 * who leans on that one feature, not for someone maxing out all six.
 */
export const AI_DAILY_TOTAL_LIMIT = 120;

const WINDOW_MS = 24 * 60 * 60 * 1000;

const SUPPORT_EMAIL = "info@wisccc.org";

/**
 * Checks a member against both caps and records the attempt.
 *
 * Returns a ready-to-send 429 when either cap is hit, or null when the request
 * should proceed. Call it after validating the request but before calling the
 * model, and return its result directly:
 *
 *     const limited = await enforceAiRateLimit(userId, "coach");
 *     if (limited) return limited;
 *
 * Fails open. If the counts can't be read — Supabase down, table missing — the
 * request is allowed rather than denied. A member losing a working feature
 * because a count query failed is a worse outcome than a day of uncapped usage,
 * and the same choice the document generator's original limiter made.
 *
 * The attempt is recorded even when it's about to be rejected for some later
 * reason, because the cap is about spend, and an attempt is what costs money.
 */
export async function enforceAiRateLimit(
  memberId: string,
  route: AiRoute,
): Promise<NextResponse | null> {
  const since = new Date(Date.now() - WINDOW_MS);

  const [routeCount, totalCount] = await Promise.all([
    countAiCallsSince(memberId, since, route),
    countAiCallsSince(memberId, since),
  ]);

  const routeLimit = AI_ROUTE_LIMITS[route];

  if (routeCount !== null && routeCount >= routeLimit) {
    return tooMany(
      `You've used this tool ${routeLimit} times in the last 24 hours. It'll free up shortly — or email ${SUPPORT_EMAIL} if you need more.`,
    );
  }

  if (totalCount !== null && totalCount >= AI_DAILY_TOTAL_LIMIT) {
    return tooMany(
      `You've made ${AI_DAILY_TOTAL_LIMIT} AI requests in the last 24 hours. It'll free up shortly — or email ${SUPPORT_EMAIL} if you need more.`,
    );
  }

  // Recorded only once the request is cleared to run, so a member who is
  // already blocked doesn't keep pushing their own window forward with
  // attempts that never reached the model.
  await recordAiCall(memberId, route);
  return null;
}

function tooMany(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 429 });
}

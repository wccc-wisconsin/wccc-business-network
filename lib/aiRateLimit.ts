import "server-only";
import { NextResponse } from "next/server";
import {
  aiCallCountsSince,
  recordAiCall,
  recordAiSpend,
  type AiSpend,
} from "@/lib/appStore";

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
  /**
   * Reads a finished conversation for candidate profile facts. Once per
   * conversation the member chooses to save, so a low ceiling — and a member
   * hitting it is pressing the button repeatedly on the same chat, which
   * proposes the same facts every time.
   */
  "extract-facts": 20,
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
 * What a caller does next.
 *
 * `limited` is a ready-to-send 429 when either cap is hit. Otherwise it is null
 * and `usageId` identifies the row recording this attempt, so the token counts
 * can be attached to it once the model has answered:
 *
 *     const { limited, usageId } = await enforceAiRateLimit(userId, "coach");
 *     if (limited) return limited;
 *     ...
 *     const result = await callClaude(...);
 *     if (result.ok) await recordSpend(usageId, result.usage);
 *
 * `usageId` is null when the insert failed, which is not something the member
 * should ever see — it just means this one call goes unaccounted.
 */
export type RateLimitVerdict = {
  limited: NextResponse | null;
  usageId: string | null;
};

/**
 * Checks a member against both caps and records the attempt.
 *
 * Fails open. If the counts can't be read — Supabase down, table missing — the
 * request is allowed rather than denied. A member losing a working feature
 * because a count query failed is a worse outcome than a day of uncapped usage,
 * and the same choice the document generator's original limiter made.
 *
 * The attempt is recorded even when it's about to be rejected for some later
 * reason, because the cap is about spend, and an attempt is what costs money.
 *
 * Two round trips, not three. It used to issue one count query per cap plus the
 * insert; both counts now come from a single read — see aiCallCountsSince.
 */
export async function enforceAiRateLimit(
  memberId: string,
  route: AiRoute,
): Promise<RateLimitVerdict> {
  const since = new Date(Date.now() - WINDOW_MS);
  const counts = await aiCallCountsSince(memberId, since);

  const routeLimit = AI_ROUTE_LIMITS[route];

  if (counts !== null && (counts.byRoute[route] ?? 0) >= routeLimit) {
    return {
      limited: tooMany(
        `You've used this tool ${routeLimit} times in the last 24 hours. It'll free up shortly — or email ${SUPPORT_EMAIL} if you need more.`,
      ),
      usageId: null,
    };
  }

  if (counts !== null && counts.total >= AI_DAILY_TOTAL_LIMIT) {
    return {
      limited: tooMany(
        `You've made ${AI_DAILY_TOTAL_LIMIT} AI requests in the last 24 hours. It'll free up shortly — or email ${SUPPORT_EMAIL} if you need more.`,
      ),
      usageId: null,
    };
  }

  // Recorded only once the request is cleared to run, so a member who is
  // already blocked doesn't keep pushing their own window forward with
  // attempts that never reached the model.
  return { limited: null, usageId: await recordAiCall(memberId, route) };
}

/**
 * Files what a call cost against the attempt the limiter recorded.
 *
 * A no-op when there is no id or no usage, so a caller never has to guard: an
 * unrecorded attempt simply goes unaccounted, which is a better trade than
 * making every route branch on an accounting detail.
 */
export async function recordSpend(
  usageId: string | null,
  spend: AiSpend | undefined,
): Promise<void> {
  if (!usageId || !spend) return;
  await recordAiSpend(usageId, spend);
}

function tooMany(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 429 });
}

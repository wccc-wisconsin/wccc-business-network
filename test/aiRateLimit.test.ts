import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type RecordedCall } from "./helpers/supabaseMock";

/**
 * The caps decide whether a request costs money, so the properties that matter
 * are about *when* the limiter blocks and *what it leaves behind* — none of
 * which is visible in a return value alone.
 *
 * Two of these guard choices that look like bugs and are not:
 *
 *   - it fails OPEN, so a Supabase outage cannot take working features away
 *     from every member at once, and
 *   - a blocked request records nothing, so someone already over the cap cannot
 *     keep pushing their own rolling window forward with attempts that never
 *     reached the model.
 */

const supabase = vi.hoisted(() => {
  return { mock: null as ReturnType<typeof import("./helpers/supabaseMock").createSupabaseMock> | null };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => supabase.mock!.client.from(table),
  }),
}));

const mock = createSupabaseMock();
supabase.mock = mock;

const { enforceAiRateLimit, recordSpend, AI_ROUTE_LIMITS, AI_DAILY_TOTAL_LIMIT } = await import(
  "@/lib/aiRateLimit"
);

/** `n` prior calls, `route` of them on that route. */
function history(total: number, route: string, onRoute: number) {
  const rows: { route: string }[] = [];
  for (let i = 0; i < onRoute; i++) rows.push({ route });
  for (let i = onRoute; i < total; i++) rows.push({ route: "other" });
  return rows;
}

function handler(rows: unknown, insertId: string | null = "usage_1") {
  return (call: RecordedCall) => {
    if (call.table !== "ai_usage") return { data: null, error: null };
    if (call.op === "select") return { data: rows, error: null };
    if (call.op === "insert") {
      return insertId ? { data: { id: insertId }, error: null } : { data: null, error: { message: "no" } };
    }
    return { data: null, error: null };
  };
}

beforeEach(() => {
  mock.reset(handler([]));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("counting", () => {
  /**
   * This used to be three round trips before the model was called: one count
   * query per cap, plus the insert. Both counts now come from one read.
   */
  it("reads the window once, not once per cap", async () => {
    await enforceAiRateLimit("user_1", "coach");

    expect(mock.forTable("ai_usage").filter((call) => call.op === "select")).toHaveLength(1);
  });

  it("bounds the read so a runaway window can't be dragged back whole", async () => {
    await enforceAiRateLimit("user_1", "coach");

    const read = mock.forTable("ai_usage").find((call) => call.op === "select")!;
    expect(read.limit).not.toBeNull();
  });

  it("scopes the window to the member and the last 24 hours", async () => {
    await enforceAiRateLimit("user_1", "coach");

    const read = mock.forTable("ai_usage").find((call) => call.op === "select")!;
    expect(read.filters).toContainEqual(["eq", "member_id", "user_1"]);
    expect(read.filters.some(([op, col]) => op === "gte" && col === "created_at")).toBe(true);
  });
});

describe("blocking", () => {
  it("blocks on the per-route cap", async () => {
    mock.reset(handler(history(AI_ROUTE_LIMITS.coach, "coach", AI_ROUTE_LIMITS.coach)));

    const { limited } = await enforceAiRateLimit("user_1", "coach");

    expect(limited?.status).toBe(429);
  });

  it("blocks on the total even when no single route is over", async () => {
    // Spread across routes so every per-route cap is untouched.
    mock.reset(handler(history(AI_DAILY_TOTAL_LIMIT, "coach", 1)));

    const { limited } = await enforceAiRateLimit("user_1", "coach");

    expect(limited?.status).toBe(429);
  });

  it("does not count another route's calls against this route's cap", async () => {
    mock.reset(handler(history(AI_ROUTE_LIMITS.document, "coach", AI_ROUTE_LIMITS.document)));

    const { limited } = await enforceAiRateLimit("user_1", "document");

    expect(limited).toBeNull();
  });

  /**
   * A blocked member whose attempts kept being recorded would push their own
   * rolling window forward and never come back under the cap.
   */
  it("records nothing when it blocks", async () => {
    mock.reset(handler(history(AI_ROUTE_LIMITS.coach, "coach", AI_ROUTE_LIMITS.coach)));

    const { limited, usageId } = await enforceAiRateLimit("user_1", "coach");

    expect(limited).not.toBeNull();
    expect(usageId).toBeNull();
    expect(mock.forTable("ai_usage").filter((call) => call.op === "insert")).toHaveLength(0);
  });

  /**
   * Deliberate: a member losing a working feature because a count query failed
   * is worse than a day of uncapped usage.
   */
  it("fails open when the count can't be read", async () => {
    mock.reset((call) => {
      if (call.op === "select") return { data: null, error: { message: "relation does not exist" } };
      return { data: { id: "usage_1" }, error: null };
    });

    const { limited } = await enforceAiRateLimit("user_1", "coach");

    expect(limited).toBeNull();
  });
});

describe("spend accounting", () => {
  it("hands back the id of the attempt it recorded", async () => {
    const { usageId } = await enforceAiRateLimit("user_1", "coach");

    expect(usageId).toBe("usage_1");
  });

  it("still lets the request through when the attempt can't be recorded", async () => {
    mock.reset(handler([], null));

    const { limited, usageId } = await enforceAiRateLimit("user_1", "coach");

    expect(limited).toBeNull();
    expect(usageId).toBeNull();
  });

  it("files the four billed token kinds separately", async () => {
    await recordSpend("usage_1", {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 2000,
      cacheWriteTokens: 10,
    });

    const update = mock.forTable("ai_usage").find((call) => call.op === "update")!;
    expect(update.payload).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 2000,
      cache_write_tokens: 10,
    });
    expect(update.filters).toContainEqual(["eq", "id", "usage_1"]);
  });

  /**
   * A call that never came back has no usage, and its row is left null rather
   * than zeroed — that null is what distinguishes a failed request from a free
   * one when someone reads this table later.
   */
  it("writes nothing when there is no usage to file", async () => {
    await recordSpend("usage_1", undefined);

    expect(mock.forTable("ai_usage").filter((call) => call.op === "update")).toHaveLength(0);
  });

  it("writes nothing when the attempt was never recorded", async () => {
    await recordSpend(null, {
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });

    expect(mock.forTable("ai_usage").filter((call) => call.op === "update")).toHaveLength(0);
  });
});

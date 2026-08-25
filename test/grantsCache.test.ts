import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type RecordedCall } from "./helpers/supabaseMock";

/**
 * The caching policy that replaced the in-memory Map in lib/grantsGov.ts.
 *
 * The properties worth pinning down are all about *when Grants.gov is called*,
 * and none of them are visible in a return value:
 *
 *   - a fresh row means no HTTP call at all (the whole point),
 *   - a failed fetch falls back to stale rows rather than an empty panel,
 *   - a successful fetch is written back, so the next member does not repay
 *     for it, and
 *   - the daily job refreshes the stalest keyword first, which is what makes a
 *     run that hits its budget self-healing rather than permanently starving
 *     the tail of the list.
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

const { getFederalGrants, keywordsToRefresh, refreshCachedGrants, FRESH_FOR_MS } = await import(
  "@/lib/grantsCache"
);

/** One Search2 hit, already in the shape lib/grantsGov.ts returns. */
function grantRows(ids: string[]) {
  return ids.map((id) => ({
    id,
    number: `NUM-${id}`,
    title: `Grant ${id}`,
    agencyName: "Test Agency",
    closeDate: null,
    status: "posted",
    url: `https://www.grants.gov/search-results-detail/${id}`,
  }));
}

/** What the Search2 endpoint would return for those ids. */
function searchResponse(ids: string[]) {
  return {
    errorcode: 0,
    data: {
      oppHits: ids.map((id) => ({
        id,
        number: `NUM-${id}`,
        title: `Grant ${id}`,
        agency: "Test Agency",
        closeDate: "",
        oppStatus: "posted",
      })),
    },
  };
}

let fetchCalls: number;
let respond: () => unknown;
let fetchOk: boolean;

beforeEach(() => {
  fetchCalls = 0;
  fetchOk = true;
  respond = () => searchResponse(["live-1", "live-2", "live-3"]);

  vi.stubGlobal("fetch", async () => {
    fetchCalls++;
    if (!fetchOk) throw new Error("network down");
    return { ok: true, json: async () => respond() } as unknown as Response;
  });

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

/** A grants_cache row of a given age, with everything else empty. */
function cacheRow(ids: string[], ageMs: number) {
  return {
    grants: grantRows(ids),
    fetched_at: new Date(Date.now() - ageMs).toISOString(),
  };
}

function handlerFor(row: unknown, members: unknown[] = []) {
  return (call: RecordedCall) => {
    if (call.table === "grants_cache" && call.op === "select") {
      if (call.single) return { data: row, error: null };
      return { data: row ? [row] : [], error: null };
    }
    if (call.table === "members") return { data: members, error: null };
    return { data: call.single ? null : [], error: null };
  };
}

describe("reading grants for a member", () => {
  it("serves a fresh cached row without calling Grants.gov", async () => {
    mock.reset(handlerFor(cacheRow(["cached-1"], 60 * 60 * 1000)));

    const result = await getFederalGrants("Food Service");

    expect(fetchCalls).toBe(0);
    expect(result.ok && result.grants.map((g) => g.id)).toEqual(["cached-1"]);
    expect(result.ok && result.stale).toBe(false);
  });

  it("looks the row up by a lowercased keyword", async () => {
    mock.reset(handlerFor(cacheRow(["cached-1"], 1000)));

    await getFederalGrants("  Food Service  ");

    expect(mock.forTable("grants_cache")[0].filters).toContainEqual([
      "eq",
      "keyword",
      "food service",
    ]);
  });

  it("falls back to a generic keyword when the industry is blank", async () => {
    mock.reset(handlerFor(cacheRow(["cached-1"], 1000)));

    await getFederalGrants("   ");

    expect(mock.forTable("grants_cache")[0].filters).toContainEqual([
      "eq",
      "keyword",
      "small business",
    ]);
  });

  it("fetches live when the cached row is past its freshness window", async () => {
    mock.reset(handlerFor(cacheRow(["cached-1"], FRESH_FOR_MS + 1000)));

    const result = await getFederalGrants("bakery");

    expect(fetchCalls).toBeGreaterThan(0);
    expect(result.ok && result.grants.map((g) => g.id)).toContain("live-1");
  });

  it("fetches live when nothing is cached", async () => {
    mock.reset(handlerFor(null));

    const result = await getFederalGrants("bakery");

    expect(fetchCalls).toBeGreaterThan(0);
    expect(result.ok).toBe(true);
  });

  it("writes what it fetched back, so the next member doesn't repay for it", async () => {
    mock.reset(handlerFor(null));

    await getFederalGrants("bakery");

    const writes = mock.forTable("grants_cache").filter((call) => call.op === "upsert");
    expect(writes).toHaveLength(1);
    expect(writes[0].options).toMatchObject({ onConflict: "keyword" });
    expect(writes[0].payload).toMatchObject({ keyword: "bakery" });
  });

  it("treats an unparseable fetched_at as stale rather than fresh", async () => {
    mock.reset(handlerFor({ grants: grantRows(["cached-1"]), fetched_at: "not a date" }));

    await getFederalGrants("bakery");

    expect(fetchCalls).toBeGreaterThan(0);
  });
});

describe("when Grants.gov is unreachable", () => {
  /**
   * The reason the table exists rather than a shorter in-memory TTL. Before
   * this, an outage emptied the federal half of the panel, and an empty panel
   * reads to a member as a broken feature rather than as an outage.
   */
  it("serves the stale rows and says they are stale", async () => {
    mock.reset(handlerFor(cacheRow(["cached-1"], FRESH_FOR_MS + 1000)));
    fetchOk = false;

    const result = await getFederalGrants("bakery");

    expect(result.ok).toBe(true);
    expect(result.ok && result.grants.map((g) => g.id)).toEqual(["cached-1"]);
    expect(result.ok && result.stale).toBe(true);
  });

  it("reports the stale rows' own date, not now", async () => {
    const row = cacheRow(["cached-1"], FRESH_FOR_MS + 1000);
    mock.reset(handlerFor(row));
    fetchOk = false;

    const result = await getFederalGrants("bakery");

    expect(result.ok && result.fetchedAt).toBe(row.fetched_at);
  });

  it("fails only when there is nothing cached to fall back on", async () => {
    mock.reset(handlerFor(null));
    fetchOk = false;

    const result = await getFederalGrants("bakery");

    expect(result.ok).toBe(false);
  });

  it("does not overwrite a good row with an empty one", async () => {
    mock.reset(handlerFor(cacheRow(["cached-1"], FRESH_FOR_MS + 1000)));
    fetchOk = false;

    await getFederalGrants("bakery");

    expect(mock.forTable("grants_cache").filter((call) => call.op === "upsert")).toHaveLength(0);
  });
});

describe("the daily refresh", () => {
  it("always includes the generic keyword the fallback search uses", async () => {
    mock.reset(handlerFor(null, [{ industry: "bakery" }]));

    expect(await keywordsToRefresh()).toContain("small business");
  });

  it("covers the industries members actually have, de-duplicated", async () => {
    mock.reset(
      handlerFor(null, [
        { industry: "Bakery" },
        { industry: "bakery" },
        { industry: "  " },
        { industry: null },
        { industry: "Retail" },
      ]),
    );

    const keywords = await keywordsToRefresh();

    expect(keywords.filter((k) => k === "bakery")).toHaveLength(1);
    expect(keywords).toContain("retail");
    expect(keywords).not.toContain("");
  });

  /**
   * What makes a budget-truncated run self-healing: whatever it could not reach
   * today is what it starts with tomorrow. Sorting any other way would let the
   * tail of the list go permanently unrefreshed.
   */
  it("refreshes the stalest keyword first", async () => {
    const now = Date.now();
    mock.reset((call) => {
      if (call.table === "members") return { data: [{ industry: "fresh" }, { industry: "old" }], error: null };
      if (call.table === "grants_cache" && !call.single) {
        return {
          data: [
            { keyword: "fresh", fetched_at: new Date(now - 1000).toISOString() },
            { keyword: "old", fetched_at: new Date(now - 10 * 24 * 3600 * 1000).toISOString() },
            { keyword: "small business", fetched_at: new Date(now - 3600 * 1000).toISOString() },
          ],
          error: null,
        };
      }
      return { data: call.single ? null : [], error: null };
    });

    expect((await keywordsToRefresh())[0]).toBe("old");
  });

  it("puts a never-cached keyword ahead of every cached one", async () => {
    const now = Date.now();
    mock.reset((call) => {
      if (call.table === "members") return { data: [{ industry: "brand-new" }], error: null };
      if (call.table === "grants_cache" && !call.single) {
        return {
          data: [{ keyword: "small business", fetched_at: new Date(now - 9 * 24 * 3600 * 1000).toISOString() }],
          error: null,
        };
      }
      return { data: call.single ? null : [], error: null };
    });

    expect((await keywordsToRefresh())[0]).toBe("brand-new");
  });

  it("names what it did not reach instead of reporting a clean sweep", async () => {
    mock.reset(handlerFor(null, [{ industry: "a" }, { industry: "b" }, { industry: "c" }]));

    // A zero budget stops before the first keyword, so everything is skipped.
    const report = await refreshCachedGrants(0);

    expect(report.refreshed).toHaveLength(0);
    expect(report.skipped.length).toBeGreaterThan(0);
    expect(fetchCalls).toBe(0);
  });

  it("writes each keyword it refreshes", async () => {
    mock.reset(handlerFor(null, [{ industry: "bakery" }]));

    const report = await refreshCachedGrants(30_000);

    const written = mock
      .forTable("grants_cache")
      .filter((call) => call.op === "upsert")
      .map((call) => (call.payload as { keyword: string }).keyword);

    expect(written).toEqual(expect.arrayContaining(["bakery", "small business"]));
    expect(report.refreshed.every((entry) => entry.ok)).toBe(true);
  });

  it("keeps going after one keyword fails, and reports the failure", async () => {
    mock.reset(handlerFor(null, [{ industry: "bakery" }]));
    let first = true;
    vi.stubGlobal("fetch", async () => {
      fetchCalls++;
      if (first) {
        first = false;
        throw new Error("network down");
      }
      return { ok: true, json: async () => searchResponse(["ok-1"]) } as unknown as Response;
    });

    const report = await refreshCachedGrants(30_000);

    expect(report.refreshed.some((entry) => !entry.ok)).toBe(true);
    expect(report.refreshed.some((entry) => entry.ok)).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFederalGrants } from "@/lib/grantsGov";

/**
 * Tests for the Grants.gov client, against a stubbed endpoint.
 *
 * These carry more weight than usual. lib/grantsGov.ts was written without ever
 * making a live call — api.grants.gov is blocked at the network layer in the
 * environments it was built in — so its request and response handling come from
 * the published documentation rather than from an observed response. That makes
 * two things worth pinning down here: that the client copes with every shape of
 * failure without throwing, and that it never lets a stale or malformed
 * opportunity through as though it were good.
 *
 * What these cannot tell you is whether the documented shape is the real one.
 * `scripts/check-grants-api.mjs` makes one real call and answers that; run it
 * from a machine with ordinary internet access.
 *
 * Scope: this file is the Search2 client and nothing else. Caching moved to
 * lib/grantsCache.ts, which is why these tests mock `fetch` alone and never
 * touch Supabase. The distinct keyword per test is a leftover of the old
 * module-level cache and is harmless — it also keeps each case readable in a
 * failure message.
 */

type Hit = Record<string, unknown>;

/** Grants.gov serves MM/DD/YYYY; the client normalises to ISO. */
function toGrantsDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function okResponse(hits: Hit[], extra: Record<string, unknown> = {}) {
  return {
    errorcode: 0,
    msg: "success",
    data: {
      hitCount: hits.length,
      oppHits: hits,
      eligibilities: [{ value: "23", label: "Small businesses", count: hits.length }],
      ...extra,
    },
  };
}

/**
 * A hit shaped like the live endpoint's, not like the documentation's — note
 * `agency` rather than `agencyName`. Fixtures that don't match production are
 * how a suite goes green against a bug.
 */
function hit(overrides: Hit = {}): Hit {
  return {
    id: "100",
    number: "TEST-001",
    title: "Rural Business Development Grant",
    agency: "USDA",
    closeDate: toGrantsDate(isoDaysFromNow(30)),
    oppStatus: "posted",
    ...overrides,
  };
}

/** Request bodies the client sent, in order. */
let sent: Array<Record<string, unknown>>;
/** Decides what each request resolves to. Return an Error to make fetch throw. */
let respond: (body: Record<string, unknown>) => unknown;
/** Artificial latency, for the budget tests. */
let latencyMs: number;

beforeEach(() => {
  sent = [];
  latencyMs = 0;
  respond = () => okResponse([hit()]);

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    sent.push(body);
    if (latencyMs) await new Promise((resolve) => setTimeout(resolve, latencyMs));

    const result = respond(body);
    if (result instanceof Error) throw result;
    return { ok: true, status: 200, json: async () => result };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the request", () => {
  it("filters to small-business and unrestricted eligibility", async () => {
    // The omissions matter as much as the inclusions: 22 explicitly excludes
    // small businesses, and 25 ("Others, see text") is unfilterable. See the
    // reasoning in lib/grantsGov.ts.
    await fetchFederalGrants("req-eligibility");

    expect(sent[0].eligibilities).toBe("23|99");
  });

  it("asks only for forecasted and posted opportunities", async () => {
    await fetchFederalGrants("req-status");

    expect(sent[0].oppStatuses).toBe("forecasted|posted");
  });

  it("searches on the member's industry", async () => {
    await fetchFederalGrants("commercial bakery");

    expect(sent[0].keyword).toBe("commercial bakery");
  });

  it("falls back to a generic keyword when the industry is blank", async () => {
    await fetchFederalGrants("   ");

    expect(sent[0].keyword).toBe("small business");
  });
});

describe("parsing a result", () => {
  it("normalises MM/DD/YYYY into an ISO date", async () => {
    const close = isoDaysFromNow(21);
    respond = () => okResponse([hit({ id: "1", closeDate: toGrantsDate(close) })]);

    const result = await fetchFederalGrants("parse-date");

    expect(result.ok && result.grants[0].closeDate).toBe(close);
  });

  it("keeps an opportunity with an unparseable date rather than inventing one", async () => {
    // Dropping the deadline is safe; guessing at it is not. An entry with no
    // date still shows, just without a countdown.
    respond = () => okResponse([hit({ id: "1", closeDate: "2026-09-01" })]);

    const result = await fetchFederalGrants("parse-baddate");

    expect(result.ok && result.grants).toHaveLength(1);
    expect(result.ok && result.grants[0].closeDate).toBeNull();
  });

  it("keeps forecasted opportunities that have no date yet", async () => {
    respond = () => okResponse([hit({ id: "1", closeDate: "", oppStatus: "forecasted" })]);

    const result = await fetchFederalGrants("parse-undated");

    expect(result.ok && result.grants).toHaveLength(1);
  });

  it("drops rows with no id or no title", async () => {
    // Without an id there is no link; without a title there is nothing to show.
    respond = () =>
      okResponse([hit({ id: "" }), hit({ id: "2", title: "" }), hit({ id: "3" })]);

    const result = await fetchFederalGrants("parse-incomplete");

    expect(result.ok && result.grants.map((g) => g.id)).toEqual(["3"]);
  });

  it("reads the agency name from `agency`, which is what the live endpoint sends", async () => {
    // The documentation says `agencyName`; the real response uses `agency`.
    // Caught by scripts/check-grants-api.mjs on its first live run.
    respond = () =>
      okResponse([hit({ id: "1", agency: "National Institutes of Health", agencyCode: "HHS-NIH11" })]);

    const result = await fetchFederalGrants("parse-agency-live");

    expect(result.ok && result.grants[0].agencyName).toBe("National Institutes of Health");
  });

  it("still accepts `agencyName` if a response uses it", async () => {
    respond = () => okResponse([hit({ id: "1", agencyName: "USDA", agencyCode: "USDA-NIFA" })]);

    const result = await fetchFederalGrants("parse-agency-documented");

    expect(result.ok && result.grants[0].agencyName).toBe("USDA");
  });

  it("falls back to the agency code only when no readable name is present", async () => {
    respond = () => okResponse([hit({ id: "1", agency: undefined, agencyName: undefined, agencyCode: "HHS" })]);

    const result = await fetchFederalGrants("parse-agency-code");

    expect(result.ok && result.grants[0].agencyName).toBe("HHS");
  });
});

describe("what reaches the member", () => {
  it("drops opportunities whose deadline has already passed", async () => {
    // Belt and braces over the status filter: an agency's status update can lag
    // the actual close, and a dead deadline is the exact failure this whole
    // retrieval change exists to prevent.
    respond = () =>
      okResponse([
        hit({ id: "past", closeDate: toGrantsDate(isoDaysFromNow(-5)) }),
        hit({ id: "future", closeDate: toGrantsDate(isoDaysFromNow(5)) }),
      ]);

    const result = await fetchFederalGrants("filter-past");

    expect(result.ok && result.grants.map((g) => g.id)).toEqual(["future"]);
  });

  it("sorts by soonest deadline, undated last", async () => {
    respond = () =>
      okResponse([
        hit({ id: "later", closeDate: toGrantsDate(isoDaysFromNow(40)) }),
        hit({ id: "undated", closeDate: "" }),
        hit({ id: "soon", closeDate: toGrantsDate(isoDaysFromNow(3)) }),
      ]);

    const result = await fetchFederalGrants("sort-order");

    expect(result.ok && result.grants.map((g) => g.id)).toEqual(["soon", "later", "undated"]);
  });

  it("builds a link from the opportunity id", async () => {
    respond = () => okResponse([hit({ id: "354321" })]);

    const result = await fetchFederalGrants("link-build");

    expect(result.ok && result.grants[0].url).toContain("354321");
    expect(result.ok && result.grants[0].url).toMatch(/^https:\/\//);
  });
});

describe("failure handling", () => {
  it("reports failure on a non-zero API errorcode", async () => {
    // The endpoint answers HTTP 200 with an application-level error, so a
    // successful fetch is not a successful search.
    respond = () => ({ errorcode: 1, msg: "bad request" });

    const result = await fetchFederalGrants("fail-errorcode");

    expect(result.ok).toBe(false);
  });

  it("reports failure on an unexpected response shape", async () => {
    respond = () => ({ errorcode: 0, data: { oppHits: "not an array" } });

    const result = await fetchFederalGrants("fail-shape");

    expect(result.ok).toBe(false);
  });

  it("reports failure without throwing when the request errors", async () => {
    respond = () => new Error("ECONNREFUSED");

    await expect(fetchFederalGrants("fail-network")).resolves.toMatchObject({ ok: false });
  });

  it("never leaks an internal error message into the reason", async () => {
    // The reason is shown to a member. It should say what happened, not print
    // a stack-adjacent string.
    respond = () => new Error("ECONNREFUSED 10.0.0.1:443");

    const result = await fetchFederalGrants("fail-reason");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).not.toContain("10.0.0.1");
  });
});

describe("the broad fallback", () => {
  it("fires a second query when the industry search is thin", async () => {
    respond = (body) =>
      body.keyword === "small business"
        ? okResponse([hit({ id: "b1" }), hit({ id: "b2" }), hit({ id: "b3" })])
        : okResponse([hit({ id: "a1" })]);

    const result = await fetchFederalGrants("fallback-thin");

    expect(sent).toHaveLength(2);
    expect(result.ok && result.grants.length).toBeGreaterThan(1);
  });

  it("does not fire when the industry search was enough", async () => {
    respond = () => okResponse([hit({ id: "1" }), hit({ id: "2" }), hit({ id: "3" })]);

    await fetchFederalGrants("fallback-unneeded");

    expect(sent).toHaveLength(1);
  });

  it("does not return the same opportunity twice", async () => {
    respond = (body) =>
      body.keyword === "small business"
        ? okResponse([hit({ id: "shared" }), hit({ id: "extra" })])
        : okResponse([hit({ id: "shared" })]);

    const result = await fetchFederalGrants("fallback-dedupe");

    const ids = result.ok ? result.grants.map((g) => g.id) : [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the primary results when the fallback itself fails", async () => {
    respond = (body) =>
      body.keyword === "small business" ? new Error("down") : okResponse([hit({ id: "kept" })]);

    const result = await fetchFederalGrants("fallback-failed");

    expect(result.ok && result.grants.map((g) => g.id)).toEqual(["kept"]);
  });
});

describe("the latency budget", () => {
  /**
   * This route makes a live HTTP call before calling Claude, inside one Vercel
   * function invocation with a platform timeout. Two sequential 6-second calls
   * would leave nothing for the model, and a platform timeout bypasses every
   * error message the client is careful to return.
   */
  it("skips the fallback when the primary call has eaten the budget", async () => {
    latencyMs = 7000;
    respond = () => okResponse([hit({ id: "slow" })]);

    const started = Date.now();
    const result = await fetchFederalGrants("budget-slow");
    const elapsed = Date.now() - started;

    expect(sent).toHaveLength(1);
    expect(result.ok && result.grants).toHaveLength(1);
    expect(elapsed).toBeLessThan(9500);
  }, 15_000);
});

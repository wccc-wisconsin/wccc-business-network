import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberFact } from "@/lib/appStore";

/**
 * The catalog the funding matcher is handed.
 *
 * Two guarantees live here and neither is visible in a return value:
 *
 *   - the Wisconsin half is filtered to the member before the model sees it,
 *     so the model is ranking rather than screening, and
 *   - each Wisconsin entry's `fitNote` — WCCC's own judgement about who the
 *     organisation actually helps — reaches the prompt, on its own labelled
 *     line rather than merged into the description.
 *
 * The second one was added without a test at first, and a mutation that
 * dropped `fitNote` on the way into the catalog changed nothing anywhere in
 * the suite. That is exactly the failure this file exists for: the notes are
 * hand-written by people who know these organisations, and a wiring mistake
 * that discards them leaves a matcher that still answers fluently.
 */

const grants = vi.hoisted(() => ({
  result: null as unknown,
}));

vi.mock("@/lib/grantsCache", () => ({
  getFederalGrants: async () => grants.result,
}));

const { buildCatalog, formatCatalogForPrompt } = await import("@/lib/opportunityCatalog");

/** After the Wisconsin verifications, before they expire. */
const NOW = new Date("2026-09-01T00:00:00Z");

function facts(values: Record<string, string>): Record<string, MemberFact> {
  const out: Record<string, MemberFact> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = {
      key,
      value,
      source: "profile",
      sourceLabel: "Business Snapshot",
      updatedAt: "2026-08-20T00:00:00.000Z",
      confirmedAt: "2026-08-20T00:00:00.000Z",
    };
  }
  return out;
}

const FEDERAL_GRANT = {
  id: "348001",
  number: "USDA-NIFA-RBS-1234",
  title: "Rural Business Development Grant",
  agencyName: "USDA",
  closeDate: "2026-11-30",
  status: "posted",
  url: "https://www.grants.gov/search-results-detail/348001",
};

beforeEach(() => {
  grants.result = { ok: true, grants: [FEDERAL_GRANT], fetchedAt: "2026-08-31T02:00:00Z", stale: false };
});

describe("what the model is given", () => {
  it("carries each Wisconsin entry's fit note into the prompt", async () => {
    const catalog = await buildCatalog("Food Service", facts({}), NOW);
    const prompt = formatCatalogForPrompt(catalog);

    const wisconsin = catalog.entries.filter((entry) => entry.source === "wisconsin");
    expect(wisconsin.length).toBeGreaterThan(0);

    for (const entry of wisconsin) {
      expect(entry.fitNote, entry.title).toBeTruthy();
      expect(prompt).toContain(`Suits: ${entry.fitNote}`);
    }
  });

  it("keeps the fit note on its own line, not run into the description", async () => {
    // They are different kinds of claim — what the organisation does, versus
    // WCCC's judgement about who it suits. Merged into one sentence, a model
    // quotes the judgement back to the member as though the organisation said
    // it.
    const catalog = await buildCatalog("Food Service", facts({}), NOW);
    const prompt = formatCatalogForPrompt(catalog);

    const entry = catalog.entries.find((e) => e.source === "wisconsin")!;
    expect(prompt).toContain(`${entry.description}\n     Suits: ${entry.fitNote}`);
  });

  it("gives federal listings no fit note, because nobody has read them", async () => {
    const catalog = await buildCatalog("Food Service", facts({}), NOW);

    const federal = catalog.entries.filter((entry) => entry.source === "federal");
    expect(federal.length).toBeGreaterThan(0);
    for (const entry of federal) {
      expect(entry.fitNote).toBeNull();
    }
    // And the line simply does not appear for them.
    expect(formatCatalogForPrompt(catalog)).toContain(
      `[F1] ${FEDERAL_GRANT.title} — Federal Grant | closes ${FEDERAL_GRANT.closeDate}.`,
    );
  });
});

describe("filtering before the model, not by it", () => {
  it("removes the entries a member's facts rule out", async () => {
    const open = await buildCatalog("Food Service", facts({}), NOW);
    const narrowed = await buildCatalog(
      "Food Service",
      facts({ ownership_basis: "none", bank_account: "no" }),
      NOW,
    );

    expect(narrowed.wisconsinCount).toBe(open.wisconsinCount - 2);
    expect(narrowed.wisconsinFilteredOut).toBe(2);

    const refs = narrowed.entries.map((entry) => entry.title);
    expect(refs).not.toContain("Wisconsin Housing and Economic Development Authority (WHEDA)");
    expect(refs).not.toContain("Wisconsin Supplier Diversity Program certification");
  });

  it("reports nothing filtered when the member's facts rule nothing out", async () => {
    const catalog = await buildCatalog("Food Service", facts({}), NOW);

    expect(catalog.wisconsinFilteredOut).toBe(0);
    expect(catalog.wisconsinCount).toBeGreaterThan(0);
  });

  it("renumbers the Wisconsin references so none points at a removed entry", async () => {
    // The model cites "W2" and resolveSelections reads that back out of the
    // catalog. A gap in the numbering would mean a reference resolving to the
    // wrong organisation, which is worse than resolving to nothing.
    const catalog = await buildCatalog(
      "Food Service",
      facts({ ownership_basis: "none" }),
      NOW,
    );

    const wisconsinRefs = catalog.entries
      .filter((entry) => entry.source === "wisconsin")
      .map((entry) => entry.ref);

    expect(wisconsinRefs).toEqual(wisconsinRefs.map((_, i) => `W${i + 1}`));
  });

  it("still filters when Grants.gov is unreachable", async () => {
    // The Wisconsin half is the whole catalog in this state, so a filter that
    // only ran on the happy path would show a member everything precisely when
    // there is nothing else to look at.
    grants.result = { ok: false, reason: "network timeout" };

    const catalog = await buildCatalog("Food Service", facts({ ownership_basis: "none" }), NOW);

    expect(catalog.federalCount).toBe(0);
    expect(catalog.federalError).toBe("network timeout");
    expect(catalog.wisconsinFilteredOut).toBe(1);
    expect(catalog.entries.map((e) => e.title)).not.toContain(
      "Wisconsin Supplier Diversity Program certification",
    );
  });

  it("judges expiry against the instant it was given", async () => {
    const catalog = await buildCatalog("Food Service", facts({}), new Date("2027-06-01T00:00:00Z"));

    expect(catalog.wisconsinCount).toBe(0);
    expect(catalog.wisconsinLastVerified).toBeNull();
  });

  /**
   * Why the half is empty travels with the counts, or the panel cannot tell a
   * lapsed list from one nobody has signed off — and those need different
   * people to do different things. Written as its own test because dropping
   * the field on the way out changes no other assertion in the suite, which is
   * exactly how `fitNote` was nearly lost.
   */
  it("carries the reason the Wisconsin half is empty, not just the count", async () => {
    const live = await buildCatalog("Food Service", facts({}), NOW);
    expect(live.wisconsinState).toBe("ok");

    const lapsed = await buildCatalog("Food Service", facts({}), new Date("2027-06-01T00:00:00Z"));
    expect(lapsed.wisconsinState).toBe("expired");
    expect(lapsed.wisconsinCount).toBe(0);
  });
});

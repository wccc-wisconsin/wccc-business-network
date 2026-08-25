import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type RecordedCall } from "./helpers/supabaseMock";

/**
 * buildMemberContext is the one description of a member that every AI surface
 * receives, so a regression here is a regression in six places at once.
 *
 * These cover the artifact section specifically — the part that tells the
 * assistant what the member has already produced. Three properties matter and
 * none of them are visible in a return value at a glance:
 *
 *   - the work actually reaches the prompt (the bug this section fixed),
 *   - document and summary *bodies* never do (the cost guarantee), and
 *   - the list is bounded and deterministically ordered (the caching
 *     guarantee — see the comment on MAX_CONTEXT_DECISIONS).
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

const { buildMemberContext } = await import("@/lib/memberContext");

const MEMBER_ROW = {
  id: "user_1",
  email: "owner@example.com",
  name: "Mei Chen",
  business_name: "Golden Lotus Catering",
  industry: "Food Service",
  city: "Milwaukee",
  journey: "business",
  membership_tier: "network",
  membership_expires_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  last_login_at: "2026-08-25T00:00:00.000Z",
};

const DECISION_ROW = {
  id: "dec_1",
  topic: "Should I sign a lease on a commercial kitchen?",
  brief: {
    decision: "Lease or keep renting by the hour.",
    recommendation: "Stay on the hourly commissary through the slow summer.",
    confidence: "Medium",
    keyFactors: ["Seasonality"],
    blindSpots: ["Three-year term"],
    risks: [{ risk: "Locked in", mitigation: "Negotiate a break clause" }],
    nextSteps: [{ step: "Model a slow summer", timeframe: "This week" }],
  },
  created_at: "2026-08-20T12:00:00.000Z",
};

const SUMMARY_ROW = {
  module_key: "launch",
  title: "Business Idea Summary",
  updated_at: "2026-08-21T12:00:00.000Z",
};

const DOCUMENT_ROW = {
  module_key: "revenue",
  title: "90-Day Marketing Plan",
  created_at: "2026-08-22T12:00:00.000Z",
};

/** Rows per table. Anything not listed resolves to an empty read. */
function rowsFrom(tables: Record<string, unknown>) {
  return (call: RecordedCall) => {
    if (!(call.table in tables)) return { data: call.single ? null : [], error: null };
    return { data: tables[call.table], error: null };
  };
}

/** A member with one of each kind of saved work. */
const FULL_MEMBER = {
  members: MEMBER_ROW,
  member_decisions: [DECISION_ROW],
  module_summaries: [SUMMARY_ROW],
  member_documents: [DOCUMENT_ROW],
};

beforeEach(() => {
  mock.reset(rowsFrom(FULL_MEMBER));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the artifact section", () => {
  it("puts the member's saved work in the summary", async () => {
    const context = await buildMemberContext("user_1");

    expect(context).not.toBeNull();
    expect(context!.summary).toContain("Should I sign a lease on a commercial kitchen?");
    expect(context!.summary).toContain(
      "Stay on the hourly commissary through the slow summer.",
    );
    expect(context!.summary).toContain("Business Idea Summary");
    expect(context!.summary).toContain("90-Day Marketing Plan");
  });

  it("labels artifacts with their module's display name, not its key", async () => {
    const context = await buildMemberContext("user_1");

    // "revenue" is the stored key; "Revenue" (or whatever data/modules.ts calls
    // it) is what a member would recognise.
    expect(context!.summary).toContain(`(${"Revenue"},`);
  });

  it("tells the assistant the work is advice, not evidence of action", async () => {
    const context = await buildMemberContext("user_1");

    expect(context!.summary).toContain("not proof of what they did");
  });

  it("omits the section entirely for a member with no saved work", async () => {
    mock.reset(rowsFrom({ members: MEMBER_ROW }));

    const context = await buildMemberContext("user_1");

    expect(context!.summary).not.toContain("Work they have already done in the portal");
    // The rest of the summary is unaffected.
    expect(context!.summary).toContain("Golden Lotus Catering");
  });
});

describe("what the artifact reads cost", () => {
  /**
   * The whole reason getMemberDocumentTitles exists. member_documents rows
   * carry the full generated text; this runs on every AI request, and pulling
   * those bodies across the wire to read their titles would be pure waste.
   */
  it("never selects document or summary bodies", async () => {
    await buildMemberContext("user_1");

    for (const table of ["member_documents", "module_summaries"]) {
      const reads = mock.forTable(table);
      expect(reads.length).toBeGreaterThan(0);
      for (const read of reads) {
        expect(read.columns).toBeDefined();
        expect(read.columns).not.toContain("content");
      }
    }
  });

  it("bounds every artifact read in the query, not after it", async () => {
    await buildMemberContext("user_1");

    for (const table of ["member_decisions", "module_summaries", "member_documents"]) {
      const read = mock.forTable(table)[0];
      expect(read.limit).not.toBeNull();
      expect(read.limit).toBeLessThanOrEqual(6);
    }
  });

  it("orders artifacts newest first so the cached prefix is stable", async () => {
    await buildMemberContext("user_1");

    const ordered = (table: string, column: string) =>
      mock
        .forTable(table)[0]
        .filters.some(
          ([op, col, options]) =>
            op === "order" &&
            col === column &&
            (options as { ascending?: boolean })?.ascending === false,
        );

    expect(ordered("member_decisions", "created_at")).toBe(true);
    expect(ordered("module_summaries", "updated_at")).toBe(true);
    expect(ordered("member_documents", "created_at")).toBe(true);
  });

  it("scopes every artifact read to the member", async () => {
    await buildMemberContext("user_1");

    for (const table of ["member_decisions", "module_summaries", "member_documents"]) {
      const read = mock.forTable(table)[0];
      expect(read.filters).toContainEqual(["eq", "member_id", "user_1"]);
    }
  });

  it("issues the artifact reads once each, not per module", async () => {
    await buildMemberContext("user_1");

    expect(mock.forTable("module_summaries")).toHaveLength(1);
    expect(mock.forTable("member_documents")).toHaveLength(1);
  });
});

describe("degradation", () => {
  it("still returns a context when the artifact tables error", async () => {
    mock.reset((call) => {
      if (call.table === "members") return { data: MEMBER_ROW, error: null };
      if (
        call.table === "member_decisions" ||
        call.table === "module_summaries" ||
        call.table === "member_documents"
      ) {
        return { data: null, error: { message: "relation does not exist" } };
      }
      return { data: call.single ? null : [], error: null };
    });

    const context = await buildMemberContext("user_1");

    expect(context).not.toBeNull();
    expect(context!.summary).toContain("Golden Lotus Catering");
    expect(context!.summary).not.toContain("Work they have already done in the portal");
  });

  it("returns null when there is no member row", async () => {
    mock.reset(rowsFrom({}));

    expect(await buildMemberContext("user_1")).toBeNull();
  });
});

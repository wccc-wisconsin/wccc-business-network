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

/**
 * Stored Coach conversations, newest first — the shape listConversations reads.
 * `transcript` is what the opening line and the message count are derived from.
 */
const CONVERSATION_ROWS = [
  {
    id: "conv_1",
    module_key: "launch",
    updated_at: "2026-08-24T09:00:00.000Z",
    transcript: [
      { role: "user", content: "How do I get DBE certified?" },
      { role: "assistant", content: "Start with the WisDOT application." },
    ],
  },
  {
    id: "conv_2",
    module_key: null,
    updated_at: "2026-08-18T09:00:00.000Z",
    transcript: [
      { role: "user", content: "Can I afford a second van?" },
      { role: "assistant", content: "What does the first one bring in?" },
    ],
  },
];

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
  conversations: CONVERSATION_ROWS,
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

describe("the reference material", () => {
  /**
   * Wiring test. lib/adviceCatalog.ts is covered on its own; what this pins is
   * that every surface built on buildMemberContext actually receives it, and
   * that it is kept out of `summary` — a route that only summarises what the
   * member wrote should not silently acquire grounding rules.
   */
  it("travels alongside the summary rather than inside it", async () => {
    const context = await buildMemberContext("user_1");

    expect(context!.references).toContain("Grounding, which overrides");
    expect(context!.summary).not.toContain("Grounding, which overrides");
  });

  it("is filtered to this member's own filings", async () => {
    const context = await buildMemberContext("user_1");

    // No facts on file, so nothing is ruled out and nothing is asserted about
    // them either.
    expect(context!.references).toContain("May or may not apply");
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


/**
 * The conversation-recall section.
 *
 * This is the one part of the context built from something the member said
 * rather than something they saved, which makes two properties load-bearing:
 *
 *   - the assistant is given opening lines and told plainly that is all it has,
 *     so it can pick a thread back up without inventing how the exchange went,
 *     and
 *   - the chat in progress is never among them. From its second turn onward it
 *     is the newest stored conversation, and a coach that opens by reminding
 *     you of the sentence you just typed reads as broken — and would also
 *     change the cached prompt prefix on every single turn.
 */
describe("conversation recall", () => {
  it("tells the assistant what the member came about before", async () => {
    const context = await buildMemberContext("user_1");

    expect(context!.summary).toContain("Earlier conversations they have had with you");
    expect(context!.summary).toContain("How do I get DBE certified?");
    expect(context!.summary).toContain("2026-08-24");
    // Labelled by module the way the artifact lines are.
    expect(context!.summary).toContain("(Launch)");
  });

  it("says it does not have the transcripts", async () => {
    const context = await buildMemberContext("user_1");

    expect(context!.summary).toContain("opening lines, not transcripts");
    expect(context!.summary).toContain("never claim to remember");
    // The reply half of a stored exchange is not in the prompt, only the
    // opening — the guarantee the sentence above is making.
    expect(context!.summary).not.toContain("Start with the WisDOT application.");
  });

  it("leaves out the chat that is currently in progress", async () => {
    const context = await buildMemberContext("user_1", null, {
      excludeConversationId: "conv_1",
    });

    expect(context!.summary).not.toContain("How do I get DBE certified?");
    // The others are unaffected — this excludes one row, it does not switch
    // the section off.
    expect(context!.summary).toContain("Can I afford a second van?");
  });

  it("shows at most three however many come back", async () => {
    mock.reset(
      rowsFrom({
        members: MEMBER_ROW,
        conversations: [1, 2, 3, 4, 5].map((n) => ({
          id: `conv_${n}`,
          module_key: null,
          updated_at: `2026-08-0${n}T09:00:00.000Z`,
          transcript: [{ role: "user", content: `Question number ${n}` }],
        })),
      }),
    );

    const context = await buildMemberContext("user_1");

    expect(context!.summary).toContain("Question number 1");
    expect(context!.summary).toContain("Question number 3");
    expect(context!.summary).not.toContain("Question number 4");
  });

  it("asks the database for one more than it shows, and no more", async () => {
    await buildMemberContext("user_1");

    const read = mock.forTable("conversations")[0];
    expect(read.limit).toBe(4);
    expect(read.filters).toContainEqual(["eq", "member_id", "user_1"]);
    expect(
      read.filters.some(
        ([op, col, options]) =>
          op === "order" &&
          col === "updated_at" &&
          (options as { ascending?: boolean })?.ascending === false,
      ),
    ).toBe(true);
  });

  it("flattens an opening that spans lines", async () => {
    mock.reset(
      rowsFrom({
        members: MEMBER_ROW,
        conversations: [
          {
            id: "conv_x",
            module_key: null,
            updated_at: "2026-08-24T09:00:00.000Z",
            transcript: [{ role: "user", content: "Two things.\n\nOne: payroll." }],
          },
        ],
      }),
    );

    const context = await buildMemberContext("user_1");

    // A raw newline here would split one list entry into two and leave the
    // second looking like an instruction of its own.
    expect(context!.summary).toContain('"Two things. One: payroll."');
  });

  it("skips a stored chat with nothing the member said", async () => {
    mock.reset(
      rowsFrom({
        members: MEMBER_ROW,
        conversations: [
          {
            id: "conv_y",
            module_key: null,
            updated_at: "2026-08-24T09:00:00.000Z",
            transcript: [{ role: "assistant", content: "Are you still there?" }],
          },
        ],
      }),
    );

    const context = await buildMemberContext("user_1");

    expect(context!.summary).not.toContain("Earlier conversations they have had with you");
  });

  it("omits the section for a member who has never chatted", async () => {
    mock.reset(rowsFrom({ members: MEMBER_ROW }));

    const context = await buildMemberContext("user_1");

    expect(context!.summary).not.toContain("Earlier conversations they have had with you");
    expect(context!.summary).toContain("Golden Lotus Catering");
  });

  it("never puts a transcript body on the wire twice over", async () => {
    await buildMemberContext("user_1");

    // One read, not one per turn or per module.
    expect(mock.forTable("conversations")).toHaveLength(1);
  });
});

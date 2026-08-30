import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type RecordedCall } from "./helpers/supabaseMock";
import { BILINGUAL_ENABLED } from "@/data/facts";

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

const { buildMemberContext, buildLanguageDirective, memberLanguageDirective } = await import(
  "@/lib/memberContext"
);

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
 *
 * Columns, not transcripts. `opening` and `message_count` are written beside the
 * transcript at save time, so a list read never touches the stored chat itself.
 */
const CONVERSATION_ROWS = [
  {
    id: "conv_1",
    module_key: "launch",
    opening: "How do I get DBE certified?",
    message_count: 2,
    updated_at: "2026-08-24T09:00:00.000Z",
  },
  {
    id: "conv_2",
    module_key: null,
    opening: "Can I afford a second van?",
    message_count: 2,
    updated_at: "2026-08-18T09:00:00.000Z",
  },
];

/**
 * A stored Business Snapshot. `free_module_key` is the column name; the field
 * is `priorityModuleKey` — see the note in lib/appStore.ts.
 */
const ASSESSMENT_ROW = {
  answers: {},
  score: 40,
  stage: "Early Stage",
  free_module_key: "revenue",
  updated_at: "2026-08-20T00:00:00.000Z",
};

/** One `member_facts` row, in the shape getMemberFacts reads. */
function factRow(key: string, value: string) {
  return {
    fact_key: key,
    value,
    source: "profile",
    source_label: "Business Snapshot",
    updated_at: "2026-08-20T00:00:00.000Z",
    confirmed_at: "2026-08-20T00:00:00.000Z",
  };
}

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
  });

  /**
   * The sentence above is a promise, and this is what keeps it true: the
   * transcript is not merely left out of the prompt, it is never read. A
   * request for it here would be a stored chat crossing the wire on every
   * single AI call to produce one line of text.
   */
  it("does not ask the database for the transcripts at all", async () => {
    await buildMemberContext("user_1");

    const read = mock.forTable("conversations")[0];
    expect(read.columns).toBeDefined();
    expect(read.columns).not.toContain("transcript");
    expect(read.columns).toContain("opening");
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
          opening: `Question number ${n}`,
          message_count: 1,
          updated_at: `2026-08-0${n}T09:00:00.000Z`,
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
            opening: "Two things.\n\nOne: payroll.",
            message_count: 1,
            updated_at: "2026-08-24T09:00:00.000Z",
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
          // A row from before the opening column existed that the backfill
          // could not fill, or a chat with no member turn in it at all.
          {
            id: "conv_y",
            module_key: null,
            opening: null,
            message_count: null,
            updated_at: "2026-08-24T09:00:00.000Z",
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

  it("reads the conversation list once, not once per turn or module", async () => {
    await buildMemberContext("user_1");

    expect(mock.forTable("conversations")).toHaveLength(1);
  });
});


const withLanguage = (value: string) =>
  rowsFrom({ members: MEMBER_ROW, member_facts: [factRow("preferred_language", value)] });

/**
 * The content rules, which describe a directive that only exists when
 * BILINGUAL_ENABLED (data/facts.ts) is on.
 *
 * Skipped rather than deleted while the flag is off. They are the specification
 * of what the feature does the day someone who reads the language signs off on
 * real output, and vitest prints them as skipped, so they stay visible in every
 * run instead of quietly not existing. Flipping the flag re-arms all of them
 * with no edit to this file, which is most of the argument for a flag over a
 * deletion.
 *
 * The block below holds the rules that hold whichever way the flag is set;
 * test/bilingualFlag.test.ts holds the ones that only hold while it is off.
 */
const describeWhenBilingual = BILINGUAL_ENABLED ? describe : describe.skip;

/**
 * The language preference.
 *
 * This is the only fact that changes how the portal answers rather than what it
 * knows, and it reaches the model as an instruction rather than as a claim.
 * Four things have to hold, and each one fails quietly if it stops holding.
 * Two of them hold whichever way BILINGUAL_ENABLED is set, and they are the
 * ones in this block:
 *
 *   - English and no-preference produce *nothing*, so a member who never
 *     touched this setting sends the exact prompt they always did, and
 *   - the preference never appears in the block of things the member said
 *     about their business, because it is not one.
 *
 * The other two are statements about the text of a directive — that a stored
 * value naming no language we offer is treated as absent rather than pasted
 * into the prompt, and that names, numbers and URLs are ruled back into English
 * inside the translated text. There is no directive to check them against while
 * the flag is off, so they sit in describeWhenBilingual above.
 */
describe("the language directive", () => {
  it("says nothing at all when the member has no preference", async () => {
    mock.reset(rowsFrom({ members: MEMBER_ROW }));

    const context = await buildMemberContext("user_1");

    expect(context!.languageDirective).toBe("");
  });

  it("says nothing when the member chose English", async () => {
    mock.reset(withLanguage("en"));

    const context = await buildMemberContext("user_1");

    expect(context!.languageDirective).toBe("");
  });

  it("never states the preference as a fact about the business", async () => {
    mock.reset(withLanguage("zh-Hans"));

    const context = await buildMemberContext("user_1");

    // The summary block is introduced as what the member said about their
    // business. A language preference is not that, and listing it there would
    // also put it in front of every surface as though it were.
    expect(context!.summary).not.toContain("Preferred language");
    expect(context!.summary).toContain("no saved details about this business");
  });
});


describeWhenBilingual("the language directive's content", () => {
  it("names the language the member asked for", async () => {
    mock.reset(withLanguage("zh-Hant"));

    const context = await buildMemberContext("user_1");

    expect(context!.languageDirective).toContain("Traditional Chinese");
    // Simplified and Traditional are separate choices; picking one must not
    // produce the other.
    expect(context!.languageDirective).not.toContain("Simplified");
  });

  it("keeps agency names, form numbers and web addresses in English", async () => {
    mock.reset(withLanguage("es"));

    const directive = (await buildMemberContext("user_1"))!.languageDirective;

    expect(directive).toContain("Keep in English");
    expect(directive).toContain("WEDC");
    expect(directive).toContain("form numbers");
    expect(directive).toContain("web address");
  });

  it("protects the JSON parsers on the surfaces that have them", async () => {
    mock.reset(withLanguage("hmn"));

    const directive = (await buildMemberContext("user_1"))!.languageDirective;

    expect(directive).toContain("translate the values and never the keys");
    // The Grill's confidence level is matched against three English words and
    // silently falls back to "Medium" — a translated one shows the member a
    // level nobody chose.
    expect(directive).toContain("fixes a value to a specific set of English words");
  });

  /**
   * A stored value is data, and this is the one place data would become an
   * instruction to the model. Anything not in the table is treated as absent.
   */
  it("ignores a stored value that names no language it offers", () => {
    const stored = (value: string) => ({
      preferred_language: {
        key: "preferred_language",
        value,
        source: "profile",
        sourceLabel: "Business Snapshot",
        updatedAt: "2026-08-20T00:00:00.000Z",
        confirmedAt: "2026-08-20T00:00:00.000Z",
      },
    });

    expect(buildLanguageDirective(stored("klingon"))).toBe("");
    expect(buildLanguageDirective(stored(""))).toBe("");
    expect(buildLanguageDirective({})).toBe("");
  });

  it("reads the same preference for the surfaces that build no context", async () => {
    mock.reset(withLanguage("es"));

    const directive = await memberLanguageDirective("user_1");

    expect(directive).toContain("Spanish");
    expect(mock.forTable("member_facts")[0].filters).toContainEqual(["eq", "member_id", "user_1"]);
  });
});


/**
 * The Business Snapshot's priority answer, and what happened to tier gating.
 *
 * The answer used to unlock one roadmap module free and had no other consumer,
 * so when gating was switched off it would have become a stored value nothing
 * read — and the card on the dashboard would have gone on promising an unlock.
 * It reaches the assistant instead, which is the use it was always better at.
 */
describe("the member's stated priority", () => {
  it("tells the assistant what the member said they are working on", async () => {
    mock.reset(rowsFrom({ members: MEMBER_ROW, business_assessments: ASSESSMENT_ROW }));

    const context = await buildMemberContext("user_1");

    expect(context!.summary).toContain("matters most right now");
    // The module's label, not the stored key.
    expect(context!.summary).toContain('"Revenue"');
  });

  it("says nothing when the Snapshot has not been taken", async () => {
    mock.reset(rowsFrom({ members: MEMBER_ROW }));

    const context = await buildMemberContext("user_1");

    expect(context!.summary).not.toContain("matters most right now");
    expect(context!.summary).toContain("haven't filled in the Business Snapshot");
  });

  it("does not claim the member has acted on it", async () => {
    mock.reset(rowsFrom({ members: MEMBER_ROW, business_assessments: ASSESSMENT_ROW }));

    const context = await buildMemberContext("user_1");

    expect(context!.summary).toContain("do not assume they have made progress");
  });

  /**
   * Tier gating is off — every module is open to every member, whatever they
   * pay. The roadmap block is built from isModuleUnlocked, so if that ever
   * silently starts gating again, a Network member's prompt says so here first.
   */
  it("never tells the assistant a stage is locked", async () => {
    mock.reset(rowsFrom({ members: MEMBER_ROW }));

    const context = await buildMemberContext("user_1");

    expect(context!.summary).toContain("Their roadmap standing");
    expect(context!.summary).not.toContain("locked (needs");
  });
});

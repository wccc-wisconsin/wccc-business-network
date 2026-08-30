import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabaseMock";
import { BILINGUAL_ENABLED, factDefinition } from "@/data/facts";
import { profileQuestions } from "@/data/assessment";

/**
 * The bilingual feature switch, from both sides.
 *
 * BILINGUAL_ENABLED (data/facts.ts) is off because nobody who reads the
 * language has yet read real output — see the comment on the flag itself for
 * why that is a reason to switch a feature off rather than a reason to shrug.
 * Off has to mean something specific and checkable, or the flag is decoration:
 *
 *   1. no stored language, however it got into the database, reaches a prompt,
 *   2. the Business Snapshot does not ask the question, and the write path
 *      behind it does not store an answer if one is posted anyway,
 *   3. the fact definition survives, so a value stored before the flag went off
 *      still resolves to a label rather than rendering as a raw key, and
 *   4. the three surfaces that fetch the preference on its own stop issuing
 *      that query, because a read whose result cannot be acted on is a round
 *      trip per request for nothing.
 *
 * Every expectation here is paired with its opposite in the block at the
 * bottom, and exactly one of the two blocks runs. Flipping the flag therefore
 * needs no edit to this file: the off-state block goes quiet and the on-state
 * block, plus the content rules in test/memberContext.test.ts, come back.
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

const { buildLanguageDirective, buildMemberContext, memberLanguageDirective } = await import(
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

/** A stored preference, in the shape buildLanguageDirective is handed. */
const storedLanguage = (value: string) => ({
  preferred_language: {
    key: "preferred_language",
    value,
    source: "profile",
    sourceLabel: "Business Snapshot",
    updatedAt: "2026-08-20T00:00:00.000Z",
    confirmedAt: "2026-08-20T00:00:00.000Z",
  },
});

/**
 * Every value the catalog offers, read from the catalog rather than listed
 * here. A language added to data/facts.ts without being reviewed would
 * otherwise be a value this file never checks.
 */
const OFFERED_VALUES = (factDefinition("preferred_language")?.options ?? []).map((o) => o.value);

const describeWhenOff = BILINGUAL_ENABLED ? describe.skip : describe;
const describeWhenOn = BILINGUAL_ENABLED ? describe : describe.skip;

beforeEach(() => {
  mock.reset(() => ({ data: null, error: null }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the language fact, either way", () => {
  /**
   * The definition outlives the flag on purpose. Members who chose a language
   * before this went off still have the row; factLines in lib/memberContext.ts
   * skips a fact whose definition has been removed, but the profile grid and
   * displayFactValue would show a raw "zh-Hant" for one whose definition is
   * merely absent from a list they render from.
   */
  it("keeps its definition so an already-stored value still resolves", () => {
    const def = factDefinition("preferred_language");

    expect(def).toBeDefined();
    expect(OFFERED_VALUES).toContain("zh-Hant");
  });
});

describeWhenOff("with bilingual answers switched off", () => {
  it("turns every language the catalog offers into no directive at all", () => {
    expect(OFFERED_VALUES.length).toBeGreaterThan(1);

    for (const value of OFFERED_VALUES) {
      expect(buildLanguageDirective(storedLanguage(value))).toBe("");
    }
  });

  it("sends no directive even when the row is already in the database", async () => {
    mock.reset((call) => {
      if (call.table === "members") return { data: MEMBER_ROW, error: null };
      if (call.table === "member_facts") {
        return {
          data: [
            {
              fact_key: "preferred_language",
              value: "zh-Hans",
              source: "profile",
              source_label: "Business Snapshot",
              updated_at: "2026-08-20T00:00:00.000Z",
              confirmed_at: "2026-08-20T00:00:00.000Z",
            },
          ],
          error: null,
        };
      }
      return { data: call.single ? null : [], error: null };
    });

    const context = await buildMemberContext("user_1");

    expect(context!.languageDirective).toBe("");
  });

  /**
   * The read, not just the directive. `review-step`, `summarize-module` and
   * `opportunities` call this on every request; the query is cheap and adds no
   * latency where it sits, but it cannot change the answer while the flag is
   * off, and three routes issuing it per request is the kind of cost nobody
   * goes looking for later.
   */
  it("does not query for a preference it cannot act on", async () => {
    expect(await memberLanguageDirective("user_1")).toBe("");
    expect(mock.forTable("member_facts")).toHaveLength(0);
  });

  /**
   * One list is both the rendered form (components/BusinessAssessmentCard.tsx)
   * and the set of keys the save path will store
   * (saveBusinessAssessmentAction, app/actions.ts), so its absence closes the
   * question and the write together. Hiding the field in the card alone would
   * have left a hand-made POST able to store a language nobody can see.
   */
  it("does not ask the question on the Business Snapshot", () => {
    expect(profileQuestions).not.toContain("preferred_language");
    // The rest of the Snapshot's profile section is untouched — this is one
    // question removed, not the section switched off.
    expect(profileQuestions).toContain("entity_structure");
    expect(profileQuestions.length).toBeGreaterThan(5);
  });
});

describeWhenOn("with bilingual answers switched on", () => {
  it("builds a directive for a language the catalog offers", () => {
    expect(buildLanguageDirective(storedLanguage("zh-Hant"))).toContain("Traditional Chinese");
  });

  it("asks the question on the Business Snapshot", () => {
    expect(profileQuestions).toContain("preferred_language");
  });

  it("reads the preference for the surfaces that build no context", async () => {
    mock.reset((call) => {
      if (call.table === "member_facts") {
        return {
          data: [
            {
              fact_key: "preferred_language",
              value: "es",
              source: "profile",
              source_label: "Business Snapshot",
              updated_at: "2026-08-20T00:00:00.000Z",
              confirmed_at: "2026-08-20T00:00:00.000Z",
            },
          ],
          error: null,
        };
      }
      return { data: call.single ? null : [], error: null };
    });

    expect(await memberLanguageDirective("user_1")).toContain("Spanish");
    expect(mock.forTable("member_facts")).toHaveLength(1);
  });
});

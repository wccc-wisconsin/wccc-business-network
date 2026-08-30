import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabaseMock";

/**
 * The feedback loop's write path.
 *
 * This table exists so that changes to the AI stop being made on taste, which
 * means the numbers coming out of it have to be trustworthy. Three properties
 * carry that, and none is visible in a return value:
 *
 *   - a member who changes their mind leaves ONE row, not two that cancel out
 *     in every count anyone runs,
 *   - a rating never breaks the thing it is rating — a dead database loses the
 *     row and nothing else, and
 *   - the model that answered is recorded, because a score that fell cannot
 *     otherwise be told apart from a prompt that got worse and a model that
 *     changed underneath it.
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

const { saveAiFeedback, AI_FEEDBACK_NOTE_CHARS, AI_FEEDBACK_RATINGS, AI_FEEDBACK_ROUTES } =
  await import("@/lib/appStore");

beforeEach(() => {
  mock.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/** The row handed to upsert on the one write this should produce. */
function written() {
  const writes = mock.writes();
  expect(writes).toHaveLength(1);
  return writes[0];
}

describe("saveAiFeedback", () => {
  it("issues one upsert that replaces a member's earlier opinion", async () => {
    await saveAiFeedback("user_1", "coach", "coach:conv_1:3", "helpful", null, "claude-sonnet-5");

    const call = written();
    expect(call.table).toBe("ai_feedback");
    expect(call.op).toBe("upsert");
    // The conflict target is the whole mechanism. Without it every change of
    // mind inserts a second row, both are counted, and the table reports a
    // 50/50 split on an answer one person rated once.
    expect(call.options).toEqual({ onConflict: "member_id,target_key" });
  });

  it("records the member, the surface, the target and the model", async () => {
    await saveAiFeedback(
      "user_1",
      "review-step",
      "review-step:launch:step_a",
      "not-helpful",
      null,
      "claude-opus-5",
    );

    expect(written().payload).toMatchObject({
      member_id: "user_1",
      route: "review-step",
      target_key: "review-step:launch:step_a",
      rating: "not-helpful",
      model: "claude-opus-5",
    });
  });

  it("stores an absent note as null rather than an empty string", async () => {
    // Two spellings of "no note" would mean every later query has to know
    // about both, and one of them will eventually be forgotten.
    await saveAiFeedback("user_1", "grill", "grill:dec_1", "helpful", "   ", null);

    expect((written().payload as Record<string, unknown>).note).toBeNull();
  });

  it("keeps a real note, trimmed and capped", async () => {
    const long = "x".repeat(AI_FEEDBACK_NOTE_CHARS + 50);

    await saveAiFeedback("user_1", "grill", "grill:dec_1", "helpful", `  ${long}  `, null);

    const note = (written().payload as Record<string, string>).note;
    expect(note).toHaveLength(AI_FEEDBACK_NOTE_CHARS);
    expect(note.startsWith("x")).toBe(true);
  });

  it("stamps updated_at, so a changed rating is not mistaken for the first one", async () => {
    await saveAiFeedback("user_1", "coach", "coach:conv_1:0", "helpful", null, null);

    expect((written().payload as Record<string, unknown>).updated_at).toEqual(expect.any(String));
    // created_at is left to the column default, so the row keeps the moment the
    // member first said something rather than the moment they revised it.
    expect(written().payload).not.toHaveProperty("created_at");
  });

  it("reports failure without throwing, so a rating cannot break an answer", async () => {
    mock.reset(() => ({ data: null, error: { message: "permission denied" } }));

    await expect(
      saveAiFeedback("user_1", "coach", "coach:conv_1:0", "helpful", null, null),
    ).resolves.toBe(false);
  });

  it("survives Supabase being unreachable", async () => {
    mock.reset(() => {
      throw new Error("network down");
    });

    await expect(
      saveAiFeedback("user_1", "coach", "coach:conv_1:0", "helpful", null, null),
    ).resolves.toBe(false);
  });

  it("writes to nothing but ai_feedback", async () => {
    // A rating is an observation. If it ever starts touching the tables it is
    // observing, the observation stops being free.
    await saveAiFeedback("user_1", "coach", "coach:conv_1:0", "helpful", null, null);

    expect(mock.calls.every((call) => call.table === "ai_feedback")).toBe(true);
  });
});

describe("the vocabularies the route and the database share", () => {
  /**
   * Both lists are duplicated in supabase-schema.sql — the rating one as a
   * check constraint, the route one by convention. A value added here and not
   * there is rejected by Postgres at runtime, on a write that fails silently by
   * design. These pin the lists so that adding one is a deliberate act.
   */
  it("offers exactly two ratings", () => {
    expect([...AI_FEEDBACK_RATINGS]).toEqual(["helpful", "not-helpful"]);
  });

  it("covers the three surfaces that produce a rateable answer", () => {
    expect([...AI_FEEDBACK_ROUTES]).toEqual(["coach", "grill", "review-step"]);
  });
});

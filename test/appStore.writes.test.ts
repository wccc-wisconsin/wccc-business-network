import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabaseMock";

/**
 * Regression tests for the two data bugs fixed in the caching/perf session.
 *
 * Both were live in production, both looked correct in review, and neither was
 * visible in any return value — which is why they are tests rather than
 * comments. If someone later "simplifies" either function back toward its old
 * shape, these fail.
 */

const supabase = vi.hoisted(() => {
  // Required inside vi.hoisted: vi.mock factories are hoisted above imports, so
  // anything they close over has to be created up here too.
  return { mock: null as ReturnType<typeof import("./helpers/supabaseMock").createSupabaseMock> | null };
});

vi.mock("@supabase/supabase-js", () => ({
  // appStore memoises the client in a module-level variable, so this factory
  // runs once. Delegating through `from` keeps every test pointed at the
  // current mock rather than the first one created.
  createClient: () => ({
    from: (table: string) => supabase.mock!.client.from(table),
  }),
}));

const mock = createSupabaseMock();
supabase.mock = mock;

// Imported after the mock is registered.
const { saveStepProgress, recordMemberSignIn, updateMemberProfile } = await import(
  "@/lib/appStore"
);

beforeEach(() => {
  mock.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveStepProgress", () => {
  /**
   * The bug: saving a guided step ran two concurrent read-modify-writes against
   * the same module_step_progress row — one writing `answers`, one writing
   * `completed`. Each read the row before the other had written, so whichever
   * landed second reverted the first. A member could type an answer, tick the
   * box, save, reload, and find one of the two gone.
   *
   * The fix was a single upsert. These assert the properties that make the bug
   * impossible, not the implementation that happens to achieve them.
   */
  it("issues exactly one write", async () => {
    await saveStepProgress("user_1", "launch", "step_a", { q1: "answer" }, true);

    expect(mock.writes()).toHaveLength(1);
    expect(mock.writes()[0].op).toBe("upsert");
    expect(mock.writes()[0].table).toBe("module_step_progress");
  });

  it("reads nothing first — no read-modify-write cycle", async () => {
    await saveStepProgress("user_1", "launch", "step_a", { q1: "answer" }, true);

    expect(mock.forTable("module_step_progress").filter((call) => call.op === "select")).toHaveLength(0);
  });

  it("carries answers and completed in the same row", async () => {
    // The heart of it: if these two ever travel in separate statements again,
    // one can revert the other.
    await saveStepProgress("user_1", "launch", "step_a", { q1: "answer" }, true);

    const payload = mock.writes()[0].payload as Record<string, unknown>;
    expect(payload.answers).toEqual({ q1: "answer" });
    expect(payload.completed).toBe(true);
    expect(payload.member_id).toBe("user_1");
    expect(payload.module_key).toBe("launch");
    expect(payload.step_key).toBe("step_a");
  });

  it("upserts on the full composite key", async () => {
    // A narrower conflict target would collapse different steps onto one row.
    await saveStepProgress("user_1", "launch", "step_a", {}, false);

    expect(mock.writes()[0].options).toEqual({ onConflict: "member_id,module_key,step_key" });
  });

  it("reports failure rather than throwing when the write errors", async () => {
    mock.setHandler(() => ({ error: { message: "row level security" } }));

    await expect(saveStepProgress("user_1", "launch", "step_a", {}, true)).resolves.toEqual({ ok: false });
  });

  it("reports failure rather than throwing when Supabase is unreachable", async () => {
    mock.setHandler(() => {
      throw new Error("ECONNREFUSED");
    });

    await expect(saveStepProgress("user_1", "launch", "step_a", {}, true)).resolves.toEqual({ ok: false });
  });
});

describe("recordMemberSignIn", () => {
  const input = {
    clerkId: "user_1",
    email: "member@example.com",
    sessionId: "sess_1",
    userAgent: "Test/1.0",
  };

  /**
   * The bug: the 30-minute dedupe read used .maybeSingle() on member_id plus a
   * time window, which is not a unique filter. On two or more matching rows
   * supabase-js returns null data with a discarded error — so a member who had
   * signed in twice inside the window read as having never signed in, the guard
   * never fired, and every single dashboard load re-ran three writes.
   *
   * .limit(1) is what makes maybeSingle() safe on that filter, so that is what
   * is asserted.
   */
  it("limits the dedupe read to one row", async () => {
    await recordMemberSignIn(input);

    const read = mock.forTable("login_events").find((call) => call.op === "select");
    expect(read).toBeDefined();
    expect(read!.limit).toBe(1);
    expect(read!.single).toBe(true);
  });

  it("writes nothing when a recent login already exists", async () => {
    mock.setHandler((call) =>
      call.table === "login_events" && call.op === "select"
        ? { data: { id: "existing" } }
        : { data: null },
    );

    await recordMemberSignIn(input);

    expect(mock.writes()).toHaveLength(0);
  });

  it("records the sign-in when no recent login exists", async () => {
    await recordMemberSignIn(input);

    const writes = mock.writes();
    expect(writes.map((call) => `${call.op} ${call.table}`)).toEqual([
      "update members",
      "insert login_events",
      "insert activities",
    ]);
  });

  it("still records the activity when the members update is the only thing that fails", async () => {
    // A failed last_login_at touch must not cost the login_events row — the
    // sign-in genuinely happened either way.
    mock.setHandler((call) =>
      call.table === "members" ? { error: { message: "timeout" } } : { data: null },
    );

    await recordMemberSignIn(input);

    expect(mock.writes().map((call) => call.table)).toContain("login_events");
  });

  it("stops after a failed login_events insert rather than writing a mismatched activity", async () => {
    mock.setHandler((call) =>
      call.table === "login_events" && call.op === "insert"
        ? { error: { message: "constraint" } }
        : { data: null },
    );

    await recordMemberSignIn(input);

    expect(mock.writes().map((call) => call.table)).not.toContain("activities");
  });
});

/**
 * The profile card's write path.
 *
 * It exists as its own function because upsertMember — the obvious thing to
 * reuse — is wrong for an edit in three ways, and each of the first three tests
 * here is one of them. All three are silent: nothing throws, the member sees
 * "Saved", and the damage shows up later.
 */
describe("updateMemberProfile", () => {
  const VALID = {
    name: "Mei Chen",
    businessName: "Golden Lotus Catering",
    industry: "Food & Beverage",
    city: "Milwaukee",
  };

  /**
   * upsertMember writes `membership_tier` and `journey` from its input every
   * time. The edit form asks for neither, so reusing it would have reset a
   * paying member to the free tier whenever they fixed a typo in their city.
   */
  it("never touches membership tier or journey", async () => {
    await updateMemberProfile("user_1", VALID);

    const write = mock.forTable("members").find((call) => call.op === "update")!;
    expect(write.payload).not.toHaveProperty("membership_tier");
    expect(write.payload).not.toHaveProperty("journey");
    expect(write.filters).toContainEqual(["eq", "id", "user_1"]);
  });

  /**
   * upsertMember treats a blank field as "keep what is there", which is right
   * for onboarding and wrong here: a member who clears their business name has
   * to be able to clear it, not watch it come back on the next page load.
   */
  it("lets a member clear their business name and city", async () => {
    await updateMemberProfile("user_1", { ...VALID, businessName: "", city: "" });

    const write = mock.forTable("members").find((call) => call.op === "update")!;
    expect(write.payload).toMatchObject({ business_name: "", city: "" });
  });

  /** upsertMember ignores the error it gets back. A form that says "Saved" cannot. */
  it("reports a failed write instead of swallowing it", async () => {
    mock.reset(() => ({ data: null, error: { message: "nope" } }));

    expect(await updateMemberProfile("user_1", VALID)).toEqual({ ok: false });
  });

  /**
   * Name opens every AI prompt and industry is both the funding search term and
   * the value the dashboard gates on — blanking either breaks something a long
   * way from this form, so neither is written empty.
   */
  it("refuses to blank the two answers other things depend on", async () => {
    expect(await updateMemberProfile("user_1", { ...VALID, name: "  " })).toEqual({ ok: false });
    expect(await updateMemberProfile("user_1", { ...VALID, industry: "" })).toEqual({ ok: false });
    expect(mock.forTable("members")).toHaveLength(0);
  });

  it("trims what it stores", async () => {
    await updateMemberProfile("user_1", { ...VALID, name: "  Mei Chen  ", city: " Milwaukee " });

    const write = mock.forTable("members").find((call) => call.op === "update")!;
    expect(write.payload).toMatchObject({ name: "Mei Chen", city: "Milwaukee" });
  });
});

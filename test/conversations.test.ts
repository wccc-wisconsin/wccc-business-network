import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type RecordedCall } from "./helpers/supabaseMock";

/**
 * Conversations are the most sensitive rows the portal stores — what members
 * say in confidence about money, staff and whether they can make payroll.
 *
 * There are no RLS policies on this table, and the service role would bypass
 * them if there were, so member isolation here is *these filters* and nothing
 * else (see §0 of DIRECTORY-DESIGN.md). A conversation id also reaches the
 * browser, so members can delete their own — which is only safe while every
 * read and delete is scoped to the member as well as the id.
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

const {
  saveConversation,
  getConversation,
  listConversations,
  deleteConversation,
  deleteConversationsBefore,
  CONVERSATION_RETENTION_DAYS,
} = await import("@/lib/appStore");

const TURNS = [
  { role: "user" as const, content: "Should I lease a commercial kitchen?" },
  { role: "assistant" as const, content: "What are you paying hourly today?" },
];

beforeEach(() => {
  mock.reset((call: RecordedCall) => {
    if (call.op === "select" && call.single) {
      return { data: { id: "c1", module_key: null, transcript: TURNS, created_at: "x", updated_at: "y" }, error: null };
    }
    if (call.op === "select") {
      return { data: [{ id: "c1", module_key: null, transcript: TURNS, updated_at: "y" }], error: null };
    }
    if (call.op === "insert" || call.op === "upsert") return { data: { id: "c1" }, error: null };
    if (call.op === "delete") return { data: [{ id: "c1" }], error: null };
    return { data: null, error: null };
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("member isolation", () => {
  it("scopes a read to the member as well as the id", async () => {
    await getConversation("user_1", "c1");

    const read = mock.forTable("conversations")[0];
    expect(read.filters).toContainEqual(["eq", "member_id", "user_1"]);
    expect(read.filters).toContainEqual(["eq", "id", "c1"]);
  });

  /**
   * Without the member filter, any signed-in member could delete any
   * conversation whose id they could produce — and ids are handed to the
   * browser.
   */
  it("scopes a delete to the member as well as the id", async () => {
    await deleteConversation("user_1", "c1");

    const del = mock.forTable("conversations").find((call) => call.op === "delete")!;
    expect(del.filters).toContainEqual(["eq", "member_id", "user_1"]);
    expect(del.filters).toContainEqual(["eq", "id", "c1"]);
  });

  it("scopes a list to the member", async () => {
    await listConversations("user_1");

    expect(mock.forTable("conversations")[0].filters).toContainEqual([
      "eq",
      "member_id",
      "user_1",
    ]);
  });
});

describe("saving", () => {
  /**
   * One upsert, not a read then a write. The same shape that had to be fixed in
   * saveStepProgress after two concurrent read-modify-writes reverted each
   * other — the client holds the whole transcript, so sending it entire means a
   * dropped save loses nothing.
   */
  it("writes once and reads nothing first", async () => {
    await saveConversation("user_1", TURNS, null, "c1");

    const calls = mock.forTable("conversations");
    expect(calls.filter((c) => c.op === "select" && c.filters.length > 0)).toHaveLength(0);
    expect(calls.filter((c) => c.op === "upsert")).toHaveLength(1);
  });

  it("reuses the same row when given an id", async () => {
    await saveConversation("user_1", TURNS, null, "c1");

    const write = mock.forTable("conversations").find((c) => c.op === "upsert")!;
    expect(write.options).toMatchObject({ onConflict: "id" });
    expect(write.payload).toMatchObject({ id: "c1", member_id: "user_1" });
  });

  /**
   * Letting the database default created_at on a new row keeps the creation
   * time honest even when a client's clock is wrong.
   */
  it("sends no id when there is not one yet", async () => {
    await saveConversation("user_1", TURNS, null, null);

    const write = mock.forTable("conversations").find((c) => c.op === "upsert")!;
    expect(write.payload).not.toHaveProperty("id");
  });

  it("writes nothing for an empty transcript", async () => {
    const result = await saveConversation("user_1", [], null, null);

    expect(result.ok).toBe(true);
    expect(mock.forTable("conversations")).toHaveLength(0);
  });
});

describe("listing", () => {
  it("reduces transcripts to an opening line rather than shipping them whole", async () => {
    const list = await listConversations("user_1");

    expect(list[0].opening).toBe("Should I lease a commercial kitchen?");
    expect(list[0].messageCount).toBe(2);
    expect(list[0]).not.toHaveProperty("transcript");
  });

  it("bounds how many it returns", async () => {
    await listConversations("user_1");

    expect(mock.forTable("conversations")[0].limit).not.toBeNull();
  });
});

describe("retention", () => {
  it("keeps a year, which is one business cycle", () => {
    expect(CONVERSATION_RETENTION_DAYS).toBe(365);
  });

  /**
   * The one function here that acts across every member, which is why it takes
   * a date and never an id — and why it must not be reachable from a member
   * request.
   */
  it("prunes by age alone and reports how many went", async () => {
    const removed = await deleteConversationsBefore(new Date("2025-08-27T00:00:00.000Z"));

    const del = mock.forTable("conversations").find((call) => call.op === "delete")!;
    expect(del.filters.some(([op, col]) => op === "lt" && col === "updated_at")).toBe(true);
    expect(del.filters.some(([, col]) => col === "member_id")).toBe(false);
    expect(removed).toBe(1);
  });

  /**
   * null and 0 are different answers: nothing to delete, versus the retention
   * policy having quietly stopped running.
   */
  it("reports null rather than zero when the prune fails", async () => {
    mock.reset(() => ({ data: null, error: { message: "nope" } }));

    expect(await deleteConversationsBefore(new Date())).toBeNull();
  });
});

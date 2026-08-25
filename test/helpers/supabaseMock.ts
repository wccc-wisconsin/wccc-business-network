/**
 * A recording stand-in for the Supabase client.
 *
 * Why a hand-written fake rather than a mocking library: the things worth
 * asserting about lib/appStore.ts are not "was a function called" but "how many
 * writes did this produce, and did they carry the right columns together".
 * Both of last session's data bugs were shaped exactly like that —
 *
 *   - saving a guided step issued two concurrent read-modify-writes against one
 *     row, each reverting the other's column, and
 *   - the sign-in dedupe read used .maybeSingle() on a non-unique filter, which
 *     returns null on multiple rows, so the guard never fired
 *
 * — and neither is visible in a return value. Both are visible in the sequence
 * of calls, which is what this records.
 *
 * The fake covers only the query-builder surface appStore actually uses. It is
 * deliberately not a general Supabase emulator: an unrecognised method should
 * fail loudly in a test rather than quietly return undefined and let a wrong
 * assertion pass.
 */

export type RecordedCall = {
  table: string;
  /** "select" | "insert" | "update" | "upsert" | "delete" */
  op: string;
  /** Row(s) passed to insert/update/upsert. */
  payload?: unknown;
  /** Column list passed to select(). */
  columns?: string;
  /** Options passed to upsert(), e.g. { onConflict: "..." }. */
  options?: Record<string, unknown>;
  /** Chained filters in call order: ["eq", "member_id", "user_1"], ... */
  filters: Array<[string, string, unknown]>;
  /** Value passed to .limit(), or null when never called. */
  limit: number | null;
  /** True when the chain ended in .maybeSingle() or .single(). */
  single: boolean;
};

export type MockResult = { data?: unknown; error?: unknown };

/** Decides what a given call resolves to. Defaults to an empty successful read. */
export type Handler = (call: RecordedCall) => MockResult;

export function createSupabaseMock(initialHandler: Handler = () => ({ data: null, error: null })) {
  const calls: RecordedCall[] = [];
  let handler = initialHandler;

  function query(table: string, op: string, payload?: unknown, options?: Record<string, unknown>) {
    const call: RecordedCall = { table, op, payload, options, filters: [], limit: null, single: false };
    calls.push(call);

    // `resolve` is called at most once per chain, when the chain is awaited.
    // Reading the handler at that moment (rather than at chain creation) lets a
    // test change the handler between the call and the await if it needs to.
    const resolve = () => Promise.resolve(handler(call));

    const chain = {
      select(columns?: string) {
        call.columns = columns;
        return chain;
      },
      eq(column: string, value: unknown) {
        call.filters.push(["eq", column, value]);
        return chain;
      },
      gte(column: string, value: unknown) {
        call.filters.push(["gte", column, value]);
        return chain;
      },
      lte(column: string, value: unknown) {
        call.filters.push(["lte", column, value]);
        return chain;
      },
      in(column: string, value: unknown) {
        call.filters.push(["in", column, value]);
        return chain;
      },
      order(column: string, options?: unknown) {
        call.filters.push(["order", column, options]);
        return chain;
      },
      limit(count: number) {
        call.limit = count;
        return chain;
      },
      maybeSingle() {
        call.single = true;
        return resolve();
      },
      single() {
        call.single = true;
        return resolve();
      },
      // Makes a chain that was never terminated by maybeSingle()/single()
      // awaitable, which is how the insert/update/upsert paths are written.
      then(onFulfilled?: (value: MockResult) => unknown, onRejected?: (reason: unknown) => unknown) {
        return resolve().then(onFulfilled, onRejected);
      },
    };

    return chain;
  }

  const client = {
    from(table: string) {
      return {
        select: (columns?: string) => query(table, "select", undefined).select(columns),
        insert: (payload: unknown) => query(table, "insert", payload),
        update: (payload: unknown) => query(table, "update", payload),
        upsert: (payload: unknown, options?: Record<string, unknown>) =>
          query(table, "upsert", payload, options),
        delete: () => query(table, "delete"),
      };
    },
  };

  return {
    client,
    calls,
    /** Calls recorded against one table, in order. */
    forTable(table: string) {
      return calls.filter((call) => call.table === table);
    },
    /** Every call that wrote something. */
    writes() {
      return calls.filter((call) => call.op !== "select");
    },
    setHandler(next: Handler) {
      handler = next;
    },
    reset(next: Handler = initialHandler) {
      calls.length = 0;
      handler = next;
    },
  };
}

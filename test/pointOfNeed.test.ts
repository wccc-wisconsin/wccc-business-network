import { describe, expect, it } from "vitest";
import {
  deadlineNarrowing,
  dismissPrompt,
  fundingNarrowing,
  isPromptDismissed,
  missingPromptFacts,
  promptFactKeys,
  promptFactWrites,
  promptProvenance,
  type DismissalStorage,
} from "@/lib/pointOfNeed";
import { complianceItems, daysUntil } from "@/data/compliance";
import { factDefinition } from "@/data/facts";
import { wisconsinPrograms } from "@/data/wisconsinPrograms";
import type { FactWrite, MemberFact } from "@/lib/appStore";

/**
 * Asking for a fact where it pays off.
 *
 * Two properties carry the design. First, nothing is asked twice: a fact on
 * file from any source, including a "not sure", is never asked for again. Second,
 * the prompt is a layer around the filters and not a change to them — every
 * count here is what lib/deadlines.ts and lib/wisconsinFit.ts already return,
 * read before and after the facts.
 */

/**
 * The design notes' reference day. Nine filings were upcoming then, and the
 * numbers below are the ones the notes quote (9 → 1). They move when next
 * year's dates are added to data/compliance.ts, which is a deliberate act —
 * update the literals alongside.
 */
const NOW = new Date("2026-09-01T00:00:00Z");

function facts(values: Record<string, string>, source = "profile"): Record<string, MemberFact> {
  const out: Record<string, MemberFact> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = {
      key,
      value,
      source,
      sourceLabel: source === "profile" ? "Business Snapshot" : source,
      updatedAt: "2026-08-20T00:00:00.000Z",
      confirmedAt: "2026-08-20T00:00:00.000Z",
    };
  }
  return out;
}

/** What upsertMemberFacts would leave on file after these writes. */
function applyWrites(current: Record<string, MemberFact>, writes: FactWrite[]) {
  const next = { ...current };
  for (const w of writes) {
    next[w.key] = {
      key: w.key,
      value: w.value,
      source: w.source,
      sourceLabel: w.sourceLabel,
      updatedAt: NOW.toISOString(),
      confirmedAt: NOW.toISOString(),
    };
  }
  return next;
}

/** Golden Lotus Catering, as seed-demo-member.sql writes it. */
const goldenLotus = {
  entity_structure: "single-llc",
  formation_date: "2025-06-15",
  formation_state: "wi",
  has_employees: "none",
  pays_estimated_tax: "no",
  seller_permit: "unsure",
  bank_account: "yes",
  ownership_basis: "minority-woman",
};

describe("which facts each list asks for", () => {
  it("names only facts that exist in the catalog", () => {
    for (const keys of Object.values(promptFactKeys)) {
      for (const key of keys) {
        expect(factDefinition(key), key).toBeDefined();
      }
    }
  });

  it("asks the deadline list for every fact its filter reads, and nothing else", () => {
    // formation_state is here because audienceVerdict reads it — a foreign
    // entity's annual report is due 31 March whatever its formation quarter.
    // seller_permit is not, because no calendar row reads it yet.
    expect([...promptFactKeys.deadlines]).toEqual([
      "formation_date",
      "formation_state",
      "has_employees",
      "pays_estimated_tax",
    ]);
    expect([...promptFactKeys.funding]).toEqual(["ownership_basis", "bank_account"]);
  });
});

describe("the missing questions", () => {
  it("asks everything when nothing is on file", () => {
    expect(missingPromptFacts("deadlines", {}).map((d) => d.key)).toEqual([
      ...promptFactKeys.deadlines,
    ]);
    expect(missingPromptFacts("funding", {}).map((d) => d.key)).toEqual([
      ...promptFactKeys.funding,
    ]);
  });

  it("asks only what is missing, in display order", () => {
    const partial = facts({ has_employees: "none", ownership_basis: "minority" });

    expect(missingPromptFacts("deadlines", partial).map((d) => d.key)).toEqual([
      "formation_date",
      "formation_state",
      "pays_estimated_tax",
    ]);
    expect(missingPromptFacts("funding", partial).map((d) => d.key)).toEqual(["bank_account"]);
  });

  it("asks nothing of a member whose facts are all on file", () => {
    expect(missingPromptFacts("deadlines", facts(goldenLotus))).toEqual([]);
    expect(missingPromptFacts("funding", facts(goldenLotus))).toEqual([]);
  });

  it("never asks twice, whichever surface the answer came from", () => {
    for (const source of ["profile", "launch", "coach", "seed", "deadlines"]) {
      expect(missingPromptFacts("deadlines", facts(goldenLotus, source)), source).toEqual([]);
    }
  });

  it("treats 'not sure' and 'prefer not to say' as answers", () => {
    // Both leave the filter in its unknown state, but the member has said what
    // they can. Asking again is the nagging this exists to remove.
    const hedged = facts({ pays_estimated_tax: "unsure", ownership_basis: "decline" });

    expect(missingPromptFacts("deadlines", hedged).map((d) => d.key)).not.toContain(
      "pays_estimated_tax",
    );
    expect(missingPromptFacts("funding", hedged).map((d) => d.key)).not.toContain(
      "ownership_basis",
    );
  });

  it("asks again for a stored value the catalog cannot read", () => {
    // The filter treats it as unknown, so it has done nothing for the member.
    const broken = facts({ has_employees: "some", formation_date: "June 2025" });

    expect(missingPromptFacts("deadlines", broken).map((d) => d.key)).toEqual(
      expect.arrayContaining(["has_employees", "formation_date"]),
    );
  });

  it("returns the catalog's own definitions, so the prompt asks the catalog's question", () => {
    const [first] = missingPromptFacts("funding", {});
    expect(first).toBe(factDefinition("ownership_basis"));
  });
});

describe("the deadline count before and after", () => {
  const upcomingNow = complianceItems.filter((i) => daysUntil(i.date, NOW) >= 0).length;

  it("shows the whole calendar to a member with no facts", () => {
    expect(deadlineNarrowing({}, NOW)).toEqual({ shown: upcomingNow, total: upcomingNow });
    expect(upcomingNow).toBe(9);
  });

  it("narrows Golden Lotus to one filing", () => {
    // Q2 formation, Wisconsin entity, no payroll, no estimated tax: only the
    // June 2027 annual report is hers.
    expect(deadlineNarrowing(facts(goldenLotus), NOW)).toEqual({ shown: 1, total: 9 });
  });

  it("narrows partway on a partial answer", () => {
    // Headcount alone removes the two Form 941 rows and nothing else.
    const view = deadlineNarrowing(facts({ has_employees: "none" }), NOW);
    expect(view).toEqual({ shown: 7, total: 9 });
  });

  it("keeps the total to upcoming rows, not everything the facts removed", () => {
    // `filteredOut` on the deadline view counts past rows too. "Showing 1 of
    // 11" against a list of 9 would not add up for the member reading it.
    const { total } = deadlineNarrowing(facts(goldenLotus), NOW);
    expect(total).toBeLessThanOrEqual(complianceItems.length);
    expect(total).toBe(upcomingNow);
  });

  it("leaves the member's own renewal dates out of both numbers", () => {
    // A lease end date is never filtered, so counting it would move both
    // sides of "shown of total" by one and make the narrowing look smaller.
    const withLease = facts({ ...goldenLotus, lease_end_date: "2026-12-01" });
    expect(deadlineNarrowing(withLease, NOW)).toEqual({ shown: 1, total: 9 });
  });
});

describe("the Wisconsin program count before and after", () => {
  it("shows every verified program to a member with no facts", () => {
    const n = wisconsinPrograms.length;
    expect(fundingNarrowing({}, NOW)).toEqual({ shown: n, total: n });
    expect(n).toBe(8);
  });

  it("rules nothing out for Golden Lotus", () => {
    // Minority- and woman-owned with a business bank account qualifies for
    // both gated entries, so the answers confirm the full list rather than
    // shorten it. The design notes' "8 to 6" describes a member who answered
    // "none of these" and "not yet".
    expect(fundingNarrowing(facts(goldenLotus), NOW)).toEqual({ shown: 8, total: 8 });
  });

  it("narrows to six for an owner neither entry can help", () => {
    const view = fundingNarrowing(facts({ ownership_basis: "none", bank_account: "no" }), NOW);
    expect(view).toEqual({ shown: 6, total: 8 });
  });
});

describe("what saving writes", () => {
  it("writes the answered facts with the surface's provenance", () => {
    const writes = promptFactWrites("deadlines", {
      formation_date: "2025-06-15",
      formation_state: "wi",
      has_employees: "none",
      pays_estimated_tax: "no",
    });

    expect(writes.map((w) => w.key)).toEqual([...promptFactKeys.deadlines]);
    for (const w of writes) {
      expect(w.source).toBe(promptProvenance.deadlines.source);
      expect(w.sourceLabel).toBe(promptProvenance.deadlines.sourceLabel);
    }
  });

  it("labels each surface differently, so the profile can say where an answer came from", () => {
    const [deadline] = promptFactWrites("deadlines", { has_employees: "none" });
    const [funding] = promptFactWrites("funding", { bank_account: "yes" });

    expect(deadline.sourceLabel).not.toBe(funding.sourceLabel);
    expect(deadline.source).not.toBe(funding.source);
  });

  it("skips blanks rather than failing the save", () => {
    const writes = promptFactWrites("deadlines", {
      formation_date: "",
      formation_state: "  ",
      has_employees: "none",
    });

    expect(writes.map((w) => w.key)).toEqual(["has_employees"]);
  });

  it("skips a value the catalog would not accept", () => {
    const writes = promptFactWrites("deadlines", {
      has_employees: "loads",
      formation_date: "15/06/2025",
      pays_estimated_tax: "no",
    });

    expect(writes.map((w) => w.key)).toEqual(["pays_estimated_tax"]);
  });

  it("ignores keys the surface did not ask for", () => {
    // A funding fact posted to the deadline prompt is still a valid fact, but
    // the prompt never asked it. The Snapshot is where answers change on
    // purpose; this path writes only what was on screen.
    const writes = promptFactWrites("deadlines", {
      bank_account: "yes",
      entity_structure: "s-corp",
      has_employees: "w2",
    });

    expect(writes.map((w) => w.key)).toEqual(["has_employees"]);
  });

  it("writes nothing from an empty form", () => {
    expect(promptFactWrites("funding", {})).toEqual([]);
  });
});

describe("saving, then reading the list again", () => {
  it("narrows the deadline list and stops asking", () => {
    const before = facts({});
    expect(deadlineNarrowing(before, NOW)).toEqual({ shown: 9, total: 9 });
    expect(missingPromptFacts("deadlines", before)).toHaveLength(4);

    const after = applyWrites(
      before,
      promptFactWrites("deadlines", {
        formation_date: "2025-06-15",
        formation_state: "wi",
        has_employees: "none",
        pays_estimated_tax: "no",
      }),
    );

    expect(deadlineNarrowing(after, NOW)).toEqual({ shown: 1, total: 9 });
    expect(missingPromptFacts("deadlines", after)).toEqual([]);
  });

  it("narrows the Wisconsin list and stops asking", () => {
    const before = facts({});
    expect(fundingNarrowing(before, NOW)).toEqual({ shown: 8, total: 8 });

    const after = applyWrites(
      before,
      promptFactWrites("funding", { ownership_basis: "none", bank_account: "no" }),
    );

    expect(fundingNarrowing(after, NOW)).toEqual({ shown: 6, total: 8 });
    expect(missingPromptFacts("funding", after)).toEqual([]);
  });

  it("keeps asking for what was left blank, and only that", () => {
    const after = applyWrites(
      facts({}),
      promptFactWrites("deadlines", { has_employees: "none", pays_estimated_tax: "no" }),
    );

    expect(missingPromptFacts("deadlines", after).map((d) => d.key)).toEqual([
      "formation_date",
      "formation_state",
    ]);
    // Two Form 941 rows gone on the headcount, three estimated-tax rows on the
    // tax answer; the four annual-report rows stay until the formation date
    // settles them.
    expect(deadlineNarrowing(after, NOW)).toEqual({ shown: 4, total: 9 });
  });
});

describe("skipping the prompt", () => {
  function memoryStorage(): DismissalStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    };
  }

  it("is not dismissed until the member says so", () => {
    expect(isPromptDismissed("deadlines", memoryStorage())).toBe(false);
  });

  it("stays dismissed once skipped", () => {
    const storage = memoryStorage();
    dismissPrompt("deadlines", storage);
    expect(isPromptDismissed("deadlines", storage)).toBe(true);
  });

  it("dismisses one list without touching the other", () => {
    const storage = memoryStorage();
    dismissPrompt("funding", storage);

    expect(isPromptDismissed("funding", storage)).toBe(true);
    expect(isPromptDismissed("deadlines", storage)).toBe(false);
  });

  it("never blocks the list: a skipped prompt leaves the facts, and so the rows, untouched", () => {
    const storage = memoryStorage();
    dismissPrompt("deadlines", storage);

    // Nothing was written to the profile, so the full calendar still shows.
    expect(deadlineNarrowing({}, NOW)).toEqual({ shown: 9, total: 9 });
  });

  it("reads as not dismissed when storage is missing or broken", () => {
    const throwing: DismissalStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(isPromptDismissed("deadlines", null)).toBe(false);
    expect(isPromptDismissed("deadlines", throwing)).toBe(false);
    expect(() => dismissPrompt("deadlines", throwing)).not.toThrow();
    expect(() => dismissPrompt("deadlines", null)).not.toThrow();
  });
});

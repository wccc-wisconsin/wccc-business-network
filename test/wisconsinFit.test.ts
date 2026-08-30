import { afterEach, describe, expect, it } from "vitest";
import {
  programVerdict,
  requirementVerdict,
  wisconsinProgramsForMember,
} from "@/lib/wisconsinFit";
import { wisconsinPrograms, type WisconsinProgram } from "@/data/wisconsinPrograms";
import type { MemberFact } from "@/lib/appStore";

/**
 * Which Wisconsin entries reach one member.
 *
 * The property that matters is not "does it filter" but *which way it errs*.
 * This filter runs on self-reported facts that may be months old or simply
 * mistyped, and it stands between a small business and money. So it removes an
 * entry only on an answer that positively rules the member out, and treats
 * every other state — unanswered, declined, unrecognised — as a reason to keep
 * showing it. A filter that quietly hides help from someone who qualifies is
 * worse than no filter, because nobody can see it happening.
 */

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

const snapshot = wisconsinPrograms.map((program) => ({ ...program }));
afterEach(() => {
  wisconsinPrograms.splice(0, wisconsinPrograms.length, ...snapshot.map((p) => ({ ...p })));
});

const program = (patch: Partial<WisconsinProgram> = {}): WisconsinProgram => ({
  id: "fixture",
  name: "A Wisconsin Organisation",
  type: "Loan",
  description: "Lends to Wisconsin businesses.",
  fitNote: "Suits someone with a lender already.",
  url: "https://example.wi.gov/",
  lastVerified: "2026-08-29",
  verified: true,
  ...patch,
});

describe("the ownership requirement", () => {
  const requirement = { kind: "qualifying-ownership" } as const;

  it("applies to an owner whose ownership qualifies", () => {
    for (const basis of ["minority", "woman", "minority-woman", "veteran", "disability"]) {
      expect(requirementVerdict(requirement, facts({ ownership_basis: basis })), basis).toBe(
        "applies",
      );
    }
  });

  it("rules out only the owner who said none of these apply", () => {
    expect(requirementVerdict(requirement, facts({ ownership_basis: "none" }))).toBe("no");
  });

  it("treats a declined answer as unknown, not as a no", () => {
    // "Prefer not to say" is the one honest option for someone who would rather
    // not disclose their ownership to a portal. Reading it as "none" would
    // quietly withhold a certification from the members most likely to pick it.
    expect(requirementVerdict(requirement, facts({ ownership_basis: "decline" }))).toBe("unknown");
  });

  it("treats an unanswered or unrecognised value as unknown", () => {
    expect(requirementVerdict(requirement, facts({}))).toBe("unknown");
    expect(requirementVerdict(requirement, facts({ ownership_basis: "" }))).toBe("unknown");
    // A value no longer in the catalog is data, not a verdict. Falling through
    // to "applies" is right: it is not a member telling us they do not qualify.
    expect(requirementVerdict(requirement, facts({ ownership_basis: "co-op" }))).toBe("applies");
  });
});

describe("the lender requirement", () => {
  const requirement = { kind: "lender-relationship" } as const;

  it("applies to a member with a business bank account", () => {
    expect(requirementVerdict(requirement, facts({ bank_account: "yes" }))).toBe("applies");
  });

  it("rules out a member who has said they have none", () => {
    // A guarantee arranged through the member's own lender cannot help someone
    // with no banking relationship — WWBIC, which lends directly, is the entry
    // that reaches them instead.
    expect(requirementVerdict(requirement, facts({ bank_account: "no" }))).toBe("no");
  });

  it("treats an unanswered question as unknown", () => {
    expect(requirementVerdict(requirement, facts({}))).toBe("unknown");
  });
});

describe("an entry's verdict", () => {
  it("applies to everyone when it states no requirements", () => {
    // Six of the eight shipped entries are in this state, and correctly so.
    expect(programVerdict(program({ requirements: undefined }), facts({}))).toBe("applies");
    expect(programVerdict(program({ requirements: [] }), facts({}))).toBe("applies");
  });

  it("takes the least favourable of several requirements", () => {
    const both = program({
      requirements: [{ kind: "qualifying-ownership" }, { kind: "lender-relationship" }],
    });

    expect(programVerdict(both, facts({ ownership_basis: "minority", bank_account: "yes" }))).toBe(
      "applies",
    );
    // One unknown makes the whole entry unknown — but unknown still shows.
    expect(programVerdict(both, facts({ ownership_basis: "minority" }))).toBe("unknown");
    // One "no" settles it whatever the rest say.
    expect(programVerdict(both, facts({ ownership_basis: "none", bank_account: "yes" }))).toBe(
      "no",
    );
  });
});

describe("the list one member is offered", () => {
  it("shows everything to a member who has filled in nothing", () => {
    // The most common state for a new member, and the one where a filter is
    // most tempting and most wrong: they have told us nothing, not that they
    // are ineligible.
    const view = wisconsinProgramsForMember(facts({}), NOW);

    expect(view.programs).toHaveLength(wisconsinPrograms.length);
    expect(view.filteredOut).toBe(0);
  });

  it("drops the certification for an owner it cannot help, and nothing else", () => {
    const view = wisconsinProgramsForMember(facts({ ownership_basis: "none" }), NOW);

    expect(view.programs.map((p) => p.id)).not.toContain("wisconsin-supplier-diversity");
    expect(view.filteredOut).toBe(1);
    // The free advising and the direct lender are exactly who this member
    // should still be seeing.
    expect(view.programs.map((p) => p.id)).toEqual(
      expect.arrayContaining(["wisconsin-sbdc", "wwbic", "score-wisconsin"]),
    );
  });

  it("drops the lender-mediated guarantee for a member with no bank account", () => {
    const view = wisconsinProgramsForMember(facts({ bank_account: "no" }), NOW);

    expect(view.programs.map((p) => p.id)).not.toContain("wheda");
    // WWBIC lends directly and carries no lender requirement, so the member who
    // most needs a loan is still shown one.
    expect(view.programs.map((p) => p.id)).toContain("wwbic");
    expect(view.filteredOut).toBe(1);
  });

  it("counts every entry it removed, so the panel can say so", () => {
    const view = wisconsinProgramsForMember(
      facts({ ownership_basis: "none", bank_account: "no" }),
      NOW,
    );

    expect(view.filteredOut).toBe(2);
    expect(view.programs).toHaveLength(wisconsinPrograms.length - 2);
  });

  it("offers nothing once the verifications have expired, whatever the facts say", () => {
    // Fit is judged after freshness, not instead of it. An entry nobody has
    // re-checked must not reach a member because it happens to suit them.
    const longAfter = new Date("2027-06-01T00:00:00Z");

    const view = wisconsinProgramsForMember(facts({ ownership_basis: "minority" }), longAfter);

    expect(view.programs).toHaveLength(0);
    expect(view.filteredOut).toBe(0);
  });

  it("judges fit against the instant it was given", () => {
    // The same threading bug lib/adviceCatalog.ts had: a default `now` here
    // would filter for expiry against today while the caller reasoned about
    // another date.
    const beforeVerification = new Date("2026-08-01T00:00:00Z");

    expect(wisconsinProgramsForMember(facts({}), beforeVerification).programs.length).toBe(
      wisconsinPrograms.length,
    );
  });
});

describe("the shipped entries' fit metadata", () => {
  it("gives every entry a fit note, since the model is told to weigh it", () => {
    // An entry without one is silently judged on its description alone, which
    // is the state this whole mechanism exists to leave behind.
    for (const p of wisconsinPrograms) {
      expect(p.fitNote, p.id).toBeTruthy();
      expect(p.fitNote.length, p.id).toBeGreaterThan(40);
    }
  });

  it("states no dated or costed claim in a fit note", () => {
    // Same rule as the descriptions, and for the same reason — a fit note goes
    // to the model as WCCC's own judgement, so a stale figure in one is quoted
    // with the chamber's authority behind it.
    const dated =
      /\b20\d{2}\b|\$\s?\d|\d+\s?%(?!\s+owned\b)|\bdeadlines?\b|\bcloses? on\b|\bdue by\b|\bapplications? close\b/i;

    for (const p of wisconsinPrograms) {
      expect(dated.test(p.fitNote), `${p.id}: ${p.fitNote}`).toBe(false);
    }
  });

  it("keeps requirements rare and deliberate", () => {
    // A requirement removes a member from help on the strength of one
    // self-reported field. If this count starts climbing, the filter has begun
    // guessing rather than screening — read the note on WisconsinRequirement
    // before adding another.
    const withRequirements = wisconsinPrograms.filter((p) => (p.requirements ?? []).length > 0);

    expect(withRequirements.map((p) => p.id).sort()).toEqual([
      "wheda",
      "wisconsin-supplier-diversity",
    ]);
  });
});

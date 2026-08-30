import { afterEach, describe, expect, it } from "vitest";
import { buildReferenceBlock, GROUNDING_RULES, referenceSection } from "@/lib/adviceCatalog";
import { complianceItems } from "@/data/compliance";
import { wisconsinPrograms } from "@/data/wisconsinPrograms";
import type { MemberFact } from "@/lib/appStore";

/**
 * The reference block is what stops the Coach and the Decision Grill answering
 * Wisconsin questions out of the model's memory. What matters is not the
 * wording but four properties, all of which a well-meaning edit could quietly
 * break:
 *
 *   - only verified material reaches it,
 *   - a deadline the member's facts rule out does not,
 *   - a deadline that merely *might* apply is labelled as uncertain rather than
 *     asserted about them, and
 *   - when there is nothing verified to offer, the model is told that in words
 *     instead of being handed an empty heading to fill.
 */

/** Facts in the shape lib/deadlines.ts reads them. */
function facts(values: Record<string, string>): Record<string, MemberFact> {
  const out: Record<string, MemberFact> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = {
      key,
      value,
      source: "profile",
      sourceLabel: "Business profile",
      updatedAt: "2026-08-01T00:00:00.000Z",
      confirmedAt: "2026-08-01T00:00:00.000Z",
    };
  }
  return out;
}

/** Before every dated item in data/compliance.ts, so all of them are upcoming. */
const EARLY = new Date("2026-07-01T00:00:00.000Z");

describe("what reaches the model", () => {
  it("lists filing deadlines with the agency that publishes them", () => {
    const block = buildReferenceBlock(facts({}), EARLY);

    expect(block).toContain("Wisconsin annual report");
    expect(block).toContain("https://www.wdfi.org/corporations/");
  });

  it("records when the deadlines were last checked against the agencies", () => {
    const block = buildReferenceBlock(facts({}), EARLY);

    // The date itself comes from data/compliance.ts — asserting the value here
    // would just duplicate that file. What matters is that it is carried.
    expect(block).toMatch(/checked against the agencies on \d{4}-\d{2}-\d{2}/);
  });

  it("drops filings the member's own facts rule out", () => {
    // No W-2 employees means the quarterly payroll return cannot apply.
    const block = buildReferenceBlock(facts({ has_employees: "none" }), EARLY);

    expect(block).not.toContain("Form 941");
  });

  it("keeps a filing the member's facts do not settle, and says it is unsettled", () => {
    const block = buildReferenceBlock(facts({}), EARLY);

    expect(block).toContain("Form 941");
    expect(block).toContain("May or may not apply");
  });

  it("states a confirmed filing as confirmed", () => {
    const block = buildReferenceBlock(facts({ has_employees: "w2" }), EARLY);

    expect(block).toContain("Form 941");
    expect(block).toContain("Confirmed to apply to this member.");
  });

  it("carries a date the member gave us, attributed to their own profile", () => {
    const block = buildReferenceBlock(facts({ lease_end_date: "2026-11-15" }), EARLY);

    expect(block).toContain("2026-11-15");
    expect(block).toContain("Lease ends");
  });

  it("does not offer a deadline that has already passed", () => {
    const late = new Date("2027-06-01T00:00:00.000Z");
    const block = buildReferenceBlock(facts({}), late);

    // Every 2026 filing is behind us by then.
    expect(block).not.toContain("2026-09-30");
  });

  it("bounds the list rather than growing with the calendar", () => {
    const block = buildReferenceBlock(
      facts({
        lease_end_date: "2026-08-01",
        insurance_renewal_date: "2026-08-02",
        license_renewal_date: "2026-08-03",
        certification_renewal_date: "2026-08-04",
        sam_registration_date: "2025-08-05",
      }),
      EARLY,
    );

    const tags = [...(block ?? "").matchAll(/\[D\d+\]/g)];
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.length).toBeLessThanOrEqual(8);
  });
});

/**
 * What the model is handed when the Wisconsin list is empty, and when it is not.
 *
 * These two states produce contradictory instructions — one lists programs the
 * model may name, the other forbids naming any — so exactly one may ever
 * appear. Both used to be tested against whatever the shipped file happened to
 * contain, with an `if (!anyVerified)` guard that made the first test pass by
 * doing nothing the moment entries were verified on 2026-08-29. The array is
 * driven directly now, so each state is checked whichever way the file ships.
 */
describe("unverified material", () => {
  const snapshot = wisconsinPrograms.map((program) => ({ ...program }));

  afterEach(() => {
    wisconsinPrograms.splice(0, wisconsinPrograms.length, ...snapshot.map((p) => ({ ...p })));
  });

  function unverifyEverything() {
    for (const program of wisconsinPrograms) {
      program.verified = false;
      program.lastVerified = null;
    }
  }

  it("names no Wisconsin program while none has been verified", () => {
    unverifyEverything();

    const block = buildReferenceBlock(facts({}), EARLY) ?? "";

    for (const program of wisconsinPrograms) {
      expect(block).not.toContain(program.name);
    }
    expect(block).toContain("No Wisconsin support programs have been verified");
  });

  it("tells the model the absence is deliberate, not an omission to fill", () => {
    unverifyEverything();

    const block = buildReferenceBlock(facts({}), EARLY) ?? "";

    expect(block).toContain("Do not name specific state or local programs");
  });

  it("drops that instruction once entries are verified, rather than sending both", () => {
    // The shipped file, unmodified. "Here are eight programs you may name" and
    // "do not name any state or local program" in one prompt is a contradiction
    // the model resolves however it likes.
    const block = buildReferenceBlock(facts({}), EARLY) ?? "";

    expect(block).toContain("Wisconsin Small Business Development Center");
    expect(block).not.toContain("Do not name specific state or local programs");
  });

  it("tells the model a lapsed list has lapsed, not that it was never checked", () => {
    // The instruction is the same either way. The reason given is not, and a
    // prompt that states something false about its own contents is the wrong
    // thing to be handing a model — quite apart from anyone reading a log.
    const pastExpiry = new Date("2027-06-01T00:00:00.000Z");

    const block = buildReferenceBlock(facts({}), pastExpiry) ?? "";

    expect(block).toContain("has expired and is awaiting a re-check");
    expect(block).not.toContain("have been verified for this portal yet");
    // Whatever the wording, the rule it protects is unchanged.
    expect(block).toContain("Do not name specific state or local programs");
  });

  it("says never-checked when nothing has ever been signed off", () => {
    unverifyEverything();

    const block = buildReferenceBlock(facts({}), EARLY) ?? "";

    expect(block).toContain("No Wisconsin support programs have been verified");
    expect(block).not.toContain("has expired and is awaiting a re-check");
  });

  it("filters programs against the instant it was given, not wall-clock time", () => {
    // programLines() used to call activeWisconsinPrograms() with no argument.
    // While nothing was verified the list was empty either way; once entries
    // were verified, the deadline half of a block honoured `now` and the
    // program half used today's date. An expired verification has to disappear
    // as of the instant being asked about — that is the whole point of
    // STALE_AFTER_DAYS.
    const pastExpiry = new Date("2027-06-01T00:00:00.000Z");

    const block = buildReferenceBlock(facts({}), pastExpiry) ?? "";

    expect(block).not.toContain("Wisconsin Small Business Development Center");
  });
});

describe("the grounding rules", () => {
  it("names the categories a model cannot tell are risky on its own", () => {
    for (const category of ["filing dates", "fees", "form numbers", "program names"]) {
      expect(GROUNDING_RULES).toContain(category);
    }
  });

  it("travels with the material, so no surface can embed one without the other", () => {
    const section = referenceSection(facts({}), EARLY);

    expect(section).toContain(GROUNDING_RULES);
    expect(section).toContain("Wisconsin annual report");
  });

  it("still applies when there is nothing verified to offer", () => {
    // A far-future date leaves no upcoming filings at all.
    const section = referenceSection(facts({}), new Date("2030-01-01T00:00:00.000Z"));

    expect(section).toContain("no verified reference material");
    expect(section).toContain(GROUNDING_RULES);
  });
});

describe("the source of truth", () => {
  it("adds no facts of its own — every deadline title comes from data/compliance.ts", () => {
    const block = buildReferenceBlock(facts({}), EARLY) ?? "";
    const titles = new Set(complianceItems.map((item) => item.title));

    // Titles contain em-dashes of their own ("Form 941 — Q2 payroll tax
    // return"), so the title is everything between the date and ". Applies to:".
    const lines = block.split("\n").filter((line) => line.startsWith("[D"));
    expect(lines.length).toBeGreaterThan(0);

    // The other legitimate origin: dates the member typed, turned into
    // deadlines by the renewalSpecs table in lib/deadlines.ts.
    const fromProfile = [
      "Business insurance renews",
      "Industry licence or permit expires",
      "Certification comes up for renewal",
      "SAM.gov registration expires",
      "Lease ends",
    ];

    for (const line of lines) {
      const title = line.match(/^\[D\d+\] \d{4}-\d{2}-\d{2} — (.+?)\. Applies to: /)?.[1];
      expect(title, `could not read a title from: ${line}`).toBeDefined();
      expect(titles.has(title!) || fromProfile.includes(title!)).toBe(true);
    }
  });
});

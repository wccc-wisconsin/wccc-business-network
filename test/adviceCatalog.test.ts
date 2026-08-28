import { describe, expect, it } from "vitest";
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

describe("unverified material", () => {
  /**
   * Every entry in data/wisconsinPrograms.ts currently ships `verified: false`,
   * and the runtime filter hides them. If that ever stops being enforced here,
   * the model would be handed nine unchecked programs as approved fact.
   */
  it("names no Wisconsin program while none has been verified", () => {
    const anyVerified = wisconsinPrograms.some((program) => program.verified);
    const block = buildReferenceBlock(facts({}), EARLY) ?? "";

    if (!anyVerified) {
      for (const program of wisconsinPrograms) {
        expect(block).not.toContain(program.name);
      }
      expect(block).toContain("No Wisconsin support programs have been verified");
    }
  });

  it("tells the model the absence is deliberate, not an omission to fill", () => {
    const block = buildReferenceBlock(facts({}), EARLY) ?? "";

    expect(block).toContain("Do not name specific state or local programs");
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

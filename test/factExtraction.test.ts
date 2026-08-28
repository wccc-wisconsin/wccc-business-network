import { describe, expect, it } from "vitest";
import {
  extractableFactKeys,
  extractionPrompt,
  isExtractableFact,
  validateCandidates,
} from "@/lib/factExtraction";
import { factDefinition } from "@/data/facts";
import type { ChatTurn } from "@/lib/appStore";

/**
 * Extraction is the first thing in this codebase that turns a conversation into
 * profile data, and the profile's whole meaning rests on facts being
 * self-reported. So what is worth pinning is not that it finds things — it is
 * everything it refuses.
 *
 * Three rules, and a candidate must pass all of them: a real, eligible fact
 * key; a value the catalog accepts; and a quote that appears verbatim in what
 * the member actually typed. The third is the one that makes this safer than a
 * well-written prompt, because a fabricated quote becomes a dropped candidate
 * instead of an invisible invention.
 */

function said(...contents: string[]): ChatTurn[] {
  return contents.map((content) => ({ role: "user" as const, content }));
}

const NOW = new Date("2026-08-27T00:00:00.000Z");

const TRANSCRIPT = said(
  "It's me and two on payroll, plus a contractor for deliveries.",
  "We're an LLC, registered here in Wisconsin. Our lease ends 2027-03-31.",
);

describe("what it accepts", () => {
  it("accepts a candidate that names a real fact, a valid value and a real quote", () => {
    const out = validateCandidates(
      [{ key: "has_employees", value: "w2", quote: "me and two on payroll" }],
      TRANSCRIPT,
      NOW,
    );

    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("has_employees");
  });

  it("carries the catalog's label and the readable value, not the stored one", () => {
    const out = validateCandidates(
      [{ key: "has_employees", value: "w2", quote: "me and two on payroll" }],
      TRANSCRIPT,
      NOW,
    );

    expect(out[0].label).toBe(factDefinition("has_employees")!.label);
    // The card must not show a member the raw option value.
    expect(out[0].display).not.toBe("w2");
  });

  /**
   * Models reproduce words reliably and punctuation unreliably. Matching on
   * normalised text keeps the check strict about content — which is what
   * matters — without rejecting honest quotes for cosmetic reasons and pushing
   * someone to loosen it later.
   */
  it("matches a quote whose spacing and case differ", () => {
    const out = validateCandidates(
      [{ key: "has_employees", value: "w2", quote: "Me And   Two On Payroll" }],
      TRANSCRIPT,
      NOW,
    );

    expect(out).toHaveLength(1);
  });
});

describe("what it refuses", () => {
  it("drops a quote that appears nowhere in the transcript", () => {
    const out = validateCandidates(
      [{ key: "has_employees", value: "w2", quote: "we have two full-time staff" }],
      TRANSCRIPT,
      NOW,
    );

    expect(out).toEqual([]);
  });

  /**
   * The coach's own words are not the member's. A fact the assistant asserted
   * and the member never confirmed would otherwise arrive wearing a quote that
   * really is in the transcript.
   */
  it("drops a quote taken from the coach rather than the member", () => {
    const transcript: ChatTurn[] = [
      { role: "user", content: "How do I price catering jobs?" },
      {
        role: "assistant",
        content: "Since it is just you with no staff, start from your own hours.",
      },
    ];

    // "none" is a real option and the quote really is in the transcript — it is
    // only the *speaker* that makes this invalid, which is the whole point.
    const out = validateCandidates(
      [{ key: "has_employees", value: "none", quote: "just you with no staff" }],
      transcript,
      NOW,
    );

    expect(out).toEqual([]);
  });

  it("drops a quote too short to prove anything", () => {
    const out = validateCandidates(
      [{ key: "has_employees", value: "w2", quote: "two" }],
      TRANSCRIPT,
      NOW,
    );

    expect(out).toEqual([]);
  });

  it("drops a value the catalog would reject", () => {
    const out = validateCandidates(
      [{ key: "has_employees", value: "a couple of people", quote: "me and two on payroll" }],
      TRANSCRIPT,
      NOW,
    );

    expect(out).toEqual([]);
  });

  it("drops a fact key that does not exist", () => {
    const out = validateCandidates(
      [{ key: "annual_revenue", value: "120000", quote: "me and two on payroll" }],
      TRANSCRIPT,
      NOW,
    );

    expect(out).toEqual([]);
  });

  /**
   * Free-text facts are deliberately out of scope for now: a wrong
   * `monthly_costs` looks exactly as plausible as a right one on a confirmation
   * card, so there is nothing for the member to catch.
   */
  it("drops a free-text fact even when everything else about it is valid", () => {
    const transcript = said("Our monthly running cost is about four thousand dollars.");

    const out = validateCandidates(
      [{ key: "monthly_costs", value: "about $4,000", quote: "monthly running cost is about four thousand dollars" }],
      transcript,
      NOW,
    );

    expect(out).toEqual([]);
  });

  it("drops a date far outside any plausible range", () => {
    const transcript = said("Our lease ends 3027-03-31, apparently.");

    const out = validateCandidates(
      [{ key: "lease_end_date", value: "3027-03-31", quote: "lease ends 3027-03-31" }],
      transcript,
      NOW,
    );

    expect(out).toEqual([]);
  });

  it("takes one proposal per fact when the model contradicts itself", () => {
    const out = validateCandidates(
      [
        { key: "has_employees", value: "w2", quote: "me and two on payroll" },
        { key: "has_employees", value: "none", quote: "me and two on payroll" },
      ],
      TRANSCRIPT,
      NOW,
    );

    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("w2");
  });

  it("returns nothing rather than throwing on a malformed response", () => {
    expect(validateCandidates(null, TRANSCRIPT, NOW)).toEqual([]);
    expect(validateCandidates("nope", TRANSCRIPT, NOW)).toEqual([]);
    expect(validateCandidates([null, 3, "x", {}], TRANSCRIPT, NOW)).toEqual([]);
  });
});

describe("eligibility", () => {
  it("covers only choice and date facts", () => {
    for (const key of extractableFactKeys()) {
      expect(["choice", "date"]).toContain(factDefinition(key)!.type);
    }
  });

  it("excludes every free-text fact in the catalog", () => {
    expect(isExtractableFact(factDefinition("monthly_costs")!)).toBe(false);
    expect(isExtractableFact(factDefinition("target_customer")!)).toBe(false);
  });

  /**
   * The prompt lists the accepted values so a candidate that would be dropped
   * mostly is not proposed. Validation is still the guarantee — but a prompt
   * that fights it wastes the member's attention on cards that vanish.
   */
  it("tells the model the exact values each fact accepts", () => {
    const prompt = extractionPrompt();

    for (const key of extractableFactKeys()) {
      expect(prompt).toContain(key);
    }
    for (const option of factDefinition("has_employees")!.options ?? []) {
      expect(prompt).toContain(`"${option.value}"`);
    }
  });

  it("offers the model no free-text fact to propose", () => {
    const prompt = extractionPrompt();

    expect(prompt).not.toContain("monthly_costs");
    expect(prompt).not.toContain("target_customer");
  });
});

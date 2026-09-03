import { describe, expect, it } from "vitest";
import { validSelections } from "@/lib/opportunitySelections";

/**
 * The panel used to be all-or-nothing: one malformed entry in a reply of five
 * threw the other four away and told the member the format was wrong. Which
 * field a model fumbles varies run to run, so the same question worked one
 * minute and failed the next — the single worst shape a bug can take, because
 * it reads as the feature being unreliable rather than as something to fix.
 *
 * These pin the replacement rule: judge each entry on its own, and only give up
 * when nothing usable arrived.
 */

const good = (ref: string) => ({ ref, whyItFits: "Fits because…", nextStep: "Call them." });

describe("a reply that is not a list at all", () => {
  it("is null for prose", () => {
    expect(validSelections("Here are some matches!")).toBeNull();
  });

  it("is null for an object", () => {
    expect(validSelections({ matches: [good("W1")] })).toBeNull();
  });

  it("is null for nothing", () => {
    expect(validSelections(null)).toBeNull();
    expect(validSelections(undefined)).toBeNull();
  });
});

describe("a list with something wrong in it", () => {
  it("keeps the good entries and drops only the bad one", () => {
    // The exact case that broke the live panel.
    const kept = validSelections([
      good("W1"),
      good("F2"),
      { ref: "W3", whyItFits: "Fits." },
      good("F4"),
      good("W5"),
    ]);

    expect(kept?.map((s) => s.ref)).toEqual(["W1", "F2", "F4", "W5"]);
  });

  it("drops an entry whose ref is present but empty", () => {
    // An empty ref resolves to no catalog entry, so it can never become an
    // opportunity. Dropping it here keeps the count honest rather than
    // promising a match that quietly disappears one step later.
    const kept = validSelections([good("W1"), { ref: "  ", whyItFits: "x", nextStep: "y" }]);

    expect(kept?.map((s) => s.ref)).toEqual(["W1"]);
  });

  it("drops entries whose fields are the wrong type", () => {
    const kept = validSelections([good("W1"), { ref: "W2", whyItFits: 5, nextStep: null }]);

    expect(kept?.map((s) => s.ref)).toEqual(["W1"]);
  });

  it("returns an empty list when every entry is malformed", () => {
    // Empty, not null: a list did arrive. The caller says something different
    // about that than about a reply that was never a list.
    expect(validSelections([{ nope: true }, { ref: 1 }])).toEqual([]);
  });
});

describe("a well-formed list", () => {
  it("passes every entry through unchanged", () => {
    const input = [good("W1"), good("F2")];

    expect(validSelections(input)).toEqual(input);
  });

  it("distinguishes an empty reply from a non-list", () => {
    // Guards the sloppy version of this rule: returning null for anything
    // falsy-looking would collapse "the model chose nothing" into "the model
    // did not answer", and those need different messages.
    expect(validSelections([])).toEqual([]);
    expect(validSelections([])).not.toBeNull();
  });
});

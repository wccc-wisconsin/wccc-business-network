import { describe, expect, it } from "vitest";
import { toPlainText } from "@/lib/plainText";

describe("toPlainText", () => {
  it("removes bold markers, keeping the words", () => {
    expect(toPlainText("1. **Seller's permit** — confirm with WI DOR.")).toBe(
      "1. Seller's permit — confirm with WI DOR.",
    );
    expect(toPlainText("Apply to the __Supplier Diversity Program__ first.")).toBe(
      "Apply to the Supplier Diversity Program first.",
    );
  });

  it("removes every bold pair on a line, not just the first", () => {
    expect(toPlainText("**Where I am** and **Where I am stuck**")).toBe(
      "Where I am and Where I am stuck",
    );
  });

  it("removes heading markers at the start of a line", () => {
    expect(toPlainText("# Licences & Permits Action List\n## Still needed")).toBe(
      "Licences & Permits Action List\nStill needed",
    );
  });

  it("leaves a hash that is not a heading alone", () => {
    expect(toPlainText("Invoice #42 is due")).toBe("Invoice #42 is due");
    expect(toPlainText("#hashtag")).toBe("#hashtag");
  });

  it("turns star and plus bullets into bullet characters, keeping indentation", () => {
    expect(toPlainText("* EIN\n  + Seller's permit")).toBe("• EIN\n  • Seller's permit");
  });

  it("leaves dash bullets and numbered lists as they are", () => {
    const list = "- Business bank account\n1. Get your EIN";
    expect(toPlainText(list)).toBe(list);
  });

  it("never touches single asterisks, which are arithmetic as often as emphasis", () => {
    expect(toPlainText("20 * $40 = $800 a month")).toBe("20 * $40 = $800 a month");
    expect(toPlainText("a *maybe* italic")).toBe("a *maybe* italic");
  });

  it("does not pair bold markers across lines", () => {
    const text = "Unclosed **start of a thought\nthat a later line closes** by accident";
    expect(toPlainText(text)).toBe(text);
  });

  it("leaves an unfinished marker from a reply that is still streaming", () => {
    expect(toPlainText("Focus on **Seller")).toBe("Focus on **Seller");
  });

  it("keeps line breaks and blank lines", () => {
    const text = "**Where I am**\nI run a caterer.\n\n**Where I am stuck**\nPricing.";
    expect(toPlainText(text)).toBe("Where I am\nI run a caterer.\n\nWhere I am stuck\nPricing.");
  });

  it("returns plain text unchanged", () => {
    const text = "Contact the SBDC office nearest Milwaukee.";
    expect(toPlainText(text)).toBe(text);
  });
});

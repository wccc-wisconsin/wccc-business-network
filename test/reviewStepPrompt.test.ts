import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * House rule: never invent WCCC programs, events or perks. Nothing in this repo
 * lists what WCCC currently runs, so any one a model names is a guess shown to a
 * member as fact.
 *
 * "Review my answers" broke it quietly: its prompt offered "or a WCCC program"
 * as an example of a resource to cite. Found on 2026-09-11.
 *
 * Route prompts live inside route handlers, and Next.js does not allow a route
 * file to export anything but its handlers, so the prompt cannot be imported
 * here. The source is read as text instead — the same approach
 * test/demoSeed.test.ts takes with the seed SQL. It is a check on the words the
 * model is sent, which is exactly where this rule lives.
 */

/**
 * A route's source with comment lines removed, so a comment that quotes the old
 * wording — as the one explaining this fix does — is not mistaken for the
 * prompt.
 */
function withoutComments(path: string): string {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join("\n");
}

const REVIEW_STEP = "app/api/ai/review-step/route.ts";
const source = withoutComments(REVIEW_STEP);

describe("Review my answers prompt", () => {
  it("does not offer a WCCC program as a resource to cite", () => {
    expect(source).not.toMatch(/or a WCCC program/i);
  });

  it("tells the model not to name WCCC programs, and where to send the member instead", () => {
    expect(source).toMatch(/Do not name any WCCC-run program, event or perk/);
    expect(source).toMatch(/point them at info@wisccc\.org/);
  });
});

describe("every AI route", () => {
  const routes = readdirSync("app/api/ai", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `app/api/ai/${entry.name}/route.ts`);

  it("finds the routes it is meant to check", () => {
    expect(routes).toContain(REVIEW_STEP);
  });

  it("never lists a WCCC program among example resources", () => {
    // An "e.g." list is how the model is shown what to cite. A WCCC program in
    // one reads as permission; everywhere else it may appear only to forbid it.
    // The match stops at the end of the list — a full stop or closing bracket —
    // so a separate sentence forbidding WCCC programs does not count.
    const offending = routes.filter((route) =>
      /e\.g\.[^.)`\n]*WCCC(?:-run)? programs?/i.test(withoutComments(route)),
    );
    expect(offending).toEqual([]);
  });
});

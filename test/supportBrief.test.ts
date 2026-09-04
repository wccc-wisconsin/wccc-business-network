import { describe, expect, it } from "vitest";
import { businessModules, findTool, stepsForModule } from "@/data/modules";

/**
 * The WCCC Support Brief is the one tool that is not about a module's subject —
 * it turns what the portal already knows into a page a staff member can act on,
 * so a member never has to retype their situation into an email to get help.
 *
 * That only works if it is wherever they are working. A member stuck in Capital
 * will not go to Launch to find it, and a module quietly missing it would look
 * to them like the feature does not exist.
 */

const BRIEF_KEY = "wccc-support-brief";

/** Every module a member can actually work through — guided steps and a toolkit. */
const guidedModules = businessModules.filter((mod) => stepsForModule(mod).length > 0);

describe("where the brief is offered", () => {
  it("covers every module that has guided steps", () => {
    expect(guidedModules.length).toBeGreaterThan(0);

    const missing = guidedModules
      .filter((mod) => !findTool(mod.key, BRIEF_KEY))
      .map((mod) => mod.key);

    expect(missing).toEqual([]);
  });

  it("resolves through findTool on each of them, which is how the route looks it up", () => {
    // The document route resolves module + tool key server-side and 404s if it
    // cannot. A tool present in the data but unreachable this way would be a
    // button that always errors.
    for (const mod of guidedModules) {
      expect(findTool(mod.key, BRIEF_KEY)?.tool.key).toBe(BRIEF_KEY);
    }
  });

  it("is the same tool everywhere, not seven copies that can drift", () => {
    const briefs = new Set(guidedModules.map((mod) => findTool(mod.key, BRIEF_KEY)?.tool.brief));

    expect(briefs.size).toBe(1);
  });
});

describe("what the brief instructs", () => {
  const tool = findTool(guidedModules[0].key, BRIEF_KEY)?.tool;

  it("forbids naming a WCCC program, which nothing verifies", () => {
    // The house rule this enforces: never invent WCCC programs, events,
    // partners or perks. A brief that told a member to ask about a programme
    // that does not exist would set staff up to disappoint them, and it is the
    // one hallucination this document is uniquely placed to cause.
    expect(tool?.brief).toMatch(/Do NOT name a WCCC program/);
  });

  it("requires an empty section to say so rather than be filled", () => {
    expect(tool?.brief).toMatch(/rather than filling it/);
  });

  it("tells the member to check it before sending", () => {
    // It leaves the portal and reaches a third party, so the member has to be
    // told it is a draft of their own words rather than a record they can
    // assume is current.
    expect(tool?.brief).toMatch(/before sending it/);
  });
});

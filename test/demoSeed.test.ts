import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessmentQuestions } from "@/data/assessment";
import { factDefinition, isValidFactValue } from "@/data/facts";
import { findModule, findStep } from "@/data/modules";

/**
 * `seed-demo-member.sql` writes rows straight into Supabase, so nothing
 * validates it the way the app validates a form. Postgres will happily store a
 * fact key that does not exist, an assessment answer that is not one of the
 * offered options, or a guided step belonging to no module — and every one of
 * those failures looks identical from the outside: the row is there, the
 * dashboard shows nothing, and the seed appears to have half-worked.
 *
 * That is the same class of failure the rest of this suite exists for, so the
 * seed is checked against the same catalogs the app reads.
 *
 * It also catches drift in the other direction. Rename a step key in
 * data/modules.ts and this fails, which is the only warning anyone would get
 * that the demo account no longer demonstrates anything.
 *
 * The parsing is regex over SQL, which is fragile in one specific way: a
 * reformatted file could match nothing and pass vacuously. Each test therefore
 * asserts how much it found before asserting anything about it.
 */

const sql = readFileSync("seed-demo-member.sql", "utf8");

/** The seed block only. The teardown below it is commented out. */
const seed = sql.slice(0, sql.indexOf("-- TEARDOWN"));

describe("seed-demo-member.sql", () => {
  it("answers every Business Snapshot question, with options the form offers", () => {
    const block = seed.slice(
      seed.indexOf("insert into business_assessments"),
      seed.indexOf("on conflict (member_id) do update"),
    );
    expect(block.length).toBeGreaterThan(100);

    for (const [, key, value] of block.matchAll(/'([a-z-]+)',\s*'([a-z0-9-]+)'/g)) {
      const question = assessmentQuestions.find((q) => q.key === key);
      expect(question, `assessment question "${key}"`).toBeDefined();
      expect(question!.options.map((o) => o.value), `value for "${key}"`).toContain(value);
    }

    // A partial Snapshot would store a score that does not match its answers —
    // the form rejects one, and this file has to hold itself to the same rule.
    for (const question of assessmentQuestions) {
      expect(block, `question "${question.key}"`).toContain(`'${question.key}'`);
    }
  });

  it("seeds facts that exist, with values those facts can hold", () => {
    const block = seed.slice(
      seed.indexOf("insert into member_facts"),
      seed.indexOf("on conflict (member_id, fact_key)"),
    );
    const rows = [...block.matchAll(/v_member,\s*'([a-z_]+)',\s*'((?:[^']|'')*)'/g)];
    expect(rows.length).toBeGreaterThan(10);

    for (const [, key, raw] of rows) {
      const def = factDefinition(key);
      expect(def, `fact "${key}"`).toBeDefined();
      // '' is how SQL escapes an apostrophe; the stored value has one.
      expect(isValidFactValue(def!, raw.replace(/''/g, "'")), `value for "${key}"`).toBe(true);
    }
  });

  it("seeds guided answers against real modules, steps and questions", () => {
    const block = seed.slice(seed.indexOf("insert into module_step_progress"));
    const steps = [
      ...block.matchAll(
        /v_member,\s*'([a-z]+)',\s*'([a-z-]+)',\s*true,\s*jsonb_build_object\(([\s\S]*?)\), now\(\)\)/g,
      ),
    ];
    expect(steps.length).toBe(8);

    for (const [, moduleKey, stepKey, body] of steps) {
      expect(findModule(moduleKey), `module "${moduleKey}"`).not.toBeNull();

      const found = findStep(moduleKey, stepKey);
      expect(found, `step "${moduleKey}/${stepKey}"`).not.toBeNull();

      const real = found!.step.questions.map((q) => q.key);
      for (const [, questionKey] of body.matchAll(/'([a-z-]+)',\s*'/g)) {
        expect(real, `question "${questionKey}" in ${moduleKey}/${stepKey}`).toContain(questionKey);
      }
    }
  });
});

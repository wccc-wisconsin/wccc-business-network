import {
  displayFactValue,
  factDefinition,
  isFactStale,
  isValidFactValue,
  type FactDefinition,
} from "@/data/facts";
import type { GuidedQuestion } from "@/data/modules";
import type { FactWrite, MemberFact } from "@/lib/appStore";

/**
 * Turns stored facts into what a guided step should show, and turns saved
 * answers back into facts.
 *
 * Deliberately pure and free of `server-only` so it can be unit-tested and
 * called from either side of the boundary; the data it works on is fetched by
 * the caller.
 */

/** What the member sees above or inside one guided question's box. */
export type QuestionCarryOver = {
  /** Prefill for an empty box, or null when there's nothing to carry. */
  prefill: {
    value: string;
    /** "Launch › Register your business & EIN", or "Business profile". */
    origin: string;
    updatedAt: string;
    /** Past its confirm-by age — shown differently, still offered. */
    stale: boolean;
  } | null;
  /** Read-only context: facts that inform this question without answering it. */
  context: { label: string; value: string; stale: boolean }[];
};

const EMPTY: QuestionCarryOver = { prefill: null, context: [] };

function contextEntry(def: FactDefinition, fact: MemberFact, now: Date) {
  return {
    label: def.label,
    value: displayFactValue(def, fact.value),
    stale: isFactStale(def, fact.confirmedAt, now),
  };
}

/**
 * Resolves one question against the member's facts.
 *
 * `savedAnswer` wins over any carried-over value. An answer the member typed
 * in this step is a direct statement about this question; a fact is an
 * inference that it's the same question. When they disagree, trust the
 * specific one.
 */
export function carryOverForQuestion(
  question: GuidedQuestion,
  facts: Record<string, MemberFact>,
  savedAnswer: string,
  now: Date,
): QuestionCarryOver {
  const context = (question.relatedFacts ?? [])
    .map((key) => {
      const def = factDefinition(key);
      const fact = facts[key];
      if (!def || !fact) return null;
      return contextEntry(def, fact, now);
    })
    .filter((entry): entry is { label: string; value: string; stale: boolean } => entry !== null);

  if (savedAnswer.trim() !== "") return { prefill: null, context };
  if (!question.factKey) return context.length ? { prefill: null, context } : EMPTY;

  const def = factDefinition(question.factKey);
  const fact = facts[question.factKey];
  if (!def || !fact || !isValidFactValue(def, fact.value)) {
    return { prefill: null, context };
  }

  return {
    prefill: {
      value: displayFactValue(def, fact.value),
      origin: fact.sourceLabel || "Business profile",
      updatedAt: fact.updatedAt,
      stale: isFactStale(def, fact.confirmedAt, now),
    },
    context,
  };
}

/**
 * The facts to write from one step's saved answers.
 *
 * Only questions that own a fact produce a write, and only non-empty values
 * (`upsertMemberFacts` drops blanks anyway — this keeps the round trip from
 * being made at all). Values are validated against the catalog here so a
 * malformed date can't reach the store and then fail the deadline maths
 * downstream, where it would be much harder to trace.
 */
export function factWritesFromAnswers(
  questions: GuidedQuestion[],
  answers: Record<string, string>,
  source: string,
  sourceLabel: string,
): FactWrite[] {
  const writes: FactWrite[] = [];
  for (const question of questions) {
    if (!question.factKey) continue;
    const def = factDefinition(question.factKey);
    if (!def) continue;
    const value = (answers[question.key] ?? "").trim();
    if (!isValidFactValue(def, value)) continue;
    writes.push({ key: question.factKey, value, source, sourceLabel });
  }
  return writes;
}

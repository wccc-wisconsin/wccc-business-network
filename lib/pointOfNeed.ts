import { complianceItems, daysUntil } from "@/data/compliance";
import { factDefinition, isValidFactValue, type FactDefinition } from "@/data/facts";
import { deadlinesForMember } from "@/lib/deadlines";
import { wisconsinProgramsForMember } from "@/lib/wisconsinFit";
import type { FactWrite, MemberFact } from "@/lib/appStore";

/**
 * Asking for a fact at the moment it pays off.
 *
 * Five facts change what two lists show: the deadline calendar reads
 * formation date and state, headcount and estimated-tax status; the Wisconsin
 * funding entries read ownership basis and bank account. Until now those were
 * collected in the Business Snapshot, a form a member fills in — or doesn't —
 * before they have any reason to. This module lets each list ask for just the
 * facts it is missing, right above the rows they would narrow, so the answer
 * and its effect are on the same screen.
 *
 * It is a layer around the filters, not a change to them. Both filters keep
 * their contract (unknown shows the row — see lib/deadlines.ts and
 * lib/wisconsinFit.ts); this only decides which questions are still worth
 * asking, counts the rows before and after, and turns the answers into the
 * same fact writes the Snapshot produces. One place to write, one function to
 * assemble, nothing asked twice: a fact already on file from anywhere — the
 * Snapshot, a guided step, a Coach card — is never asked for again here.
 *
 * Pure and free of `server-only`, like lib/carryOver.ts, so the component and
 * the server action share it and the tests can drive it directly.
 */

export type PromptSurface = "deadlines" | "funding";

/**
 * Which facts each list asks for, in the order they are shown.
 *
 * `formation_state` is in the deadline set even though the design notes count
 * three facts, because `audienceVerdict` in lib/deadlines.ts reads it: an
 * entity formed in another state files its annual report on 31 March
 * regardless of its formation quarter, so a formation date on its own can put
 * the wrong annual-report row in front of that member. `seller_permit` is
 * *not* here — nothing in the calendar reads it yet.
 */
export const promptFactKeys: Record<PromptSurface, readonly string[]> = {
  deadlines: ["formation_date", "formation_state", "has_employees", "pays_estimated_tax"],
  funding: ["ownership_basis", "bank_account"],
};

/**
 * Provenance written with each answer, shown beside the value wherever a fact's
 * origin is displayed (the profile grid, a guided step's "carried from" line).
 * Named for the place the member was looking when they answered, which is the
 * thing they will recognise later.
 */
export const promptProvenance: Record<PromptSurface, { source: string; sourceLabel: string }> = {
  deadlines: { source: "deadlines", sourceLabel: "Answered on your Deadlines list" },
  funding: { source: "funding", sourceLabel: "Answered under Funding & Programs" },
};

/** True when a usable answer for this fact is on file, from any source. */
function onFile(facts: Record<string, MemberFact>, def: FactDefinition): boolean {
  const stored = facts[def.key]?.value ?? "";
  return isValidFactValue(def, stored);
}

/**
 * The questions a list still needs to ask, in display order.
 *
 * "Not sure" and "Prefer not to say" are answers. They leave the filter in its
 * unknown state, but the member has said what they can, and asking again would
 * be the nagging this whole mechanism is meant to replace. A stored value the
 * catalog no longer recognises is not an answer — the filter cannot read it —
 * so that one is asked again.
 */
export function missingPromptFacts(
  surface: PromptSurface,
  facts: Record<string, MemberFact>,
): FactDefinition[] {
  const out: FactDefinition[] = [];
  for (const key of promptFactKeys[surface]) {
    const def = factDefinition(key);
    if (!def) continue;
    if (!onFile(facts, def)) out.push(def);
  }
  return out;
}

/** Rows before and after the member's facts were applied. */
export type Narrowing = {
  /** Rows the member is offered — including the ones their facts left open. */
  shown: number;
  /** Rows there would be with no facts on file at all. */
  total: number;
};

/**
 * Upcoming filings, with and without this member's facts.
 *
 * Counted on upcoming calendar rows only. `filteredOut` on the deadline view
 * counts every calendar row the facts removed, including ones already past —
 * which is the right number for "did filtering happen" and the wrong one for
 * "showing 1 of 9", where a member would compare it against what is on screen.
 * Profile dates (renewals the member typed) are left out of both sides: they
 * are never narrowed, so they would inflate both numbers equally.
 */
export function deadlineNarrowing(facts: Record<string, MemberFact>, now: Date): Narrowing {
  const total = complianceItems.filter((item) => daysUntil(item.date, now) >= 0).length;
  const shown = deadlinesForMember(facts, now).upcoming.filter(
    (item) => item.origin === "calendar",
  ).length;
  return { shown, total };
}

/** Verified Wisconsin programs, with and without this member's facts. */
export function fundingNarrowing(facts: Record<string, MemberFact>, now: Date): Narrowing {
  const view = wisconsinProgramsForMember(facts, now);
  return { shown: view.programs.length, total: view.programs.length + view.filteredOut };
}

/**
 * The fact writes one prompt's answers produce.
 *
 * Only this surface's keys are read — a value posted under any other key is
 * ignored, however valid, because the prompt never asked for it and the
 * Snapshot remains the place a member changes an answer on purpose. Blank and
 * malformed values are skipped rather than failing the save, exactly as the
 * Snapshot does: answering one of three is still one fewer question next time.
 */
export function promptFactWrites(
  surface: PromptSurface,
  answers: Record<string, string>,
): FactWrite[] {
  const { source, sourceLabel } = promptProvenance[surface];
  const writes: FactWrite[] = [];
  for (const key of promptFactKeys[surface]) {
    const def = factDefinition(key);
    if (!def) continue;
    const value = (answers[key] ?? "").trim();
    if (!isValidFactValue(def, value)) continue;
    writes.push({ key, value, source, sourceLabel });
  }
  return writes;
}

/**
 * The smallest slice of Web Storage the dismissal needs. Typed this narrowly
 * so the tests can hand in a plain object, and so nothing here depends on
 * `window` existing.
 */
export type DismissalStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function dismissalKey(surface: PromptSurface): string {
  return `wccc:fact-prompt-dismissed:${surface}`;
}

/**
 * Whether the member has waved this prompt away.
 *
 * Remembered in the browser, not on the profile: a dismissal is "not now", a
 * preference about this screen on this device, and writing it to
 * `member_facts` would make a non-answer look like an answer everywhere facts
 * are read. Storage that is missing, blocked or throwing (private windows,
 * cleared site data) reads as not dismissed, so the worst case is a prompt
 * shown once more — never a prompt that cannot be shown.
 */
export function isPromptDismissed(
  surface: PromptSurface,
  storage: DismissalStorage | null,
): boolean {
  try {
    return storage?.getItem(dismissalKey(surface)) === "1";
  } catch {
    return false;
  }
}

/** Records a dismissal. Never throws; see isPromptDismissed. */
export function dismissPrompt(surface: PromptSurface, storage: DismissalStorage | null): void {
  try {
    storage?.setItem(dismissalKey(surface), "1");
  } catch {
    // Nothing to do: the prompt hides for this render and may come back next
    // load, which is the acceptable failure.
  }
}

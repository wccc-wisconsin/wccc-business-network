import {
  activeWisconsinPrograms,
  type WisconsinProgram,
  type WisconsinRequirement,
} from "@/data/wisconsinPrograms";
import type { MemberFact } from "@/lib/appStore";

/**
 * Which verified Wisconsin entries are worth putting in front of one member.
 *
 * The funding matcher used to receive every verified entry for every member and
 * decide fit from four columns — business name, industry, city, tier. It wrote
 * a confident "why this fits you" either way, which is the failure mode hardest
 * to notice, because the output looks personalised whether or not it is. This
 * moves the disqualifying half of that judgement into code, on the same
 * principle as lib/opportunityCatalog.ts: a structural guarantee rather than a
 * better-worded prompt.
 *
 * Modelled directly on `audienceVerdict` in lib/deadlines.ts, including the
 * three-way answer, because the two problems are the same problem. What differs
 * is which way an unknown leans, and that difference is the whole design:
 *
 *   - A deadline shown to someone it does not apply to costs a moment's
 *     confusion. A deadline hidden from someone it does apply to costs a
 *     missed filing. So unknown keeps the row.
 *   - A funding entry shown to someone it cannot help costs a wasted click. An
 *     entry hidden from someone who qualifies costs them the money. So unknown
 *     keeps the entry here too.
 *
 * Both lean the same way, and both lean toward showing. Only a fact that
 * positively rules a member out removes anything. That is why so little is
 * expressed as a requirement — see the note on WisconsinRequirement.
 */

export type FitVerdict = "applies" | "unknown" | "no";

function value(facts: Record<string, MemberFact>, key: string): string {
  return facts[key]?.value?.trim() ?? "";
}

/**
 * One requirement against one member's facts.
 *
 * Every branch returns "unknown" for a missing answer rather than falling
 * through to "no". A member who has not filled in their Business Snapshot has
 * not told us they are ineligible — they have told us nothing, and those are
 * different.
 */
export function requirementVerdict(
  requirement: WisconsinRequirement,
  facts: Record<string, MemberFact>,
): FitVerdict {
  if (requirement.kind === "qualifying-ownership") {
    const basis = value(facts, "ownership_basis");
    if (!basis) return "unknown";
    // "decline" is a member declining to answer, not a member saying no. It has
    // to behave like an unanswered question or the portal would quietly punish
    // the one honest option for someone who would rather not disclose.
    if (basis === "decline") return "unknown";
    return basis === "none" ? "no" : "applies";
  }

  // lender-relationship. `bank_account` is the closest thing the portal asks,
  // and it is the right proxy: no separate business account is a reliable sign
  // there is no lending relationship behind it either.
  const account = value(facts, "bank_account");
  if (!account) return "unknown";
  return account === "yes" ? "applies" : "no";
}

/**
 * The verdict for a whole entry: the least favourable of its requirements.
 *
 * One disqualifying answer is enough, and an entry with no requirements is
 * "applies" — which is six of the eight, and correct. They suit anybody.
 */
export function programVerdict(
  program: WisconsinProgram,
  facts: Record<string, MemberFact>,
): FitVerdict {
  let verdict: FitVerdict = "applies";

  for (const requirement of program.requirements ?? []) {
    const next = requirementVerdict(requirement, facts);
    if (next === "no") return "no";
    if (next === "unknown") verdict = "unknown";
  }

  return verdict;
}

export type WisconsinFitView = {
  /** Entries to offer this member, in catalog order. */
  programs: WisconsinProgram[];
  /**
   * How many verified entries this member's own facts removed.
   *
   * Returned rather than discarded so the panel can say "2 programs don't
   * apply to you" instead of silently showing a shorter list — the same reason
   * `filteredOut` exists on MemberDeadlineView. A member who cannot see that
   * filtering happened has no way to notice when it is wrong, and this filter
   * runs on self-reported facts that may be stale or mistyped.
   */
  filteredOut: number;
};

/**
 * The verified entries, minus the ones this member's facts rule out.
 *
 * `now` is threaded through to `activeWisconsinPrograms` rather than defaulted,
 * for the reason spelled out in lib/adviceCatalog.ts: a caller that fixes an
 * instant must get that instant everywhere, or one half of an answer silently
 * disagrees with the other about what day it is.
 */
export function wisconsinProgramsForMember(
  facts: Record<string, MemberFact>,
  now = new Date(),
): WisconsinFitView {
  const active = activeWisconsinPrograms(now);
  const programs = active.filter((program) => programVerdict(program, facts) !== "no");

  return { programs, filteredOut: active.length - programs.length };
}

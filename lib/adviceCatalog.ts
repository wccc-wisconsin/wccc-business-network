import { deadlinesForMember, type MemberDeadline } from "@/lib/deadlines";
import { LAST_VERIFIED as COMPLIANCE_LAST_VERIFIED } from "@/data/compliance";
import { activeWisconsinPrograms, wisconsinLastVerified } from "@/data/wisconsinPrograms";
import type { MemberFact } from "@/lib/appStore";

/**
 * The verified material an AI surface is allowed to state as fact.
 *
 * This is lib/opportunityCatalog.ts's idea applied to advice instead of
 * funding, and it exists for the same reason. That file stopped the model
 * *recalling* grant programs by handing it a retrieved list to select from, and
 * the difference was not academic: a program that closed in 2024 and a program
 * that never existed both used to arrive looking exactly like a real one.
 *
 * The Coach and the Decision Grill never got that treatment. They still answer
 * questions about seller's permit thresholds, DFI filings, annual-report fees
 * and renewal windows out of the model's memory, hedged only by a line in the
 * prompt asking them not to guess. Those are the answers where being
 * confidently wrong costs a member a penalty or a wasted filing — which is
 * exactly the class of error the funding work was rewritten to make structurally
 * impossible.
 *
 * The guarantee here is weaker than the funding one, and it is worth being
 * precise about why rather than overclaiming. In /api/ai/opportunities the model
 * returns *references* and the server reads every fact back out of the catalog,
 * so a hallucinated program cannot physically reach a member. A chat reply is
 * free prose; nothing can structurally stop a model asserting a date. What this
 * does is remove the reason to: the dates, fees and sources it would otherwise
 * have to recall are in front of it, already filtered to this member, each with
 * the agency and URL to attribute it to. The prompt rule below then draws the
 * line clearly — attribute or decline.
 *
 * Everything here is already human-verified elsewhere in the repo:
 *   - data/compliance.ts — explicit dated filings, each checked against its
 *     agency, with LAST_VERIFIED recording when.
 *   - data/wisconsinPrograms.ts — only entries someone at WCCC has confirmed,
 *     and only while that confirmation is under 180 days old.
 *
 * Nothing is added here that is not already verified somewhere else. This file
 * formats and scopes; it is not a second place to write facts down.
 */

/**
 * Bounded, and applied after the member filter rather than before it.
 *
 * This block goes into the cached half of the Coach and Grill prompts, so it is
 * paid for once per conversation rather than per turn — but an unbounded list
 * would still push the useful part of the prompt further from the model's
 * attention on every request. Eight is comfortably more than any member has
 * applicable in a quarter; lib/deadlines.ts has already dropped the rows their
 * facts rule out, so these are the eight most imminent that could apply.
 */
const MAX_DEADLINES = 8;

/**
 * The rule that makes the list mean something.
 *
 * Shared by every surface that embeds a reference block, so the three prompts
 * cannot drift into three different standards for the same question. The
 * wording is deliberately about *categories* — dates, fees, form numbers,
 * thresholds, program names — rather than "don't hallucinate", because a model
 * asked not to hallucinate has no way to tell which of its beliefs qualify.
 */
export const GROUNDING_RULES = `Grounding, which overrides anything else in this prompt:
- Specific Wisconsin or federal facts — filing dates, fees, form numbers, tax thresholds, licence requirements, agency names, program names — may come only from the reference material above. State them with the source named there so the member can check it.
- If the reference material does not answer the question, say so plainly and name what you would check and where (the agency, the form, the office to call). That is a useful answer. A confident figure recalled from memory is not, and a member acts on it.
- Never state a dollar amount, a deadline, a form number or a program name that is not in the reference material. "I don't have the current figure — WI DFI publishes it at dfi.wi.gov" is always better than a number.
- You are not their attorney, accountant, or financial adviser. Where an answer turns on their specific circumstances, name the professional to confirm it with.`;

/** "applies to them" vs "might apply — their profile doesn't settle it". */
function certaintyNote(deadline: MemberDeadline): string {
  return deadline.certainty === "applies"
    ? "Confirmed to apply to this member."
    : "May or may not apply — their profile does not settle it, so raise it as a question rather than a fact about them.";
}

function deadlineLines(deadlines: MemberDeadline[]): string[] {
  return deadlines.slice(0, MAX_DEADLINES).map((deadline, index) => {
    const source = deadline.sourceName
      ? ` Source: ${deadline.sourceName}${deadline.sourceUrl ? ` (${deadline.sourceUrl})` : ""}.`
      : "";
    return `[D${index + 1}] ${deadline.date} — ${deadline.title}. Applies to: ${deadline.appliesTo}. ${deadline.detail}${source} ${certaintyNote(deadline)}`;
  });
}

function programLines(): string[] {
  return activeWisconsinPrograms().map(
    (program, index) =>
      `[R${index + 1}] ${program.name} — ${program.type}. ${program.description} (${program.url})`,
  );
}

/**
 * The reference block for one member, or null when there is nothing verified to
 * offer.
 *
 * Returning null rather than an empty heading matters: a prompt that says
 * "Verified reference material:" followed by nothing reads to a model as though
 * the material was withheld, and invites it to fill the gap. The caller adds the
 * fallback wording instead — see `NO_REFERENCES_NOTE`.
 */
export function buildReferenceBlock(
  facts: Record<string, MemberFact>,
  now: Date,
): string | null {
  const { upcoming } = deadlinesForMember(facts, now);
  const deadlines = deadlineLines(upcoming);
  const programs = programLines();

  if (deadlines.length === 0 && programs.length === 0) return null;

  const sections: string[] = [];

  if (deadlines.length > 0) {
    sections.push(
      `Filing deadlines that could apply to this member, soonest first (checked against the agencies on ${COMPLIANCE_LAST_VERIFIED}):\n${deadlines.join(
        "\n",
      )}`,
    );
  }

  if (programs.length > 0) {
    const verifiedOn = wisconsinLastVerified();
    sections.push(
      `Wisconsin resources someone at WCCC has confirmed${
        verifiedOn ? ` (most recent check ${verifiedOn})` : ""
      }:\n${programs.join("\n")}`,
    );
  } else {
    // Said out loud rather than left as an absence. A model given a deadline
    // list and no program list will otherwise reach for the program names it
    // remembers, which is the exact failure this file exists to prevent.
    sections.push(
      "No Wisconsin support programs have been verified for this portal yet, so there is no approved list of them. Do not name specific state or local programs; describe the kind of organisation to look for, or point the member at info@wisccc.org.",
    );
  }

  return `Verified reference material — this is the only place your Wisconsin and federal specifics may come from:\n\n${sections.join(
    "\n\n",
  )}`;
}

/**
 * Used in place of the block when a member has nothing applicable at all — a
 * brand-new profile with no facts and no verified programs.
 *
 * The grounding rules still apply; there is simply nothing they permit yet,
 * which the model needs told explicitly or it will read the silence as
 * permission.
 */
export const NO_REFERENCES_NOTE =
  "There is no verified reference material available for this member, so you have nothing you may state as a Wisconsin or federal specific. Answer from general business reasoning, and for anything involving a date, fee, form or program, name the agency to check rather than the figure.";

/** The reference block plus its rules, ready to concatenate into a prompt. */
export function referenceSection(facts: Record<string, MemberFact>, now: Date): string {
  const block = buildReferenceBlock(facts, now);
  return `${block ?? NO_REFERENCES_NOTE}\n\n${GROUNDING_RULES}`;
}

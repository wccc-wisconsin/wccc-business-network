import "server-only";

import {
  getBusinessAssessment,
  getCompletedStepsByModule,
  getMemberById,
  getMemberFacts,
  type Member,
  type MemberFact,
} from "@/lib/appStore";
import {
  displayFactValue,
  factDefinition,
  isFactStale,
  type FactDefinition,
} from "@/data/facts";
import {
  isModuleUnlocked,
  roadmapTracks,
  stepsForModule,
  type BusinessModule,
} from "@/data/modules";

// One description of who a member is, shared by every AI surface in the portal.
//
// Before this existed, each route assembled its own slice: the coach knew the
// member's profile and their progress in the one module they were looking at,
// the Decision Grill knew the profile and the Business Snapshot stage but
// nothing about the roadmap, and neither knew what the other knew. A member
// asking the same question in two places got two differently-informed answers,
// and had to work out which box to ask.
//
// Building it in one place means adding a fact to the member's profile lights
// it up everywhere at once, rather than in whichever route someone remembers
// to update.

const tierLabels: Record<string, string> = {
  network: "Network (free tier)",
  individual: "Individual member",
  business: "Business member",
  corporate: "Corporate member",
};

const journeyLabels: Record<string, string> = {
  business: "Know Your Business (business growth track)",
  personal: "Know Yourself (personal growth track)",
  both: "Both the business and personal growth tracks",
};

export type MemberContext = {
  member: Member;
  /** Ready-to-embed prose describing the member for a system prompt. */
  summary: string;
  /** The member's facts, for callers that need the values rather than prose. */
  facts: Record<string, MemberFact>;
};

/**
 * The facts section of the summary.
 *
 * Written as "the member told us X" rather than "X is true", and stale values
 * are marked as such, because everything here is self-reported and some of it
 * is months old. An assistant that treats a year-old headcount as current
 * gives advice built on a business that no longer exists — and does it
 * confidently, which is worse than not knowing.
 */
function factLines(facts: Record<string, MemberFact>, now: Date): string {
  const entries: { def: FactDefinition; fact: MemberFact }[] = [];
  for (const fact of Object.values(facts)) {
    const def = factDefinition(fact.key);
    // A fact whose definition has since been removed from the catalog is
    // skipped rather than rendered raw: without a label it would reach the
    // prompt as an unexplained key/value pair.
    if (def) entries.push({ def, fact });
  }

  if (entries.length === 0) {
    return "You have no saved details about this business beyond the profile above — ask for specifics rather than assuming them.";
  }

  const lines = entries
    .sort((a, b) => a.def.label.localeCompare(b.def.label))
    .map(({ def, fact }) => {
      const value = displayFactValue(def, fact.value);
      const stale = isFactStale(def, fact.confirmedAt, now);
      return `- ${def.label}: ${value}${stale ? " (last confirmed a while ago — worth checking before relying on it)" : ""}`;
    });

  return `What they've told the portal about their business:\n${lines.join("\n")}`;
}

/** Per-module completion, used for the roadmap section of the summary. */
type ModuleStanding = {
  module: BusinessModule;
  unlocked: boolean;
  completed: number;
  total: number;
};

function standingsFor(
  member: Member,
  freeModuleKey: string | null,
  completedByModule: Record<string, string[]>,
): ModuleStanding[] {
  const tracks = roadmapTracks.filter(
    (track) => track.key === member.journey || member.journey === "both",
  );

  return tracks.flatMap((track) =>
    track.modules.map((mod) => {
      const steps = stepsForModule(mod);
      const done = new Set(completedByModule[mod.key] ?? []);
      return {
        module: mod,
        unlocked: isModuleUnlocked(member.membershipTier, mod, freeModuleKey),
        // Intersected with the module's current steps for the same reason the
        // dashboard does it: stored rows outlive edits to data/modules.ts, so
        // counting them blind can report more completed steps than exist.
        completed: steps.filter((step) => done.has(step.key)).length,
        total: steps.length,
      };
    }),
  );
}

function roadmapLines(standings: ModuleStanding[]): string {
  const withSteps = standings.filter((s) => s.total > 0);
  if (withSteps.length === 0) {
    return "Their track has no guided steps built yet, so they have no roadmap progress to speak of — don't refer to steps they can't see.";
  }

  const lines = withSteps.map((s) => {
    const state = !s.unlocked
      ? `locked (needs ${s.module.minTier} tier or above)`
      : s.completed === s.total
        ? "complete"
        : `${s.completed} of ${s.total} steps done`;
    return `- ${s.module.label} (${s.module.tagline}): ${state}`;
  });

  return `Their roadmap standing:\n${lines.join("\n")}`;
}

/**
 * Assembles the shared context for one member. Returns null when there's no
 * member row (caller should 404) so every AI route handles that case the same
 * way.
 *
 * `focusModuleKey` is optional: pass it from a module page so the assistant
 * knows what the member is currently looking at. Without it the summary is
 * still complete — it just has no "currently viewing" line, which is correct
 * for the dashboard.
 */
export async function buildMemberContext(
  memberId: string,
  focusModuleKey?: string | null,
): Promise<MemberContext | null> {
  const [member, assessment, completedByModule, facts] = await Promise.all([
    getMemberById(memberId),
    getBusinessAssessment(memberId),
    getCompletedStepsByModule(memberId),
    getMemberFacts(memberId),
  ]);

  if (!member) return null;

  const standings = standingsFor(member, assessment?.freeModuleKey ?? null, completedByModule);
  const focus = focusModuleKey
    ? standings.find((s) => s.module.key === focusModuleKey)
    : undefined;

  const parts: string[] = [
    `You are helping ${member.name || "a WCCC member"}, who runs ${
      member.businessName || "a small business"
    } (industry: ${member.industry || "not specified"}) in ${member.city || "Wisconsin"}.`,
    `Membership: ${tierLabels[member.membershipTier] ?? member.membershipTier}. Track: ${
      journeyLabels[member.journey] ?? member.journey
    }.`,
  ];

  if (assessment) {
    parts.push(
      `Their Business Snapshot puts them at: ${assessment.stage}. Treat that as their self-reported starting point, not a verified fact.`,
    );
  } else {
    parts.push(
      "They haven't filled in the Business Snapshot yet, so you don't know their stage — ask rather than assume.",
    );
  }

  parts.push(factLines(facts, new Date()));

  parts.push(roadmapLines(standings));

  if (focus) {
    parts.push(
      `Right now they are looking at the "${focus.module.label}" module (${focus.module.tagline}).`,
    );
  }

  // Completion here is self-reported — the member ticks a checkbox, nothing
  // verifies the work. Saying so keeps the assistant from congratulating
  // someone on work it has no evidence of.
  parts.push(
    "Roadmap steps are marked complete by the member themselves and are not verified, so treat them as intent rather than proof of finished work.",
  );

  parts.push(
    "Everything above is what the member typed, not verified fact. Where a detail matters to your answer and isn't listed, ask for it instead of inventing it.",
  );

  return { member, summary: parts.join("\n\n"), facts };
}

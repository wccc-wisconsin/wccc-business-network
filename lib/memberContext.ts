import "server-only";

import {
  getBusinessAssessment,
  getCompletedStepsByModule,
  getMemberById,
  getMemberDecisions,
  getMemberDocumentTitles,
  getMemberFacts,
  getModuleSummaryRefs,
  type Member,
  type MemberArtifactRef,
  type MemberFact,
  type ModuleSummaryRef,
  type SavedDecision,
} from "@/lib/appStore";
import {
  displayFactValue,
  factDefinition,
  isFactStale,
  type FactDefinition,
} from "@/data/facts";
import {
  findModule,
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
 * Bounds on the artifact section below, applied as query limits so the rows are
 * never fetched in the first place.
 *
 * This text sits inside the *cached* half of the Coach and Decision Grill
 * prompts, which puts two requirements on it. It has to stay small, or a member
 * who has generated thirty documents carries thirty lines on every turn. And
 * its ordering has to be deterministic, because a cache entry is matched on an
 * exact prefix — a list that reshuffled between turns would miss the cache
 * every time and make the caching worse than useless. Newest-first from the
 * database gives both.
 *
 * Saving a new artifact does change the prompt, and so costs one cache write on
 * the member's next turn. That is the right trade: it happens once per
 * artifact, not once per turn.
 */
const MAX_CONTEXT_DECISIONS = 3;
const MAX_CONTEXT_SUMMARIES = 6;
const MAX_CONTEXT_DOCUMENTS = 6;

/** "2026-08-25" from an ISO timestamp — the time of day is noise here. */
function isoDate(value: string): string {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : "date unknown";
}

/** A module's display label, falling back to its key if it has since been removed. */
function moduleLabel(moduleKey: string): string {
  return findModule(moduleKey)?.module.label ?? moduleKey;
}

/**
 * What the member has already produced in the portal.
 *
 * Before this existed the portal remembered a member's work and the assistant
 * did not. Someone could spend twenty minutes in the Decision Grill on whether
 * to lease a commercial kitchen, save the brief, then ask the Coach a cash-flow
 * question and be answered by an assistant that had never heard of the lease.
 * Every surface made them re-explain their own business, and the advice never
 * compounded.
 *
 * Titles and one-line recommendations only. The full bodies stay in Supabase: a
 * decision brief plus a 90-day plan runs to thousands of tokens on every
 * request, and the assistant does not need to re-read a document to know it
 * exists and point the member back at it. If it needs the contents, the right
 * move is to ask — which is what the closing line tells it to do.
 *
 * Returns null rather than an empty section when the member has produced
 * nothing, so a new member's prompt does not carry three empty headings.
 */
function artifactLines(
  decisions: SavedDecision[],
  summaries: ModuleSummaryRef[],
  documents: MemberArtifactRef[],
): string | null {
  const sections: string[] = [];

  if (decisions.length > 0) {
    const lines = decisions
      .slice(0, MAX_CONTEXT_DECISIONS)
      .map(
        (d) =>
          `- "${d.topic}" (${isoDate(d.createdAt)}) — the brief advised, at ${d.brief.confidence.toLowerCase()} confidence: ${d.brief.recommendation}`,
      );
    sections.push(`Decisions they have already grilled:\n${lines.join("\n")}`);
  }

  if (summaries.length > 0) {
    const lines = summaries
      .slice(0, MAX_CONTEXT_SUMMARIES)
      .map((s) => `- ${s.title} (${moduleLabel(s.moduleKey)}, updated ${isoDate(s.updatedAt)})`);
    sections.push(`Module summaries they have saved:\n${lines.join("\n")}`);
  }

  if (documents.length > 0) {
    const lines = documents
      .slice(0, MAX_CONTEXT_DOCUMENTS)
      .map((d) => `- ${d.title} (${moduleLabel(d.moduleKey)}, ${isoDate(d.createdAt)})`);
    sections.push(`Documents the portal has generated for them:\n${lines.join("\n")}`);
  }

  if (sections.length === 0) return null;

  return `Work they have already done in the portal:\n\n${sections.join(
    "\n\n",
  )}\n\nThese are what the portal advised or drafted, not proof of what they did. Build on them rather than asking the same questions again — but ask whether they acted on one before assuming they did.`;
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
  // Seven reads rather than four. They are issued together and every one is a
  // small, member_id-filtered, column-limited query, so the added latency is
  // one query's worth at most — nothing next to the model call that follows.
  // The three new ones deliberately fetch no document or summary bodies; see
  // getMemberDocumentTitles in lib/appStore.ts for why that is a separate
  // function rather than a flag.
  const [member, assessment, completedByModule, facts, decisions, summaries, documents] =
    await Promise.all([
      getMemberById(memberId),
      getBusinessAssessment(memberId),
      getCompletedStepsByModule(memberId),
      getMemberFacts(memberId),
      getMemberDecisions(memberId, MAX_CONTEXT_DECISIONS),
      getModuleSummaryRefs(memberId, MAX_CONTEXT_SUMMARIES),
      getMemberDocumentTitles(memberId, MAX_CONTEXT_DOCUMENTS),
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

  const artifacts = artifactLines(decisions, summaries, documents);
  if (artifacts) parts.push(artifacts);

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

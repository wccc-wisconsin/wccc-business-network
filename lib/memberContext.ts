import "server-only";

import {
  getBusinessAssessment,
  getCompletedStepsByModule,
  getMemberById,
  getMemberDecisions,
  getMemberDocumentTitles,
  getMemberFacts,
  getModuleSummaryRefs,
  listConversations,
  type ConversationSummary,
  type Member,
  type MemberArtifactRef,
  type MemberFact,
  type ModuleSummaryRef,
  type SavedDecision,
} from "@/lib/appStore";
import {
  BILINGUAL_ENABLED,
  displayFactValue,
  factDefinition,
  isFactStale,
  type FactDefinition,
} from "@/data/facts";
import { referenceSection } from "@/lib/adviceCatalog";
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
  /**
   * How to answer, when the member has asked for a language other than English.
   * Empty string otherwise, and empty for everyone while BILINGUAL_ENABLED is
   * off — see buildLanguageDirective.
   *
   * A third thing again, kept out of both `summary` and `references` for the
   * same reason those two are kept apart: `summary` is who the member is,
   * `references` is what may be asserted, and this is what language to say it
   * in. A surface that answers a member embeds it; one that only summarises
   * their own words back to them has to decide for itself, which is the point
   * of it being separate.
   */
  languageDirective: string;
  /**
   * Verified reference material plus the rules for using it — see
   * lib/adviceCatalog.ts.
   *
   * Kept out of `summary` deliberately, even though every surface that answers
   * a member's question wants both. `summary` describes who the member is; this
   * describes what the assistant is allowed to assert. Merging them would mean
   * the one surface that should NOT carry grounding rules — a route that only
   * summarises what the member wrote — silently acquires them, and a future
   * reader could not tell which half a line came from.
   *
   * Any new AI surface that answers questions rather than summarising should
   * embed this.
   */
  references: string;
};

/** The fact carrying the member's language choice. */
export const LANGUAGE_FACT_KEY = "preferred_language";

/**
 * What each stored value is called when the model is told to write in it.
 *
 * Named in English on purpose: this is an instruction to the model, not text a
 * member reads, and "write in Chinese (Traditional)" is less ambiguous to a
 * model than a directive written in the target language would be.
 */
const languageNames: Record<string, string> = {
  "zh-Hans": "Simplified Chinese (简体中文)",
  "zh-Hant": "Traditional Chinese (繁體中文)",
  es: "Spanish (Español)",
  hmn: "Hmong (Hmoob)",
};

/**
 * How to answer, for a member who asked for something other than English.
 *
 * Returns "" whenever BILINGUAL_ENABLED (data/facts.ts) is off — which it is —
 * and, when it is on, for English, for no preference, and for a stored value
 * that names no language we offer — all three mean "answer the way you always have", and
 * an empty string appended to a prompt changes nothing. A value that is not in
 * the table is treated as absent rather than passed through: handing the model
 * a language name taken from the database would be the one place in this file
 * where stored text becomes an instruction.
 *
 * What the rules protect, in order:
 *
 *   - **Names and numbers stay in English.** A translated agency name is worse
 *     than useless — it is a search that returns nothing, for a member standing
 *     in front of a government form. This is the whole reason the feature has
 *     rules at all rather than just "reply in X".
 *   - **JSON keys stay in English.** Three surfaces parse the reply
 *     (`review-step`, the Grill's brief, `opportunities`). A translated key
 *     does not fail loudly; it fails as a blank panel.
 *   - **Say so if you cannot.** A model that half-translates, or answers in
 *     English without explanation, leaves the member unsure whether the feature
 *     is broken or their answer was.
 *
 * The JSON rule is carried even on surfaces that return prose. One directive
 * with one wording is a single thing to get right and a single thing to change,
 * and on a prose surface the clause is inert — it costs a few tokens inside a
 * prompt that is cached anyway.
 */
export function buildLanguageDirective(facts: Record<string, MemberFact>): string {
  // The feature switch, checked here rather than at the two call sites.
  //
  // This function is the only route a stored language takes into a prompt, so
  // one branch here turns the feature off everywhere, including on a surface
  // written after this comment. Gating the callers instead would have worked
  // today and failed the first time someone added an eighth AI surface and
  // called this directly — they would get a working translator that nobody
  // decided to switch on.
  //
  // Off is exactly the no-preference path below, which every surface already
  // handles: an empty string appended to a prompt changes nothing.
  if (!BILINGUAL_ENABLED) return "";

  const choice = facts[LANGUAGE_FACT_KEY]?.value ?? "";
  const name = languageNames[choice];
  if (!name) return "";

  return `Language: this member has asked to be answered in ${name}. Write your entire reply in ${name}, naturally rather than as a translation of English phrasing.

Keep in English, inside the ${name} text and without translating them: organisation and agency names (WEDC, WWBIC, Wisconsin SBDC, WHEDA, WI DFI, SCORE, SBA, WCCC), program and certification names, form numbers, legal entity types, and every web address. A member has to type those into a government site or a search box exactly as they are printed, and a translated one finds nothing. Naming the thing in English and explaining it in ${name} is right; translating the name is not.

If your reply is structured as JSON, translate the values and never the keys — and where the shape you were given fixes a value to a specific set of English words, keep that value exactly as it was given.

If you cannot write reliably in ${name}, answer in English and say plainly, in English, that you could not.`;
}

/**
 * The language directive for one member, for the surfaces that do not build a
 * whole context.
 *
 * `review-step`, `summarize-module` and `opportunities` read the member row and
 * nothing else, so without this they would answer in English to a member who
 * asked for Chinese — a half-shipped feature, which is worse than none, because
 * the member cannot tell a missing surface from a broken one.
 *
 * While BILINGUAL_ENABLED is off this answers "" without reading anything. The
 * read is cheap and costs no latency where it is used — it is folded into a
 * Promise.all the route already awaits — but it is a Supabase round trip on
 * every request to three routes to fetch facts that cannot be acted on, and
 * the alternative to this one line is the same check written into all three
 * callers. buildLanguageDirective would return "" anyway; this only stops the
 * query that feeds it.
 *
 * One small member_id-filtered read. Issue it inside whatever `Promise.all` the
 * route already has and it costs no latency at all; awaited on its own it costs
 * one round trip, which is still nothing beside the model call after it.
 */
export async function memberLanguageDirective(memberId: string): Promise<string> {
  if (!BILINGUAL_ENABLED) return "";
  return buildLanguageDirective(await getMemberFacts(memberId));
}

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
    // The language choice is stored as a fact but is not a claim about the
    // business, and this block is introduced to the model as things the member
    // said about their business. It is acted on by buildLanguageDirective
    // instead.
    if (fact.key === LANGUAGE_FACT_KEY) continue;
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
  priorityModuleKey: string | null,
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
        unlocked: isModuleUnlocked(member.membershipTier, mod, priorityModuleKey),
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

/**
 * How many earlier conversations the assistant is told about.
 *
 * One more than this is fetched, because from its second turn onward the chat
 * in progress is itself the newest row — and being told "earlier you asked
 * about X" about the message just sent reads as a malfunction. It is dropped by
 * id below rather than by a filter in the query, which keeps the read shape in
 * lib/appStore.ts untouched for the sake of one row.
 *
 * For the prompt cache this block behaves exactly like the artifact block
 * above. It is fixed for the length of a chat — the only row that changes
 * during one is that chat's own, which is excluded — and changes once when the
 * member starts a new conversation.
 *
 * Three is now a choice about the prompt rather than about the query. It was
 * both: listConversations used to read whole transcripts to derive an opening
 * line, so every extra row here was a whole stored chat crossing the wire to
 * compose one line of prompt. An `opening` column removed that cost, and this
 * stayed at three because that is as much history as is worth carrying in a
 * prompt re-sent on every turn — a member with twenty stored chats does not
 * want the assistant opening on the one from March.
 */
const MAX_CONTEXT_CONVERSATIONS = 3;

/** "2026-08-25" from an ISO timestamp — the time of day is noise here. */
function isoDate(value: string): string {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : "date unknown";
}

/** Collapses an opening line to a single line — a pasted paragraph would break the list. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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
 * What the member has brought to the coach before.
 *
 * Opening lines only, and the prompt is told that is all it has. The
 * transcripts are stored and this function could read them, but a coach that
 * quotes a past exchange back would be recalling rather than retrieving — the
 * one thing this codebase does not let an assistant do — and the bodies would
 * swamp a prompt that is re-sent on every turn. What is bought here is the
 * piece that was missing: an assistant that knows this member has been here
 * before, and what they came about.
 *
 * Returns null rather than an empty heading for a member with no history.
 */
function conversationLines(conversations: ConversationSummary[]): string | null {
  const lines = conversations
    .map((conversation) => ({ conversation, opening: oneLine(conversation.opening) }))
    // An opening can be empty if a stored transcript somehow has no member
    // turn. "They opened with: """ is worse than saying nothing.
    .filter(({ opening }) => opening.length > 0)
    .map(({ conversation, opening }) => {
      const where = conversation.moduleKey ? ` (${moduleLabel(conversation.moduleKey)})` : "";
      return `- ${isoDate(conversation.updatedAt)}${where} — they opened with: "${opening}"`;
    });

  if (lines.length === 0) return null;

  return `Earlier conversations they have had with you:\n${lines.join(
    "\n",
  )}\n\nThose are opening lines, not transcripts — you do not have what was said in them. You may pick up a thread they started ("last time you were looking at your DBE certification…"), but never claim to remember how the exchange went. If a detail from one matters, ask for it again.`;
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
  /**
   * `excludeConversationId` is the chat the caller is currently in, so it can
   * be kept out of the history block. It arrives from the client and is used
   * for nothing else — the list it filters is already scoped to this member, so
   * passing someone else's id removes nothing and reveals nothing.
   */
  options?: { excludeConversationId?: string | null },
): Promise<MemberContext | null> {
  // Eight reads rather than four. They are issued together and every one is a
  // small, member_id-filtered, column-limited query, so the added latency is
  // one query's worth at most — nothing next to the model call that follows.
  // None of them fetches a document, summary or transcript body; see
  // getMemberDocumentTitles in lib/appStore.ts for why that is a separate
  // function rather than a flag, and listConversations for the same choice made
  // one level down.
  const [
    member,
    assessment,
    completedByModule,
    facts,
    decisions,
    summaries,
    documents,
    recentConversations,
  ] = await Promise.all([
    getMemberById(memberId),
    getBusinessAssessment(memberId),
    getCompletedStepsByModule(memberId),
    getMemberFacts(memberId),
    getMemberDecisions(memberId, MAX_CONTEXT_DECISIONS),
    getModuleSummaryRefs(memberId, MAX_CONTEXT_SUMMARIES),
    getMemberDocumentTitles(memberId, MAX_CONTEXT_DOCUMENTS),
    listConversations(memberId, MAX_CONTEXT_CONVERSATIONS + 1),
  ]);

  if (!member) return null;

  const standings = standingsFor(member, assessment?.priorityModuleKey ?? null, completedByModule);
  const focus = focusModuleKey
    ? standings.find((s) => s.module.key === focusModuleKey)
    : undefined;

  const now = new Date();

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

    // The Snapshot's last question — which stage matters most to them right now.
    //
    // It used to unlock one roadmap module free and did nothing else, so when
    // tier gating was switched off (TIER_GATING_ENABLED in data/modules.ts) the
    // answer had no consumer left. It is a better signal than it ever was an
    // unlock: it is the member saying, in their own words, what they are
    // working on. Every surface that answers them should know it.
    //
    // Stable for the prompt cache — it changes only when the member retakes the
    // Snapshot, which is also when the rest of this summary changes.
    const priority = assessment.priorityModuleKey
      ? findModule(assessment.priorityModuleKey)?.module
      : undefined;
    if (priority) {
      parts.push(
        `Asked which part of their business matters most right now, they chose "${priority.label}" (${priority.tagline}). That is their own statement of what they are working on — lead with it where their question leaves room, but do not treat it as the only thing they care about, and do not assume they have made progress on it.`,
      );
    }
  } else {
    parts.push(
      "They haven't filled in the Business Snapshot yet, so you don't know their stage — ask rather than assume.",
    );
  }

  parts.push(factLines(facts, now));

  parts.push(roadmapLines(standings));

  const artifacts = artifactLines(decisions, summaries, documents);
  if (artifacts) parts.push(artifacts);

  const conversations = conversationLines(
    recentConversations
      .filter((conversation) => conversation.id !== options?.excludeConversationId)
      .slice(0, MAX_CONTEXT_CONVERSATIONS),
  );
  if (conversations) parts.push(conversations);

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

  // `now` is read once above for staleness and reused here, so a deadline
  // cannot be filtered against a different instant than the facts were.
  return {
    member,
    summary: parts.join("\n\n"),
    facts,
    languageDirective: buildLanguageDirective(facts),
    references: referenceSection(facts, now),
  };
}

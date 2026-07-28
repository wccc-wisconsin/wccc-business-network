// Decision Grill — a member-facing adaptation of the "grilling" technique
// (interview relentlessly, one question at a time, until every branch of the
// decision is resolved) applied to business decisions instead of code.
// A member states a decision they're weighing, the AI interrogates it one
// question at a time, then produces a written decision brief they keep.
//
// Everything in this file is shared by BOTH the client panel
// (components/DecisionGrillPanel.tsx) and the server route
// (app/api/ai/grill/route.ts) so the two can never disagree about the
// limits. The client enforces them for a good UX; the server re-enforces
// them because the client can't be trusted.

/** Answers required before the member can ask for their brief. */
export const MIN_ANSWERS_BEFORE_BRIEF = 3;

/**
 * Hard ceiling on questions in one session. Caps the cost of a single
 * session and stops a grilling from wandering — past roughly this many
 * questions the AI is repeating itself rather than finding new ground.
 */
export const MAX_GRILL_QUESTIONS = 8;

/**
 * Ceiling on the whole transcript: the opening topic, then a question and
 * an answer per round, then the final question the member never answers.
 * Derived rather than hardcoded so it can't drift from MAX_GRILL_QUESTIONS.
 */
export const MAX_TRANSCRIPT_MESSAGES = MAX_GRILL_QUESTIONS * 2 + 2;

/** Per-message character caps, applied on both ends. */
export const MAX_TOPIC_LENGTH = 400;
export const MAX_ANSWER_LENGTH = 2000;

/** How many past decision briefs to show on the dashboard. */
export const SAVED_DECISIONS_LIMIT = 5;

/**
 * One-tap starting points for members who know they're stuck but not how to
 * phrase it. Deliberately concrete and Wisconsin-small-business shaped —
 * a blank textarea is the main thing that stops this kind of tool being used.
 */
export const decisionStarters: string[] = [
  "Should I hire my first employee, or keep using contractors?",
  "Should I sign a lease on a storefront, or stay online-only?",
  "Should I take on a loan to buy equipment right now?",
  "Should I raise my prices, and by how much?",
  "Should I turn down a big client who wants terms I don't like?",
  "Should I bring on a business partner?",
];

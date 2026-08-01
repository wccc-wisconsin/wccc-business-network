import { businessModules } from "@/data/modules";
import { factDefinition } from "@/data/facts";

// The "Business Snapshot" — a short onboarding-style questionnaire that
// classifies where a member's business actually is (not just which
// membership tier they bought) and picks ONE roadmap module to unlock for
// free based on their stated immediate need. Surfaced as a dashboard card
// (components/BusinessAssessmentCard.tsx), re-takeable any time via
// saveBusinessAssessmentAction in app/actions.ts.
//
// Design: 6 questions score the business's maturity (0-100, mapped to a
// stage label below); a 7th question asks directly what the member's most
// urgent need is, and its options are keyed 1:1 to businessModules[].key —
// that's the free module. Deliberately not inferred from the maturity
// score: a member's stated priority is a more reliable signal of
// "immediate need" than a computed proxy, and keeping the two separate
// means a low score never accidentally locks someone out of picking, say,
// Capital as their priority.

export type AssessmentOption = {
  value: string;
  label: string;
  /** Points toward the maturity score. Absent on the priority question's options. */
  points?: number;
};

export type AssessmentQuestion = {
  key: string;
  label: string;
  helpText?: string;
  options: AssessmentOption[];
};

// Max points per scored question — every scored question below defines
// exactly 4 options worth 0-3 points, so this stays true by construction.
// computeAssessment uses it to scale the raw total to a 0-100 score.
const POINTS_PER_SCORED_QUESTION = 3;

export const scoredQuestions: AssessmentQuestion[] = [
  {
    key: "formation",
    label: "Where are you in getting officially set up?",
    options: [
      { value: "not-started", label: "Haven't registered yet", points: 0 },
      { value: "in-progress", label: "Registering now (WI DFI / EIN in progress)", points: 1 },
      { value: "registered", label: "Registered, not yet selling", points: 2 },
      { value: "operating", label: "Registered and actively selling", points: 3 },
    ],
  },
  {
    key: "time-in-business",
    label: "How long has your business been operating?",
    options: [
      { value: "idea", label: "Just an idea / pre-launch", points: 0 },
      { value: "under-1", label: "Less than 1 year", points: 1 },
      { value: "year-1-3", label: "1–3 years", points: 2 },
      { value: "year-3-plus", label: "3+ years", points: 3 },
    ],
  },
  {
    key: "revenue",
    label: "What's your typical monthly revenue?",
    options: [
      { value: "none", label: "$0 — pre-revenue", points: 0 },
      { value: "low", label: "Under $2,000", points: 1 },
      { value: "mid", label: "$2,000–$10,000", points: 2 },
      { value: "high", label: "Over $10,000", points: 3 },
    ],
  },
  {
    key: "team",
    label: "How big is your team?",
    options: [
      { value: "solo", label: "Just me", points: 0 },
      { value: "small", label: "2–5 people", points: 1 },
      { value: "medium", label: "6–20 people", points: 2 },
      { value: "large", label: "20+ people", points: 3 },
    ],
  },
  {
    key: "operations",
    label: "Do you have documented systems for how the business runs day to day (SOPs, financial tracking, etc.)?",
    options: [
      { value: "none", label: "Not yet", points: 0 },
      { value: "some", label: "A few basics", points: 1 },
      { value: "most", label: "Most areas covered", points: 2 },
      { value: "full", label: "Fully documented", points: 3 },
    ],
  },
  {
    key: "funding",
    label: "What's true about funding right now?",
    options: [
      { value: "none", label: "Self-funded, not looking", points: 0 },
      { value: "exploring", label: "Curious about options", points: 1 },
      { value: "seeking", label: "Actively seeking funding", points: 2 },
      { value: "secured", label: "Have outside funding already", points: 3 },
    ],
  },
];

// Options here are keyed 1:1 to businessModules[].key (see data/modules.ts)
// so the selected value can be used directly as the free-module key — no
// separate mapping table to keep in sync.
export const priorityQuestion: AssessmentQuestion = {
  key: "priority",
  label: "What's the single most urgent thing your business needs help with right now?",
  helpText: "We'll unlock that module for free, no matter your membership tier.",
  options: [
    { value: "launch", label: "Getting legally registered, insured, and able to accept payment" },
    { value: "revenue", label: "Getting customers and consistent sales" },
    { value: "growth", label: "Running day-to-day operations and scaling the team" },
    { value: "capital", label: "Finding funding or capital" },
    { value: "opportunity", label: "Winning contracts or certifications (MBE/DBE, SAM.gov)" },
    { value: "expansion", label: "Opening new locations or markets" },
    { value: "legacy", label: "Succession planning or preparing to exit" },
  ],
};

// Sanity check, enforced at module load: every priority option must name a
// real business module, or the free unlock would silently point at nothing.
if (process.env.NODE_ENV !== "production") {
  const moduleKeys = new Set(businessModules.map((m) => m.key));
  for (const opt of priorityQuestion.options) {
    if (!moduleKeys.has(opt.value)) {
      throw new Error(`priorityQuestion option "${opt.value}" has no matching business module`);
    }
  }
}

export const assessmentQuestions: AssessmentQuestion[] = [...scoredQuestions, priorityQuestion];

/**
 * The profile section of the Snapshot: fact keys (see data/facts.ts) asked
 * alongside the scored questions.
 *
 * These are NOT scored and NOT required. That distinction is the whole design.
 * The scored questions are a quiz whose output is a stage label — every one
 * has to be answered for the number to mean anything, which is why the form
 * rejects a partial submission. Profile facts are just things the portal
 * knows about the business; each one stands alone, so a member who fills in
 * three of seven is better served than one who abandons the form because it
 * got long.
 *
 * Chosen for immediate payoff rather than completeness. Each of these either
 * filters the deadline calendar (so the member sees their own dates instead of
 * everyone's) or gets carried into a guided step they haven't reached yet. The
 * rest of the catalog is filled in from the profile card and the modules
 * themselves, whenever the member happens to get to it.
 */
export const profileQuestions: string[] = [
  "entity_structure",
  "formation_date",
  "formation_state",
  "has_employees",
  "pays_estimated_tax",
  "seller_permit",
  "target_customer",
];

// Same guard as the priority question above: a profile key that names no real
// fact would render an empty field and silently save nothing.
if (process.env.NODE_ENV !== "production") {
  for (const key of profileQuestions) {
    if (!factDefinition(key)) {
      throw new Error(`profileQuestions lists "${key}", which is not a fact in data/facts.ts`);
    }
  }
}

export type BusinessStage = "Idea Stage" | "Early Stage" | "Growth Stage" | "Established";

export function stageForScore(score: number): BusinessStage {
  if (score < 25) return "Idea Stage";
  if (score < 50) return "Early Stage";
  if (score < 75) return "Growth Stage";
  return "Established";
}

export type AssessmentResult = {
  score: number;
  stage: BusinessStage;
  /** The module key to unlock for free, or null if the priority answer was missing/invalid. */
  freeModuleKey: string | null;
};

/**
 * Scores a set of raw form answers (question key -> selected option value).
 * Unknown/missing answers score 0 points rather than throwing, so a
 * half-filled or tampered submission degrades to a low score instead of a
 * 500 — validation of "were all required questions answered" belongs in
 * the caller (see saveBusinessAssessmentAction in app/actions.ts).
 */
export function computeAssessment(answers: Record<string, string>): AssessmentResult {
  let raw = 0;
  for (const q of scoredQuestions) {
    const selected = q.options.find((o) => o.value === answers[q.key]);
    raw += selected?.points ?? 0;
  }
  const maxRaw = scoredQuestions.length * POINTS_PER_SCORED_QUESTION;
  const score = Math.round((raw / maxRaw) * 100);

  const priorityAnswer = answers[priorityQuestion.key];
  const validPriority = priorityQuestion.options.some((o) => o.value === priorityAnswer);

  return {
    score,
    stage: stageForScore(score),
    freeModuleKey: validPriority ? priorityAnswer : null,
  };
}

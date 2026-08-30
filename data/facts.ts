/**
 * The member fact catalog — the portal's canonical answers about one business.
 *
 * Why this exists: the guided steps ask 147 questions across seven modules,
 * and a good number of them ask the same thing twice. A member who filled in
 * Launch and then unlocked Revenue was retyping their entity structure, their
 * bookkeeping setup, and their insurer. Facts are answered once, stored once,
 * and read everywhere — guided steps, the deadline calendar, the AI surfaces,
 * and the document generators.
 *
 * Three deliberate constraints, each of which prevents a specific failure:
 *
 * 1. Only `text` and `date` facts are ever prefilled into a guided step's
 *    textarea (see `factKey` in data/modules.ts). A `choice` fact holds an
 *    option value like "single-llc"; letting a free-text box write back to it
 *    would quietly corrupt the enum that the deadline filters depend on.
 *    Choice facts reach the modules as read-only context instead
 *    (`relatedFacts`), which is enforced below at module load.
 *
 * 2. Facts carry `staleAfterDays`. An insurer or a headcount goes out of date
 *    in a way a formation date never does, so anything time-sensitive gets
 *    re-confirmed rather than silently reused years later.
 *
 * 3. Every fact states its `purpose` on screen. A member being asked for a
 *    NAICS code deserves to know it drives bid matching — otherwise this is
 *    just a longer form, which is the thing we were trying to get away from.
 */

export type FactType = "text" | "date" | "choice";

export type FactOption = { value: string; label: string };

export type FactGroup =
  | "legal"
  | "money"
  | "market"
  | "capability"
  | "renewals"
  | "preferences";

export type FactDefinition = {
  key: string;
  /** Short label for the profile grid. */
  label: string;
  /** The full question, used when the profile asks for it directly. */
  question: string;
  type: FactType;
  /** Required for `choice` facts, absent otherwise. Enforced below. */
  options?: FactOption[];
  placeholder?: string;
  /** Shown next to the field: what the portal does with this answer. */
  purpose: string;
  /**
   * Days after which the member is asked to confirm rather than the value
   * being reused as current. Null means the fact doesn't go stale.
   */
  staleAfterDays: number | null;
  group: FactGroup;
  /** Facts the member can reasonably decline. Kept out of "missing" counts. */
  optional?: boolean;
};

export const factGroupLabels: Record<FactGroup, string> = {
  legal: "Legal & registration",
  money: "Money & records",
  market: "Customers & pricing",
  capability: "What you sell",
  renewals: "Dates that expire",
  preferences: "How the portal talks to you",
};

/** One year and two years, named so the intent is readable at the call site. */
const ONE_YEAR = 365;
const TWO_YEARS = 730;

/**
 * Whether members are offered a language other than English for AI answers.
 *
 * Off, deliberately, and not because anything about it is broken. The plumbing
 * is built and tested: the preference reaches all seven AI surfaces, agency
 * names and form numbers and URLs survive untranslated inside the translated
 * text, and JSON keys stay in English so the three parsing surfaces still
 * parse. What has never happened is a person who reads Chinese looking at real
 * output and saying it reads naturally — and this is a Chinese chamber of
 * commerce, so the members most able to notice awkward Chinese are exactly the
 * ones who would be reading it, about tax filings and legal deadlines. Wrong
 * is not recoverable the way empty is.
 *
 * A flag rather than a deletion, and the same shape as TIER_GATING_ENABLED and
 * PERSONAL_TRACK_ENABLED in data/modules.ts. Deleting it would have meant a
 * diff across seven routes, this catalog, data/assessment.ts and their tests,
 * to be written again from scratch the week someone does the review. Off, the
 * feature costs one branch in buildLanguageDirective and one filter on
 * profileQuestions; the tests for what the directive says are skipped rather
 * than deleted, so they re-arm untouched when this flips.
 *
 * **To turn it back on:** have someone who reads the language read real output
 * from the Coach, the Grill and a generated document — VERIFY-DEPLOY.md check
 * 6 — then set this to `true`. Nothing else needs changing. Values already
 * stored by members who chose a language before this went off are left alone
 * and simply go unread meanwhile, so flipping it restores their choice rather
 * than asking them again.
 */
export const BILINGUAL_ENABLED = false;

export const factDefinitions: FactDefinition[] = [
  {
    key: "entity_structure",
    label: "Entity structure",
    question: "What business structure are you operating under?",
    type: "choice",
    options: [
      { value: "undecided", label: "Haven't decided yet" },
      { value: "sole-prop", label: "Sole proprietorship" },
      { value: "single-llc", label: "Single-member LLC" },
      { value: "multi-llc", label: "Multi-member LLC" },
      { value: "s-corp", label: "S corporation" },
      { value: "c-corp", label: "C corporation" },
      { value: "nonprofit", label: "Nonprofit" },
    ],
    purpose: "Decides which filings apply to you and what a lender will ask for.",
    staleAfterDays: null,
    group: "legal",
  },
  {
    key: "formation_date",
    label: "Formation date",
    question: "When was the business formed or registered?",
    type: "date",
    purpose:
      "Wisconsin annual reports are due at the end of the quarter containing your formation anniversary. Without this we can only show you all four.",
    staleAfterDays: null,
    group: "legal",
  },
  {
    key: "formation_state",
    label: "Formed in",
    question: "Was the business formed in Wisconsin, or in another state?",
    type: "choice",
    options: [
      { value: "wi", label: "Wisconsin" },
      { value: "other", label: "Another state, registered in Wisconsin" },
    ],
    purpose:
      "Entities formed elsewhere file their Wisconsin annual report by 31 March regardless of formation date.",
    staleAfterDays: null,
    group: "legal",
  },
  {
    key: "has_employees",
    label: "Who works with you",
    question: "Who works in the business besides you?",
    type: "choice",
    options: [
      { value: "none", label: "Just me" },
      { value: "contractors", label: "1099 contractors only" },
      { value: "w2", label: "W-2 employees" },
      { value: "both", label: "Both employees and contractors" },
    ],
    purpose: "Payroll filings only show up for you if you actually run payroll.",
    staleAfterDays: ONE_YEAR,
    group: "legal",
  },
  {
    key: "pays_estimated_tax",
    label: "Estimated tax",
    question: "Do you pay yourself without tax withheld, and make quarterly estimated payments?",
    type: "choice",
    options: [
      { value: "yes", label: "Yes, I pay quarterly estimates" },
      { value: "no", label: "No, tax is withheld from my pay" },
      { value: "unsure", label: "Not sure" },
    ],
    purpose: "Controls whether federal estimated-tax dates appear on your deadline list.",
    staleAfterDays: ONE_YEAR,
    group: "money",
  },
  {
    key: "seller_permit",
    label: "Seller's permit",
    question: "Do you hold a Wisconsin seller's permit for sales tax?",
    type: "choice",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No, and I sell taxable goods" },
      { value: "not-applicable", label: "Nothing I sell is taxable" },
      { value: "unsure", label: "Not sure" },
    ],
    purpose: "Sales tax return dates only apply to permit holders.",
    staleAfterDays: TWO_YEARS,
    group: "legal",
  },
  {
    key: "industry_license",
    label: "Licences & permits",
    question: "Which industry licences or permits do you hold?",
    type: "text",
    placeholder: "Food service licence, contractor credential, cosmetology, liquor…",
    purpose: "So renewal reminders name the right document.",
    staleAfterDays: ONE_YEAR,
    group: "legal",
  },
  {
    key: "bank_account",
    label: "Business bank account",
    question: "Do you have a business bank account separate from your personal one?",
    type: "choice",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "Not yet" },
    ],
    purpose: "Lenders and certification bodies both treat this as a gate.",
    staleAfterDays: TWO_YEARS,
    group: "money",
  },
  {
    key: "bookkeeping_system",
    label: "Bookkeeping",
    question: "How do you track income and expenses?",
    type: "text",
    placeholder: "QuickBooks, a spreadsheet, a bookkeeper, not yet…",
    purpose: "Every funding conversation starts here, so we stop asking you twice.",
    staleAfterDays: ONE_YEAR,
    group: "money",
  },
  {
    key: "monthly_costs",
    label: "Monthly running cost",
    question: "Roughly what does it cost to keep the doors open for a month?",
    type: "text",
    placeholder: "$3,200 including rent, insurance, and software",
    purpose: "Used by the lender packet and the break-even maths in Expansion.",
    staleAfterDays: ONE_YEAR,
    group: "money",
  },
  {
    key: "target_customer",
    label: "Ideal customer",
    question: "Who is your ideal customer, as specifically as you can say it?",
    type: "text",
    placeholder: "Corporate lunch buyers, 20–60 people, Milwaukee County",
    purpose: "Sharpens every piece of AI output — vague answers are what make replies generic.",
    staleAfterDays: ONE_YEAR,
    group: "market",
  },
  {
    key: "pricing_basis",
    label: "How you price",
    question: "How did you set your current prices?",
    type: "text",
    placeholder: "Cost-based, competitor-based, or gut feeling",
    purpose: "Feeds the pricing sheet generator.",
    staleAfterDays: ONE_YEAR,
    group: "market",
  },
  {
    key: "core_capabilities",
    label: "Core capabilities",
    question: "In plain terms, what are the 3–4 things a buyer would hire you for?",
    type: "text",
    placeholder: "Drop-off catering, on-site service, dietary-restriction menus",
    purpose: "This is the heart of a capability statement, which is what public buyers ask for.",
    staleAfterDays: ONE_YEAR,
    group: "capability",
  },
  {
    key: "naics_codes",
    label: "NAICS codes",
    question: "Which NAICS codes describe your work?",
    type: "text",
    placeholder: "722320 — Caterers",
    purpose: "How public bids get matched to you. Nothing matches without it.",
    staleAfterDays: null,
    group: "capability",
  },
  {
    key: "ownership_basis",
    label: "Ownership basis",
    question: "Does your ownership qualify you for any certification programme?",
    type: "choice",
    options: [
      { value: "minority", label: "Minority-owned" },
      { value: "woman", label: "Woman-owned" },
      { value: "minority-woman", label: "Both minority- and woman-owned" },
      { value: "veteran", label: "Veteran-owned" },
      { value: "disability", label: "Disability-owned" },
      { value: "none", label: "None of these" },
      { value: "decline", label: "Prefer not to say" },
    ],
    purpose:
      "Self-declared, only used to point you at certifications you may qualify for. Never shown to other members.",
    staleAfterDays: null,
    group: "capability",
    optional: true,
  },
  {
    key: "certifications_held",
    label: "Certifications held",
    question: "Which certifications do you already hold, or have applied for?",
    type: "text",
    placeholder: "MBE (State of Wisconsin), applied for DBE in May",
    purpose: "Goes straight into your capability statement, and drives renewal reminders.",
    staleAfterDays: ONE_YEAR,
    group: "capability",
  },
  {
    key: "insurance_carrier",
    label: "Insurance carrier",
    question: "Who is your business insurance through?",
    type: "text",
    placeholder: "West Bend Mutual, or still shopping",
    purpose: "Contracts routinely require proof of coverage at short notice.",
    staleAfterDays: ONE_YEAR,
    group: "money",
  },
  {
    key: "insurance_limits",
    label: "Coverage limits",
    question: "What are your current coverage limits, and could you be bonded if asked?",
    type: "text",
    placeholder: "$1M general liability / $2M aggregate, not bonded",
    purpose: "Buyers screen on this before they read anything else you send.",
    staleAfterDays: ONE_YEAR,
    group: "capability",
  },
  {
    key: "advisor",
    label: "Advisor",
    question: "Who has looked at your numbers with you — accountant, SBDC, lender?",
    type: "text",
    placeholder: "Wisconsin SBDC at UW-Milwaukee, met once in March",
    purpose: "So the portal points you to a person, not just a page.",
    staleAfterDays: ONE_YEAR,
    group: "money",
    optional: true,
  },
  {
    key: "insurance_renewal_date",
    label: "Insurance renews",
    question: "When does your business insurance renew?",
    type: "date",
    purpose: "Reminds you 30 days out, while you can still shop it.",
    staleAfterDays: null,
    group: "renewals",
    optional: true,
  },
  {
    key: "license_renewal_date",
    label: "Licence renews",
    question: "When does your main industry licence or permit expire?",
    type: "date",
    purpose: "An expired licence can stop you trading overnight.",
    staleAfterDays: null,
    group: "renewals",
    optional: true,
  },
  {
    key: "certification_renewal_date",
    label: "Certification renews",
    question: "When does your MBE, WBE, DBE or 8(a) certification come up for renewal?",
    type: "date",
    purpose: "Recertification lapses are the most common way members lose bid eligibility.",
    staleAfterDays: null,
    group: "renewals",
    optional: true,
  },
  {
    key: "sam_registration_date",
    label: "SAM.gov renewed",
    question: "When did you last renew your SAM.gov registration?",
    type: "date",
    purpose:
      "SAM registration must be renewed every 12 months. It lapses quietly, and federal eligibility goes with it.",
    staleAfterDays: null,
    group: "renewals",
    optional: true,
  },
  {
    key: "lease_end_date",
    label: "Lease ends",
    question: "When does your lease end?",
    type: "date",
    purpose: "Renewal leverage disappears if you find out late.",
    staleAfterDays: null,
    group: "renewals",
    optional: true,
  },
  /**
   * The one fact here that is not about the business.
   *
   * It sits with the others because it travels the same road — stored on
   * `member_facts`, editable in the Business Snapshot, read into the AI prompts
   * from one place — and building a second mechanism for a single value would
   * be the worse trade. What it is *not* is a claim about the business, so
   * unlike every other fact it never reaches the "what they told us" block; it
   * is read by languageDirective in lib/memberContext.ts and nowhere else.
   *
   * Gated by BILINGUAL_ENABLED above: while that is off this question is not
   * asked and the stored value is not read. The definition stays either way,
   * because rows written before the flag went off still resolve through
   * factDefinition, and a fact with no definition renders as a raw key/value
   * pair rather than being skipped.
   *
   * `staleAfterDays: null` deliberately. Every other preference-shaped thing
   * here expires because the world moves on; the language someone reads in
   * does not, and being asked twice a year to confirm it would be its own kind
   * of rude.
   *
   * Values are BCP-47 tags so they can be handed to `lang=` or to Intl
   * untouched if anything ever needs to. Labels lead with the endonym, because
   * a member who reads Hmong should not have to find "Hmong" in an English list
   * first.
   *
   * Simplified and Traditional are offered separately rather than as one
   * "Chinese". For this membership specifically that is the distinction most
   * likely to matter, and a model told only "Chinese" will pick one for the
   * member — silently, and the same way every time.
   */
  {
    key: "preferred_language",
    label: "Preferred language",
    question: "Which language would you like the AI features to answer in?",
    type: "choice",
    options: [
      { value: "en", label: "English" },
      { value: "zh-Hans", label: "简体中文 — Chinese, Simplified" },
      { value: "zh-Hant", label: "繁體中文 — Chinese, Traditional" },
      { value: "es", label: "Español — Spanish" },
      { value: "hmn", label: "Hmoob — Hmong" },
    ],
    purpose:
      "The AI Coach, Decision Grill and generated documents answer in this language. Agency names, form numbers and web addresses stay in English, because that is what you will have to type into a government site.",
    staleAfterDays: null,
    group: "preferences",
    optional: true,
  },
];

const factsByKey = new Map(factDefinitions.map((f) => [f.key, f]));

export function factDefinition(key: string): FactDefinition | undefined {
  return factsByKey.get(key);
}

export function factsInGroup(group: FactGroup): FactDefinition[] {
  return factDefinitions.filter((f) => f.group === group);
}

/** Facts that count toward the profile's "filled" meter — optional ones don't. */
export const requiredFactKeys: string[] = factDefinitions
  .filter((f) => !f.optional)
  .map((f) => f.key);

/**
 * The human-readable form of a stored value. Choice facts store an option
 * value ("single-llc"); everything on screen and everything sent to the AI
 * should read the label ("Single-member LLC").
 */
export function displayFactValue(def: FactDefinition, value: string): string {
  if (def.type !== "choice") return value;
  return def.options?.find((o) => o.value === value)?.label ?? value;
}

/** Whether a stored value is one this fact can actually hold. */
export function isValidFactValue(def: FactDefinition, value: string): boolean {
  if (value.trim() === "") return false;
  if (def.type === "choice") return (def.options ?? []).some((o) => o.value === value);
  if (def.type === "date") return /^\d{4}-\d{2}-\d{2}$/.test(value);
  return true;
}

/**
 * Whether a fact has aged past the point where it should be treated as
 * current. `confirmedAt` is when the member last said it was right, which is
 * not the same as when the row was written.
 */
export function isFactStale(def: FactDefinition, confirmedAt: string, now: Date): boolean {
  if (def.staleAfterDays === null) return false;
  const confirmed = new Date(confirmedAt).getTime();
  if (Number.isNaN(confirmed)) return true;
  const ageDays = (now.getTime() - confirmed) / 86_400_000;
  return ageDays > def.staleAfterDays;
}

// Sanity checks, enforced at module load in development — the same guard
// pattern data/assessment.ts uses for the priority question. Each of these
// would otherwise fail silently and produce wrong data rather than an error.
if (process.env.NODE_ENV !== "production") {
  const seen = new Set<string>();
  for (const def of factDefinitions) {
    if (seen.has(def.key)) {
      throw new Error(`Duplicate fact key "${def.key}" in factDefinitions`);
    }
    seen.add(def.key);

    if (def.type === "choice") {
      if (!def.options || def.options.length === 0) {
        throw new Error(`Fact "${def.key}" is a choice but defines no options`);
      }
      const values = new Set(def.options.map((o) => o.value));
      if (values.size !== def.options.length) {
        throw new Error(`Fact "${def.key}" has duplicate option values`);
      }
    } else if (def.options) {
      throw new Error(`Fact "${def.key}" is type "${def.type}" but defines options`);
    }
  }
}

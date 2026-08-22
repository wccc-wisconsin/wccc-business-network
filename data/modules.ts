import { factDefinition } from "@/data/facts";

export type MembershipTierKey = "network" | "individual" | "business" | "corporate";

// "Essential" = can't operate without it. "Recommended" = important, but can
// be lean or come soon after — keeps a 6-step module from feeling like 6
// hard requirements.
export type StepLabel = "essential" | "recommended";

export type GuidedQuestion = {
  key: string;
  label: string;
  placeholder?: string;
  /**
   * This question IS a fact (see data/facts.ts). The member's stored answer
   * prefills the box, labelled with where it came from, and saving writes
   * back to the fact.
   *
   * Only `text` and `date` facts may be used here — a free-text box writing
   * back to a `choice` fact would corrupt the option value that the deadline
   * filters read. Enforced at module load below.
   */
  factKey?: string;
  /**
   * Facts that inform this question without answering it. Shown above the
   * box as read-only context, never prefilled into it.
   *
   * This is the difference between helpful and wrong. "Are your books current
   * enough to hand someone a P&L?" is not the same question as "how do you
   * track income and expenses?" — but knowing the member answered
   * "spreadsheet" three months ago means they aren't starting from nothing.
   */
  relatedFacts?: string[];
};

export type ModuleStep = {
  key: string;
  title: string;
  label: StepLabel;
  /** 2-4 specific labeled fields — not one blank box — saved per member. */
  questions: GuidedQuestion[];
};

export type ModulePhase = {
  key: string;
  title: string;
  steps: ModuleStep[];
};

/**
 * A document a member can generate for their own business from this module.
 *
 * The `resources` array below has always advertised things like "SOP template
 * generator" and "First-customer outreach generator", but rendered them as
 * plain text — a member could read the name of a tool and never use it. These
 * are the real thing: each one produces a document written from the member's
 * profile and the answers they've already saved in this module's guided steps,
 * so the output is about their business rather than a generic template.
 *
 * Since member facts joined the shared context (lib/memberContext.ts), a brief
 * can also lean on things the member entered in a different module — the
 * capability statement below reads NAICS codes, certifications and insurance
 * limits that may never have been typed in Opportunity at all.
 *
 * Every brief carries the same instruction in its own words: use what the
 * member gave you, and mark what's missing rather than filling it in. A
 * capability statement with an invented client list is not a lesser document,
 * it's a liability the member hands to a buyer.
 */
export type ModuleTool = {
  key: string;
  title: string;
  /** One line on the card — what the member walks away with. */
  description: string;
  /**
   * Appended to the system prompt. Says exactly what to produce and in what
   * shape. Keep these specific: a vague brief is what makes AI output read
   * like filler.
   */
  brief: string;
};

export type BusinessModule = {
  key: string;
  icon: string;
  label: string;
  tagline: string;
  /** Minimum tier required to unlock this module. */
  minTier: MembershipTierKey;
  resources: string[];
  /**
   * Document generators for this module. All seven business modules have them;
   * the personal track doesn't yet. Modules without `tools` simply don't
   * render the toolkit panel.
   */
  tools?: ModuleTool[];
  /**
   * The full guided-steps template (phases -> steps -> guided questions).
   * Optional because it's being filled in one module at a time, in lifecycle
   * order — Launch, Revenue, and Growth have it today; the remaining business
   * modules and the whole personal track get the same shape cloned in next.
   * Modules without `phases` fall back to the plain resource-list view
   * (see app/dashboard/roadmap/[module]/page.tsx). Every module uses the same
   * generic storage (module_key/step_key in module_step_progress), so filling
   * these in is a pure data change — no schema or query work needed.
   */
  phases?: ModulePhase[];
};

/** Flattens a module's phases into a single step list, in order. */
export function stepsForModule(mod: BusinessModule): ModuleStep[] {
  return (mod.phases ?? []).flatMap((phase) => phase.steps);
}

// Tiers in ascending order — used to check "does member's tier meet minTier".
export const tierOrder: MembershipTierKey[] = ["network", "individual", "business", "corporate"];

export function tierMeetsMinimum(memberTier: MembershipTierKey, minTier: MembershipTierKey) {
  return tierOrder.indexOf(memberTier) >= tierOrder.indexOf(minTier);
}

/**
 * Whether a member can access a given module: either their membership tier
 * covers it, or it's the one module their Business Snapshot assessment
 * unlocked for free (see data/assessment.ts, components/BusinessAssessmentCard.tsx).
 * `freeModuleKey` is the member's current free-unlock choice, or null/undefined
 * if they haven't taken the assessment (or it hasn't loaded).
 */
export function isModuleUnlocked(
  memberTier: MembershipTierKey,
  mod: BusinessModule,
  freeModuleKey?: string | null,
) {
  return tierMeetsMinimum(memberTier, mod.minTier) || mod.key === freeModuleKey;
}

// The 7 engines of the AI Business Builder, in lifecycle order:
// Launch (set up) -> Revenue (sell) -> Growth (scale) -> Capital (fund)
// -> Opportunity (win contracts) -> Expansion (multiply) -> Legacy (hand off)
//
// How `minTier` is meant to divide, and why:
//
//   network (free)  Launch — become a real, legal, payable business.
//   individual      Revenue — get found and get paid.
//   business        Everything else: Growth, Capital, Opportunity,
//                   Expansion, Legacy.
//   corporate       No extra modules.
//
// Roadmap content deliberately tops out at Business. Corporate is a
// sponsorship tier — the membership page sells it as staff seats, prominent
// directory listing and sponsorship opportunities, none of which are content.
// Gating three modules behind it made the code contradict the published
// pricing, and put MBE/DBE certification (Opportunity) behind the $1,500 door
// for exactly the members most likely to need it.
//
// The underlying mistake was gating by lifecycle stage, which assumes where a
// business is in its life predicts what it can pay. A ten-year-old contractor
// chasing their first public contract is further along than a startup and may
// have less cash. Stage and budget are independent, so tiers shouldn't track
// stage.
//
// This is a pricing decision as much as a code one — if WCCC wants the old
// split back it's one word per module, and the three affected ones are
// commented inline.
export const businessModules: BusinessModule[] = [
  {
    key: "launch",
    icon: "🚀",
    label: "Launch",
    tagline: "Become a real, legal, payable business",
    minTier: "network",
    resources: [
      "WI DFI business registration guide",
      "IRS EIN setup walkthrough",
      "Banking & insurance checklist",
      "Business Idea Summary tool",
    ],
    // Master template for the other 6 engines — see ModulePhase/ModuleStep
    // above. Owns 6 of the original 10 launch steps; the demand/selling
    // steps (7, 9, 10) live in Revenue and the CRM/ops step (8) lives in
    // Growth, since those are really selling and scaling work, not "become
    // a legal business" work.
    tools: [
      {
        key: "licence-action-list",
        title: "Licences & Permits Action List",
        description: "Exactly which registrations you still owe, in the order they have to happen.",
        brief: `Write an ordered action list of the registrations, licences and permits this business still needs, based on what they said they hold and what their industry and city require. Number the steps in the order they must actually happen — an EIN before a bank account, a seller's permit before taxable sales — and say in one line why each precedes the next where the order matters. For each item give the issuing body by name, and where the member already told you they hold it, mark it done rather than repeating it. Name only Wisconsin bodies you are certain of (WI DFI, IRS, Wisconsin Department of Revenue, the city or county clerk); where a specific licence depends on facts you weren't given, say what determines it and who to ask instead of guessing. Do not invent fees or processing times. Under 450 words.`,
      },
      {
        key: "contract-terms-sheet",
        title: "Your Standard Terms Sheet",
        description: "The terms you should be putting in front of customers, in plain language.",
        brief: `Draft a plain-language terms sheet this owner could attach to a quote or invoice, built from how they said they get paid and what they sell. Cover: what is included and excluded, payment timing and method, deposit, cancellation and rescheduling, and what happens if the customer changes the scope. Write it in short numbered clauses a customer will actually read, not legal boilerplate. Where their answers show a gap that has probably already cost them money — no deposit, no cancellation window — flag it in one sentence before the clause. End with a single line stating this is a starting point to have reviewed, not legal advice, and that a Wisconsin attorney should see it before it's used on anything substantial. Under 450 words.`,
      },
    ],
    phases: [
      {
        key: "prove-it",
        title: "Prove it",
        steps: [
          {
            key: "validate-idea",
            title: "Validate your business idea",
            label: "essential",
            questions: [
              { key: "problem", label: "What problem does your business solve, and for whom?", relatedFacts: ["target_customer"] },
              { key: "proof", label: "Who are 2-3 real people who've told you they'd pay for this?" },
              { key: "test", label: "What's the smallest version of this you could test in the next 30 days?" },
            ],
          },
        ],
      },
      {
        key: "make-it-official",
        title: "Make it official",
        steps: [
          {
            key: "name-brand",
            title: "Name & brand identity",
            label: "recommended",
            questions: [
              { key: "name-availability", label: "What's your business name, and is it available in Wisconsin (WI DFI name search)?" },
              { key: "reputation", label: "In one sentence, what feeling or reputation do you want your brand to have?" },
              { key: "visual-identity", label: "Do you have a logo or visual identity yet, or is that still to-do?" },
            ],
          },
          {
            key: "register-ein",
            title: "Register your business & EIN",
            label: "essential",
            questions: [
              { key: "structure", label: "What business structure are you using (LLC, sole prop, corporation)?", relatedFacts: ["entity_structure"] },
              { key: "dfi-status", label: "Have you registered with WI DFI yet? If not, what's blocking you?", relatedFacts: ["formation_date", "formation_state"] },
              { key: "ein-status", label: "Do you have your EIN from the IRS yet?" },
            ],
          },
          {
            // Registering the business is not the same as being allowed to
            // operate it. Industry licenses and a seller's permit are the
            // most common reason an otherwise-legitimate business gets fined
            // or shut down, and they're easy to miss because DFI/IRS
            // registration feels like the finish line.
            key: "licenses-permits",
            title: "Licenses, permits & sales tax",
            label: "essential",
            questions: [
              { key: "industry-license", label: "Does your industry need a specific license or permit to operate (food service, contractor, childcare, cosmetology, liquor, professional license)?" },
              { key: "license-status", label: "Which of those do you already hold, and which are still outstanding?", factKey: "industry_license" },
              { key: "seller-permit", label: "Do you sell anything taxable in Wisconsin, and do you have a seller's permit from the Department of Revenue?", relatedFacts: ["seller_permit"] },
              { key: "local-requirements", label: "Have you checked with your city or county about zoning, signage, or occupancy requirements at your location?" },
            ],
          },
          {
            key: "bank-insurance",
            title: "Bank account & insurance",
            label: "essential",
            questions: [
              { key: "bank-account", label: "Have you opened a dedicated business bank account?", relatedFacts: ["bank_account"] },
              { key: "insurance-type", label: "What type of insurance does your business need (general liability, professional, etc.)?" },
              { key: "insurance-provider", label: "Who's your insurance provider, or are you still shopping?", factKey: "insurance_carrier" },
            ],
          },
          {
            // Deliberately worded for every member, not a subset: "who reads
            // this before you sign it" is good practice for anyone, and is
            // quietly most valuable to a member doing business in a second
            // language. No assumption is made about who that is.
            key: "contract-review",
            title: "Before you sign anything",
            label: "recommended",
            questions: [
              { key: "agreements-signed", label: "What agreements are you currently bound by (lease, supplier terms, franchise, partnership, loan)?" },
              { key: "review-process", label: "Who reads a contract before you sign it — you, an attorney, a family member, nobody yet?" },
              { key: "unclear-terms", label: "Is there anything you've signed, or are being asked to sign, that you couldn't fully read or didn't fully understand?" },
              { key: "language-support", label: "Would having a document translated, or reviewed in another language, make this easier?" },
            ],
          },
        ],
      },
      {
        key: "get-ready-to-transact",
        title: "Get ready to transact",
        steps: [
          {
            key: "accounting-payments",
            title: "Accounting & accept payments",
            label: "essential",
            questions: [
              { key: "tracking", label: "How will you track income and expenses (software, spreadsheet, bookkeeper)?", factKey: "bookkeeping_system" },
              { key: "payment-methods", label: "How will customers pay you (card, invoice, cash, online)?" },
              { key: "tax-savings", label: "Do you have a system for setting aside money for taxes?" },
            ],
          },
          {
            key: "website-systems",
            title: "Website & core systems (email, domain)",
            label: "recommended",
            questions: [
              { key: "website-status", label: "Do you have a website or landing page yet?" },
              { key: "email-domain", label: "What's your business email domain (not a personal Gmail)?" },
              { key: "visitor-action", label: "What's the one thing you want a visitor to do on your site?" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "revenue",
    icon: "💰",
    label: "Revenue",
    tagline: "Get found and get paid",
    minTier: "individual",
    resources: [
      "Google Business Profile setup",
      "AI-drafted 90-day marketing plan",
      "First-customer outreach generator",
      "Sales & follow-up system",
    ],
    // The three resources above that describe generators are real here — each
    // one writes from the member's saved answers in this module rather than
    // producing a blank template.
    tools: [
      {
        key: "marketing-plan",
        title: "90-Day Marketing Plan",
        description: "A week-by-week plan built around the channels and customers you described.",
        brief: `Write a 90-day marketing plan for this business, organised as three 30-day phases with a short heading for each. Under each phase give 3-4 specific actions, each one a concrete thing the owner does — not a category. Use the channels, customer description and capacity the member actually described; if they named a channel, plan for that channel rather than suggesting a different one. Where their answers show they lack something needed (no website, no customer list), say so plainly and put the fix in phase one. End with 3 numbers they should track. Keep it under 500 words. No preamble, no encouragement.`,
      },
      {
        key: "outreach-email",
        title: "First-Customer Outreach",
        description: "Two ready-to-send emails aimed at the customers you're actually targeting.",
        brief: `Write two short outreach emails this owner could send today to win a customer, using the customer type and offer they described. Label them "Email 1 — cold introduction" and "Email 2 — follow-up if no reply". Each needs a subject line and a body under 120 words, in plain language a busy person reads on a phone. Reference what this business actually sells and who actually buys it. Do not use marketing clichés, do not invent testimonials, statistics, or credentials they did not give you. End with one line naming the single detail they should personalise before sending.`,
      },
      {
        key: "follow-up-system",
        title: "Sales Follow-Up System",
        description: "A simple cadence so quotes and enquiries stop falling through the cracks.",
        brief: `Design a lightweight follow-up system for this business, based on how they said they currently track sales and get paid. Give a numbered sequence of contact points after an initial enquiry or quote (timing plus what to say at each), sized to a working owner rather than a sales team. Then give a 3-line description of the simplest way to track it given the tools they already mentioned — if they said spreadsheet, build it around a spreadsheet, don't sell them software. Note plainly if their current setup would lose track of a lead. Under 400 words.`,
      },
    ],
    // Second full guided-steps template after Launch — same shape (3
    // phases, 6 steps), scoped to Revenue's actual job: get found, get the
    // next customer, get paid reliably. Owns the demand/selling steps that
    // were carved out of the original 10-step Launch draft (see the note
    // on Launch's `phases` above).
    phases: [
      {
        key: "get-found",
        title: "Get found",
        steps: [
          {
            key: "local-presence",
            title: "Google Business Profile & local presence",
            label: "essential",
            questions: [
              { key: "gbp-status", label: "Do you have a Google Business Profile set up and verified?" },
              { key: "search-experience", label: "If a new customer searched for what you do in your city right now, what would they find?" },
              { key: "reviews", label: "How many reviews do you have, and what's your average rating?" },
            ],
          },
          {
            key: "marketing-plan",
            title: "Marketing plan & channels",
            label: "recommended",
            questions: [
              { key: "channels", label: "Which channels are you actually using (social media, referrals, paid ads, events, none yet)?" },
              { key: "time-money", label: "Roughly how much time or money do you spend on marketing per month?" },
              { key: "best-channel", label: "Which channel has brought you the best customers so far, if any?" },
            ],
          },
        ],
      },
      {
        key: "get-the-next-customer",
        title: "Get the next customer",
        steps: [
          {
            key: "outreach-pipeline",
            title: "Outreach & pipeline",
            label: "essential",
            questions: [
              { key: "next-prospects", label: "Who are 5 real, specific people or businesses you could reach out to this week?", relatedFacts: ["target_customer"] },
              { key: "outreach-method", label: "How do you typically reach out (call, email, in-person, social DM)?" },
              { key: "blocker", label: "What's actually stopping you from reaching out today?" },
            ],
          },
          {
            key: "follow-up-referrals",
            title: "Follow-up & referrals",
            label: "recommended",
            questions: [
              { key: "follow-up-system", label: "How do you track who you've followed up with (CRM, spreadsheet, memory)?" },
              { key: "referral-ask", label: "Do you ever directly ask happy customers for a referral or review? What do you say?" },
              { key: "response-time", label: "How quickly do you typically respond to a new inquiry?" },
            ],
          },
        ],
      },
      {
        key: "get-paid-reliably",
        title: "Get paid, reliably",
        steps: [
          {
            // Deliberately placed BEFORE pricing-sales: a member can't set a
            // price honestly until they know what the thing costs them. The
            // rest of this module is demand-side; this is the one step that
            // looks at the cost side, and it's the whole ballgame for the
            // product, food, retail, and import businesses in the membership.
            key: "suppliers-costs",
            title: "Suppliers, inventory & what it costs you",
            label: "essential",
            questions: [
              { key: "cost-per-sale", label: "For your best-selling product or service, what does it actually cost you to deliver one?", relatedFacts: ["pricing_basis"] },
              { key: "supplier-terms", label: "Who are your main suppliers, and what terms are you on (pay up front, net 30, no set terms)?" },
              { key: "supplier-risk", label: "Is there any supplier or ingredient you'd struggle to replace if they raised prices or stopped delivering?" },
              { key: "inventory-waste", label: "If you carry inventory, how do you decide how much to hold — and how much goes to waste or sits unsold?" },
            ],
          },
          {
            key: "pricing-sales",
            title: "Pricing & sales process",
            label: "essential",
            questions: [
              { key: "pricing-basis", label: "How did you set your current prices (cost-based, competitor-based, gut feeling)?", factKey: "pricing_basis" },
              { key: "close-rate", label: "Out of 10 people who show real interest, roughly how many become paying customers?" },
              { key: "objection", label: "What's the most common reason someone says no?" },
            ],
          },
          {
            key: "retention",
            title: "Repeat business & retention",
            label: "recommended",
            questions: [
              { key: "repeat-share", label: "Roughly what share of your revenue comes from repeat or returning customers?" },
              { key: "stay-in-touch", label: "Do you have any system for staying in touch with past customers?" },
              { key: "comeback-reason", label: "What would realistically make a past customer come back?" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "growth",
    icon: "📊",
    label: "Growth",
    tagline: "Run it and scale it",
    minTier: "business",
    resources: [
      "SOP template generator",
      "KPI dashboard & monthly review",
      "First-hire & delegation guide",
      "Cash flow & profitability worksheet",
    ],
    // Third full guided-steps template, same shape as Launch and Revenue (3
    // phases, 6 steps, 3 questions each). Scoped to Growth's actual job: stop
    // being the bottleneck. Owns the CRM/ops step carved out of the original
    // 10-step Launch draft (see the note on Launch's `phases` above) — by this
    // stage the question isn't "do you have tools" but "do the tools run
    // without you". Questions deliberately ask for real numbers where a number
    // exists; "I don't know" is itself a useful answer for the AI coach.
    tools: [
      {
        key: "core-sop",
        title: "SOP for Your Core Process",
        description: "The job you described, written down so someone else could run it.",
        brief: `Turn the core process this member described into a written standard operating procedure. Structure it as numbered steps from the moment a customer says yes to the moment the job is closed out, each step naming who does it and what "done" looks like. Use their actual wording for the work — their tools, their sequence — rather than a generic service workflow. Where they said a step lives only in their head or depends on them personally, mark it clearly as a handover risk and write the step in enough detail that someone else could follow it. Finish with a short list of the decisions that still need the owner, and why. Under 600 words.`,
      },
      {
        key: "classification-memo",
        title: "Employee vs Contractor Memo",
        description: "Where your current setup stands, and what to check before it becomes a problem.",
        brief: `Write a short internal memo on how this business currently classifies the people who work with it, based on what they described. Lay out the practical difference between a W-2 employee and a 1099 contractor in terms of control, tools, and who sets the hours. Then, for each arrangement they described, say which way it appears to lean and which specific facts would settle it. Name the Wisconsin obligations that follow from having employees — withholding registration, unemployment insurance, worker's compensation — without stating dollar thresholds or rates you aren't certain of. Be explicit that misclassification is decided by the agencies on the facts, not by what the parties agreed, and that this memo is a prompt to get an accountant's view rather than a determination. Under 500 words.`,
      },
      {
        key: "monthly-numbers",
        title: "Your Monthly Numbers Review",
        description: "The three numbers you named, turned into a review you can actually hold.",
        brief: `Design a monthly numbers review for this owner around the metrics they said they'd want to see. For each metric: where the figure comes from given the tools they already use, what a healthy direction looks like for a business like theirs, and the one decision it should inform. If they named a metric they currently can't pull, say plainly what would have to change to make it available, and give an interim proxy they can get today. Then give a 30-minute agenda for the review itself, sized for one person. Do not invent benchmark figures for their industry — if a healthy range depends on data you don't have, say what to compare against instead. Under 450 words.`,
      },
    ],
    phases: [
      {
        key: "systemize-the-work",
        title: "Systemize the work",
        steps: [
          {
            key: "document-process",
            title: "Document how the work gets done",
            label: "essential",
            questions: [
              { key: "core-process", label: "Walk through what happens from the moment someone says yes to the moment the job is done." },
              { key: "written-down", label: "Which parts of that are written down somewhere other than your head?" },
              { key: "bus-test", label: "If you were out sick for two weeks, what would break first?" },
            ],
          },
          {
            key: "tools-systems",
            title: "Tools & systems that run without you",
            label: "recommended",
            questions: [
              { key: "current-tools", label: "What tools do you use to run day-to-day operations (CRM, scheduling, invoicing, project tracking)?" },
              { key: "manual-work", label: "What do you still do by hand every week that a tool could probably handle?" },
              { key: "single-source", label: "If a customer called right now, could anyone but you find their full history in under a minute?" },
            ],
          },
        ],
      },
      {
        key: "know-your-numbers",
        title: "Know your numbers",
        steps: [
          {
            key: "track-kpis",
            title: "Track the numbers that matter",
            label: "essential",
            questions: [
              { key: "key-metrics", label: "What are the 3 numbers you'd want to see every month to know the business is healthy?" },
              { key: "current-visibility", label: "Which of those can you actually pull up today, and where do they live?" },
              { key: "review-rhythm", label: "How often do you sit down and look at your numbers — honestly?" },
            ],
          },
          {
            key: "cash-flow",
            title: "Cash flow & profitability",
            label: "recommended",
            questions: [
              { key: "monthly-costs", label: "Roughly what does it cost to keep the doors open for one month?", factKey: "monthly_costs" },
              { key: "profit-by-service", label: "Which of your products or services actually makes the most profit, not just the most revenue?" },
              { key: "cash-cushion", label: "How many months could the business cover its costs if revenue stopped tomorrow?" },
            ],
          },
          {
            // cash-flow above covers "what if the money stops". This covers
            // the other three ways a healthy-looking small business falls
            // over: the owner is unavailable, one customer was secretly the
            // whole business, or the records disappear. Legacy handles the
            // PLANNED handoff; nothing else in the roadmap handles the
            // unplanned one.
            key: "continuity-risk",
            title: "What happens if something goes wrong",
            label: "recommended",
            questions: [
              { key: "owner-absence", label: "If you couldn't work for the next 30 days, what would happen to the business?" },
              { key: "customer-concentration", label: "Roughly what share of your revenue comes from your single largest customer?" },
              { key: "single-points", label: "What else would seriously disrupt you if you lost it — your lease, a key employee, a piece of equipment, one supplier?" },
              { key: "records-backup", label: "Where do your records, customer list, and passwords live, and could someone else get to them in an emergency?" },
            ],
          },
        ],
      },
      {
        key: "build-the-team",
        title: "Build the team",
        steps: [
          {
            key: "first-hire",
            title: "Your first hire (or contractor)",
            label: "essential",
            questions: [
              { key: "biggest-drain", label: "What task eats the most of your time but doesn't actually need you specifically?" },
              { key: "role-shape", label: "Would that be an employee, a contractor, or a service — and roughly what would it cost per month?" },
              { key: "hire-blocker", label: "What's holding you back from filling that role (money, trust, not knowing where to look)?" },
            ],
          },
          {
            // first-hire above is about the DECISION to hire. This is the
            // paperwork that decision triggers — the part that quietly
            // generates penalties. Worker misclassification and missing
            // workers' comp are among the most expensive mistakes a growing
            // small business makes, and neither is obvious until it's a
            // problem. Questions ask what's in place, not what the law
            // requires — the member confirms specifics with a payroll
            // provider or accountant.
            key: "hiring-compliance",
            title: "Payroll, classification & the paperwork",
            label: "essential",
            questions: [
              { key: "worker-classification", label: "For each person who works with you, are they set up as a W-2 employee or a 1099 contractor — and are you confident that's the right classification?", relatedFacts: ["has_employees"] },
              { key: "payroll-setup", label: "How do you run payroll and withholding (payroll service, accountant, by hand, not yet)?", relatedFacts: ["has_employees"] },
              { key: "state-registrations", label: "Are you registered with Wisconsin for withholding and unemployment insurance, and do you carry workers' compensation coverage?", relatedFacts: ["has_employees"] },
              { key: "onboarding-records", label: "Do you keep signed offer letters, I-9s, and W-4s on file for everyone?" },
            ],
          },
          {
            key: "delegate-lead",
            title: "Delegate & lead",
            label: "recommended",
            questions: [
              { key: "handoff", label: "Think of the last thing you handed off. What made it work, or what went wrong?" },
              { key: "decision-rights", label: "What decisions can someone else make without checking with you first?" },
              { key: "owner-role", label: "A year from now, what should you personally be spending your time on?" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "capital",
    icon: "🏦",
    label: "Capital",
    tagline: "Get funded",
    minTier: "business",
    resources: [
      "Financial projections tool",
      "Wisconsin grant-finder",
      "AI pitch-deck builder",
    ],
    // Ordered so the member arrives at the ask having already answered the
    // two questions every lender and grant reviewer opens with: how much,
    // and what does your business actually look like on paper. Members who
    // skip to "make the ask" are the ones who get declined.
    tools: [
      {
        key: "lender-packet",
        title: "Lender Packet Checklist",
        description: "Everything a lender will ask for, marked against what you already have.",
        brief: `Produce the document checklist this member needs to assemble before approaching a lender or grant programme, based on the funding type they said they're pursuing and what they told you they already have ready. Group into "you have this", "you have this but it needs work", and "you don't have this yet", using their own answers to place each item — do not put something in "you have this" unless they said so. For each missing item, say who produces it (them, their accountant, their bank) and roughly what it involves. Where they named a specific route — SBA, a community lender such as WWBIC, a bank, a grant — note any documents particular to it, and say plainly when a requirement depends on the individual lender rather than being universal. Under 500 words.`,
      },
      {
        key: "funding-request",
        title: "One-Page Funding Request",
        description: "Your ask, written the way a lender reads it.",
        brief: `Write a one-page funding request for this business using the amount, use of funds, and repayment capacity they described. Structure: the ask in one sentence with the figure; what the money buys, itemised; what it changes about the business; how it gets repaid, referencing what they said the business could absorb monthly; and why this owner specifically. Use only figures the member gave you — if a number needed to make the case is missing, leave a clearly marked blank like [monthly revenue] rather than estimating it. Write it in the register of a person who runs the business, not a consultant. End with the two questions a lender is most likely to ask given the gaps in what they've told you. Under 450 words.`,
      },
    ],
    phases: [
      {
        key: "know-what-you-need",
        title: "Know what you need",
        steps: [
          {
            key: "funding-need",
            title: "How much, and what for",
            label: "essential",
            questions: [
              { key: "amount", label: "How much money do you need, and how did you arrive at that number?" },
              { key: "use-of-funds", label: "What specifically would it buy — equipment, inventory, payroll, a build-out, breathing room?" },
              { key: "cost-of-waiting", label: "What happens to the business if you don't get it, or don't get it this year?" },
            ],
          },
          {
            key: "financial-position",
            title: "Where you stand today",
            label: "essential",
            questions: [
              { key: "revenue-trend", label: "What did the business bring in over the last 12 months, and is that trending up or down?", relatedFacts: ["monthly_costs"] },
              { key: "books-current", label: "Are your books current enough that you could hand someone a P&L this week?", relatedFacts: ["bookkeeping_system"] },
              { key: "credit-and-debt", label: "What debt is the business already carrying, and roughly where does your credit stand?" },
            ],
          },
        ],
      },
      {
        key: "find-the-right-money",
        title: "Find the right money",
        steps: [
          {
            key: "funding-options",
            title: "Grant, loan, investor, or your own cash",
            label: "essential",
            questions: [
              { key: "options-considered", label: "Which of these have you looked into — grant, bank or SBA loan, community lender (e.g. WWBIC), investor, or funding it yourself?" },
              { key: "ownership-tradeoff", label: "Are you willing to give up any ownership of the business, or is that off the table?" },
              { key: "repayment-comfort", label: "What monthly payment could the business genuinely absorb without straining?" },
            ],
          },
          {
            key: "lender-readiness",
            title: "What they'll ask you for",
            label: "recommended",
            questions: [
              { key: "documents-ready", label: "Which of these do you have ready: business plan, financial projections, last 2 years of tax returns, bank statements?", relatedFacts: ["bookkeeping_system"] },
              { key: "biggest-gap", label: "Of those, which one would take you the longest to produce?" },
              { key: "advisor", label: "Has anyone — an accountant, an SBDC advisor, a lender — looked at your numbers with you yet?", factKey: "advisor" },
            ],
          },
        ],
      },
      {
        key: "make-the-ask",
        title: "Make the ask",
        steps: [
          {
            key: "pitch-package",
            title: "Your pitch or loan package",
            label: "recommended",
            questions: [
              { key: "one-sentence-ask", label: "In one sentence: what are you asking for, and what will it do for the business?" },
              { key: "why-you", label: "Why should someone bet on you specifically — track record, traction, expertise, community demand?" },
              { key: "package-status", label: "Do you have a deck or written loan package yet, or is that still to build?" },
            ],
          },
          {
            key: "use-and-repayment",
            title: "How you'll use it and pay it back",
            label: "essential",
            questions: [
              { key: "deployment-plan", label: "Walk through where the money goes in the first 90 days after it lands." },
              { key: "return-timeline", label: "When would you expect this spending to start generating extra revenue?" },
              { key: "reporting-obligations", label: "If it's a grant or a loan, what reporting or conditions come attached, and can you meet them?" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "opportunity",
    icon: "🤝",
    label: "Opportunity",
    tagline: "Win contracts",
    // Was "corporate" ($1,500/yr). MBE/DBE certification and procurement
    // registration are close to the core of what a chamber rooted in
    // Asian-American heritage exists to help with, and the businesses that
    // need them are rarely the ones who can afford the top tier — gating
    // stage by price assumes lifecycle position predicts budget, which it
    // doesn't. See the note above businessModules on how tiers are meant to
    // divide.
    minTier: "business",
    resources: [
      "MBE / DBE certification help",
      "SAM.gov procurement registration",
      "Capability-statement drafter",
    ],
    // Contract work has a hard gate in front of it: certifications and
    // registrations take weeks to months and you cannot bid without them.
    // That's why they come first here, before anything about finding or
    // writing bids — a member who starts at "go win one" wastes the season.
    tools: [
      {
        key: "capability-statement",
        title: "Capability Statement",
        description: "The one-page document every public buyer asks for, built from your profile.",
        brief: `Write a capability statement for this business in the standard sections public and corporate buyers expect: Core Competencies, Differentiators, Past Performance, and Company Data. Use the member's own capabilities, NAICS codes, certifications, insurance limits and past work — this document's whole value is that it is specific. Core Competencies should be scannable phrases, not paragraphs. Differentiators must say why them over an incumbent, drawn from what they told you rather than adjectives. Under Company Data list the identifiers a buyer needs (legal name, location, NAICS, certifications, UEI or SAM status, insurance) and put a clearly marked placeholder such as [UEI — add from SAM.gov] wherever they haven't given you the value. Invent nothing: no clients they didn't name, no certifications they don't hold, no coverage limits they didn't state. Note in one closing line that a buyer-facing version should fit on a single page.`,
      },
      {
        key: "bid-go-no-go",
        title: "Bid Go / No-Go Scorecard",
        description: "A rule for deciding which bids are worth your time — before you start writing.",
        brief: `Build a go/no-go scorecard this owner can apply to a solicitation in fifteen minutes, using the capacity, cash position and certifications they described. Give 8-10 criteria as questions with a clear pass/fail or scored answer — capacity against the contract size, payment terms against their float, certification and insurance requirements against what they hold, whether they know the buyer, whether the incumbent is beatable. Weight the ones that should be automatic disqualifiers and say so. Then give the decision rule: what score means bid, what means partner or subcontract instead, what means walk away. Reference their own stated limits — the largest job they said they could take, the float they said they could cover — rather than generic thresholds. Under 450 words.`,
      },
    ],
    phases: [
      {
        key: "get-certified",
        title: "Get certified & registered",
        steps: [
          {
            key: "certifications",
            title: "Certifications you may qualify for",
            label: "essential",
            questions: [
              { key: "eligibility", label: "Which certifications might your ownership qualify for — MBE, WBE, DBE, veteran-owned, SBA 8(a), HUBZone?", relatedFacts: ["ownership_basis", "entity_structure"] },
              { key: "cert-status", label: "Which have you applied for or already hold, and when do they come up for renewal?", factKey: "certifications_held" },
              { key: "cert-blocker", label: "If you haven't applied, what's stopping you — paperwork, not knowing where to start, unsure it's worth it?" },
            ],
          },
          {
            key: "registrations",
            title: "Where buyers actually look for you",
            label: "essential",
            questions: [
              { key: "sam-status", label: "Are you registered in SAM.gov with an active UEI (required for any federal work)?", relatedFacts: ["sam_registration_date"] },
              { key: "state-local", label: "Are you registered with Wisconsin VendorNet, and with your city or county's supplier portal?" },
              { key: "prime-portals", label: "Are you in the supplier database of any large company or prime contractor you'd want to work with?" },
            ],
          },
        ],
      },
      {
        key: "prove-youre-ready",
        title: "Prove you're ready",
        steps: [
          {
            key: "capability-statement",
            title: "Your capability statement",
            label: "essential",
            questions: [
              { key: "core-competencies", label: "In plain terms, what are the 3-4 things you do that a buyer would hire you for?", factKey: "core_capabilities" },
              { key: "naics-codes", label: "Which NAICS codes describe your work?", factKey: "naics_codes" },
              { key: "past-performance", label: "What past jobs would you point to as proof you can deliver — and can you name the client?" },
              { key: "differentiator", label: "Why you over the incumbent who already has this contract?" },
            ],
          },
          {
            key: "contract-readiness",
            title: "Can you actually carry the job",
            label: "recommended",
            questions: [
              { key: "insurance-bonding", label: "What are your current insurance limits, and can you get bonded if a contract requires it?", factKey: "insurance_limits" },
              { key: "capacity", label: "What's the largest job you could take on right now without dropping existing customers?", relatedFacts: ["monthly_costs"] },
              { key: "payment-float", label: "Public and corporate buyers often pay in 30-60 days. Could you cover payroll and materials that long before getting paid?" },
            ],
          },
        ],
      },
      {
        key: "go-win-one",
        title: "Go win one",
        steps: [
          {
            key: "target-buyers",
            title: "Who actually buys what you sell",
            label: "essential",
            questions: [
              { key: "buyer-list", label: "Name 3 specific agencies, school districts, hospitals, or prime contractors that buy your kind of work." },
              { key: "relationships", label: "Do you know anyone inside those organizations, or have you met their procurement staff?" },
              { key: "subcontracting", label: "Would starting as a subcontractor to a prime be a faster way in than bidding directly?" },
            ],
          },
          {
            key: "bid-pipeline",
            title: "Finding and answering solicitations",
            label: "recommended",
            questions: [
              { key: "where-you-look", label: "Where do you currently look for open solicitations, and how often?" },
              { key: "who-writes", label: "Who writes the response — you, a staff member, a proposal writer you'd hire?" },
              { key: "go-no-go", label: "What's your rule for deciding a bid isn't worth the time?" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "expansion",
    icon: "🏢",
    label: "Expansion",
    tagline: "Multiply",
    // Was "corporate" — see the Opportunity note above and the tier rationale
    // over businessModules. Roadmap content now tops out at Business.
    minTier: "business",
    resources: [
      "Multi-location readiness assessment",
      "New-market research tool",
    ],
    // The first phase is deliberately a gate, not a warm-up: expansion
    // multiplies whatever the business already is, including its problems.
    // A member whose current operation only works because they're personally
    // in it will get two struggling operations, not two good ones.
    tools: [
      {
        key: "expansion-brief",
        title: "Expansion Feasibility Brief",
        description: "The case for and against the move you're considering, on one page.",
        brief: `Write a feasibility brief for the specific expansion this member is weighing. Sections: what they're proposing, in their own terms; what has to be true for it to work, as a list of testable conditions rather than hopes; what the evidence they gave actually supports and where it runs out; the money — start-up cost, months to break even, and where the funding comes from, using only figures they provided; and what they'd give up by doing it, including their own time. Close with the three cheapest tests they could run in the next 60 days to reduce the biggest unknown before committing capital. Be direct where their own answers undercut the case — an expansion built on a base they described as unprofitable or undocumented should hear that plainly. Under 550 words.`,
      },
    ],
    phases: [
      {
        key: "confirm-the-core",
        title: "Confirm the core is ready",
        steps: [
          {
            key: "repeatable-model",
            title: "Is what you have repeatable",
            label: "essential",
            questions: [
              { key: "unit-economics", label: "Does your current location or product line make a reliable profit, month after month?", relatedFacts: ["monthly_costs"] },
              { key: "documented", label: "Could someone else run it from your written process, or does it live in your head?" },
              { key: "what-makes-it-work", label: "What's the real reason it works — location, your reputation, price, a relationship? Would that travel?" },
            ],
          },
          {
            key: "bench-strength",
            title: "Who runs today's business",
            label: "essential",
            questions: [
              { key: "day-to-day-owner", label: "If you spent the next six months on a new location, who runs the existing one?" },
              { key: "ready-or-training", label: "Is that person ready today, or would they need training first?" },
              { key: "your-time", label: "Realistically, how many hours a week could you put into an expansion without the current business slipping?" },
            ],
          },
        ],
      },
      {
        key: "choose-the-direction",
        title: "Choose the direction",
        steps: [
          {
            key: "expansion-type",
            title: "Which kind of growth",
            label: "essential",
            questions: [
              { key: "direction", label: "Which are you actually considering — a second location, a new city or region, a new product line, selling online, or licensing/franchising?" },
              { key: "why-this-one", label: "Why that one rather than the others?" },
              { key: "reversible", label: "If it doesn't work, how easily could you unwind it — and what would it cost you to walk away?" },
            ],
          },
          {
            key: "market-evidence",
            title: "Evidence the demand is there",
            label: "essential",
            questions: [
              { key: "demand-signal", label: "What actual evidence says people in the new market want this — inquiries, waitlist, competitor success, research?" },
              { key: "competition", label: "Who's already serving that market, and what would make customers switch to you?" },
              { key: "differences", label: "What's different there — costs, regulations, customer expectations, language, competition?" },
            ],
          },
        ],
      },
      {
        key: "de-risk-the-move",
        title: "De-risk the move",
        steps: [
          {
            key: "capital-and-runway",
            title: "What it costs to get there",
            label: "recommended",
            questions: [
              { key: "startup-cost", label: "What's the all-in cost to open or launch, including the months before it earns anything?", relatedFacts: ["monthly_costs"] },
              { key: "breakeven", label: "How many months until it covers its own costs, and what has to be true for that?" },
              { key: "funding-source", label: "Where does that money come from — profits, savings, a loan, an investor?" },
            ],
          },
          {
            key: "rollout-plan",
            title: "Milestones and the stop signal",
            label: "recommended",
            questions: [
              { key: "milestones", label: "What are the 3-4 checkpoints between now and open, with rough dates?" },
              { key: "first-90-days", label: "What does success look like in the first 90 days after launch, as a number?" },
              { key: "stop-rule", label: "What result would tell you to stop or pull back — and would you actually act on it?" },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "legacy",
    icon: "👑",
    label: "Legacy",
    tagline: "Hand it off",
    // Was "corporate" — see the Opportunity note above. Succession planning is
    // for owners winding down, who are often the least likely to be paying the
    // top tier.
    minTier: "business",
    resources: [
      "Succession plan outline",
      "Exit-options guide",
      "WCCC mentorship matching",
    ],
    // This module touches tax, estate, and legal territory. Every question
    // here asks what the member has IN PLACE or has DECIDED — never what the
    // law or the tax code requires. Where a professional is needed, the
    // question asks whether one has been engaged. Same line the AI prompts
    // in app/api/ai/ hold.
    tools: [
      {
        key: "succession-outline",
        title: "Succession Outline",
        description: "What has to be true before you can hand this over, in sequence.",
        brief: `Write a succession outline for this business from what the member described about their timeline, their preferred path and their successor. Cover: where the business is dependent on them personally and what would have to be transferred or documented for each; the state of the records and what a buyer or successor would need to see; the relationships that sit with them rather than the business, and how those move; and a rough sequence with timeframes working back from the timeline they named. Where they've said family is involved but conversations haven't happened, put that first — it determines everything after it. Name the advisers this needs (attorney, accountant, valuation professional) and what each one is for. Be clear that valuation, tax treatment and the structure of any transfer are decisions for those professionals, not this document. Under 550 words.`,
      },
    ],
    phases: [
      {
        key: "decide-what-happens-next",
        title: "Decide what happens next",
        steps: [
          {
            key: "exit-intent",
            title: "What you actually want",
            label: "essential",
            questions: [
              { key: "timeline", label: "When would you like to step back — within 2 years, 5 years, 10, or you're not sure yet?" },
              { key: "what-you-want-left", label: "What do you want to be true about the business after you're no longer running it?" },
              { key: "personal-need", label: "What do you need to get out of it personally — a sale price, ongoing income, a job for family, or just a clean stop?" },
            ],
          },
          {
            key: "exit-options",
            title: "The realistic paths",
            label: "essential",
            questions: [
              { key: "paths-considered", label: "Which have you considered — passing it to family, selling to an employee or partner, selling to an outside buyer, merging, or winding it down?" },
              { key: "family-conversation", label: "If family is part of the plan, have you actually talked with them about whether they want it?" },
              { key: "leading-option", label: "Which path are you leaning toward today, and what makes you unsure?" },
            ],
          },
        ],
      },
      {
        key: "make-it-transferable",
        title: "Make it transferable",
        steps: [
          {
            key: "owner-dependence",
            title: "How much of this is you",
            label: "essential",
            questions: [
              { key: "only-you", label: "What do you do that nobody else in the business can currently do?" },
              { key: "relationships", label: "Which customer or supplier relationships are with you personally rather than with the business?" },
              { key: "if-you-left", label: "If you stopped tomorrow, what breaks first — and how long before customers notice?" },
            ],
          },
          {
            key: "books-and-value",
            title: "What a buyer or successor would inspect",
            label: "essential",
            questions: [
              { key: "clean-financials", label: "Are the last 3 years of financials clean and separate from your personal finances?", relatedFacts: ["bookkeeping_system"] },
              { key: "valuation", label: "Has the business ever been formally valued, or do you have a number in your head?" },
              { key: "contracts-and-ip", label: "Are your lease, key contracts, licenses, and brand or recipes documented and transferable to someone else?", relatedFacts: ["lease_end_date", "certifications_held"] },
            ],
          },
        ],
      },
      {
        key: "hand-it-over",
        title: "Hand it over",
        steps: [
          {
            key: "successor-plan",
            title: "Who takes it, and how",
            label: "recommended",
            questions: [
              { key: "successor", label: "Is there a specific person in mind, and do they know?" },
              { key: "training-gap", label: "What would they need to learn, and how long would that take?" },
              { key: "handover-shape", label: "Would you hand over all at once, or step back gradually while they take more on?" },
            ],
          },
          {
            key: "professional-and-personal",
            title: "Your team and your own plan",
            label: "recommended",
            questions: [
              { key: "advisors-engaged", label: "Have you talked with an attorney, an accountant, or a financial adviser about this yet?" },
              { key: "documents-in-place", label: "Is anything written down — a succession plan, a buy-sell agreement, a will or trust covering the business?" },
              { key: "life-after", label: "What does your income and your time look like the year after you hand it off?" },
            ],
          },
        ],
      },
    ],
  },
];

// The 4 stages of the "Know Yourself" personal-growth track. Trimmed down
// from an earlier 7-stage draft to keep every item traceable to WCCC's own
// professional/community programming — general wellness content, senior
// empowerment, and mentor-matching (live or otherwise) were cut as outside
// the chamber's scope. Unlike businessModules, every stage here is minTier
// "network" — the personal track is intentionally unrestricted for all members.
export const personalModules: BusinessModule[] = [
  {
    key: "foundation",
    icon: "🧭",
    label: "Foundation",
    tagline: "Get grounded and set your direction",
    minTier: "network",
    resources: [
      "Self-assessment & goals worksheet",
      "WCCC community directory access",
      "Personal Growth Summary tool",
    ],
  },
  {
    key: "professional-growth",
    icon: "💼",
    label: "Professional Growth",
    tagline: "Sharpen your financial and career footing",
    minTier: "network",
    resources: [
      "Financial wellness workshop",
      "Resume & LinkedIn review",
      "Career pathing session",
    ],
  },
  {
    key: "leadership-visibility",
    icon: "🧠",
    label: "Leadership & Visibility",
    tagline: "Lead, communicate, and get seen",
    minTier: "network",
    resources: [
      "Leadership skills workshop series",
      "360 feedback & coaching guide",
      "Public speaking & visibility opportunities",
    ],
  },
  {
    key: "community-legacy",
    icon: "🤝",
    label: "Community & Legacy",
    tagline: "Deepen community ties and pay it forward",
    minTier: "network",
    resources: [
      "Affinity group access",
      "Cultural heritage programming",
      "Peer mastermind groups",
      "Community leadership pathways",
    ],
  },
];

// Shared track metadata — the single source of truth for each track's
// display copy (eyebrow/heading) and module list. Both the dashboard
// (app/dashboard/page.tsx) and the per-module detail page
// (app/dashboard/roadmap/[module]/page.tsx) read from this instead of each
// hard-coding their own copy of "AI Business Builder" / "Your growth
// roadmap", so the two can't drift apart.
export type RoadmapTrackKey = "business" | "personal";

export type RoadmapTrackMeta = {
  key: RoadmapTrackKey;
  eyebrow: string;
  heading: string;
  modules: BusinessModule[];
};

/**
 * Whether the "Know Yourself" personal track is offered to members.
 *
 * Off, deliberately. The four personal modules have no `phases`, so they have
 * no guided steps, no AI review and no document tools — a member who picked
 * that track landed on a dashboard reading "Not started" beside a note saying
 * the steps were still being built, which is not a thing to hand someone on
 * their first visit. Their `resources` also name specific offerings
 * (financial wellness workshop, resume review, 360 feedback, peer masterminds)
 * that nobody has confirmed WCCC actually runs.
 *
 * Everything for the track is still here and intact. Flip this to `true` once
 * the modules have real, verified content and guided steps — nothing else
 * needs to change, because both the dashboard and the module detail page read
 * their track list through the helpers below rather than reaching for
 * `roadmapTracks` directly.
 */
export const PERSONAL_TRACK_ENABLED = false;

/** Every track that exists, enabled or not. Prefer `availableTracks()`. */
export const roadmapTracks: RoadmapTrackMeta[] = [
  {
    key: "business",
    eyebrow: "AI Business Builder",
    heading: "Your growth roadmap",
    modules: businessModules,
  },
  {
    key: "personal",
    eyebrow: "Personal Growth Path",
    heading: "Your Know Yourself roadmap",
    modules: personalModules,
  },
];

/** The tracks members can currently be shown. */
export function availableTracks(): RoadmapTrackMeta[] {
  return PERSONAL_TRACK_ENABLED
    ? roadmapTracks
    : roadmapTracks.filter((track) => track.key !== "personal");
}

/**
 * The track(s) to show a member, given the journey they picked at onboarding.
 *
 * Existing members matter here: accounts created before the personal track was
 * switched off still carry `journey` values of "personal" or "both". Filtering
 * on journey alone would leave those members with an empty roadmap and a
 * dashboard that says nothing at all. Falling back to whatever is available
 * means they see the business roadmap instead — which is the one that's
 * actually finished — and they'll get their own track back, without any data
 * migration, the moment the flag flips.
 */
export function tracksForJourney(journey: RoadmapTrackKey | "both"): RoadmapTrackMeta[] {
  const available = availableTracks();
  const matching = available.filter(
    (track) => track.key === journey || journey === "both",
  );
  return matching.length > 0 ? matching : available;
}

/**
 * Looks up a single module by its `key` (used as the URL slug for
 * app/dashboard/roadmap/[module]/page.tsx) across every track, plus the
 * track it belongs to and its position for prev/next navigation.
 */
/**
 * Looks up one generator by module and tool key. Returns null for an unknown
 * pair so the API route can reject a request rather than trusting a tool key
 * sent by the client — the brief becomes part of a system prompt, so it has to
 * come from this file and never from the request body.
 */
export function findTool(moduleKey: string, toolKey: string) {
  const found = findModule(moduleKey);
  if (!found) return null;
  const tool = found.module.tools?.find((t) => t.key === toolKey);
  if (!tool) return null;
  return { module: found.module, tool };
}

export function findModule(moduleKey: string) {
  // Searches available tracks only, so a module belonging to a switched-off
  // track (see PERSONAL_TRACK_ENABLED) resolves to null and its detail page
  // 404s. Without this, /dashboard/roadmap/foundation would still render a
  // stage that the roadmap no longer offers, reachable by anyone who had
  // bookmarked it.
  for (const track of availableTracks()) {
    const index = track.modules.findIndex((m) => m.key === moduleKey);
    if (index !== -1) {
      return {
        track,
        module: track.modules[index],
        prev: track.modules[index - 1] ?? null,
        next: track.modules[index + 1] ?? null,
      };
    }
  }
  return null;
}

/** Looks up one guided step within a module by its `stepKey`. Used by the
 * AI Business Builder's API routes to validate a request and pull the
 * step's title into the AI prompt. */
export function findStep(moduleKey: string, stepKey: string) {
  const found = findModule(moduleKey);
  if (!found) return null;
  const step = stepsForModule(found.module).find((s) => s.key === stepKey);
  if (!step) return null;
  return { module: found.module, step };
}

/** Every guided question in every track, with where it lives. */
export function allGuidedQuestions() {
  return roadmapTracks.flatMap((track) =>
    track.modules.flatMap((mod) =>
      stepsForModule(mod).flatMap((step) =>
        step.questions.map((question) => ({ module: mod, step, question })),
      ),
    ),
  );
}

/**
 * The provenance line a member sees above a carried-over answer, e.g.
 * "Launch › Register your business & EIN". Built here so the module page and
 * the profile agree on the wording.
 */
export function stepProvenanceLabel(mod: BusinessModule, step: ModuleStep): string {
  return `${mod.label} › ${step.title}`;
}

// Fact wiring checks, enforced at module load in development — same guard
// pattern as data/assessment.ts and data/facts.ts.
//
// These catch the two ways the carry-over feature can silently do damage: a
// question pointing at a fact that no longer exists (so the prefill quietly
// never happens), and a free-text box bound to a `choice` fact (so saving
// writes prose into a field the deadline filters compare against option
// values). The second one would look fine on screen and break the calendar.
if (process.env.NODE_ENV !== "production") {
  for (const { module: mod, step, question } of allGuidedQuestions()) {
    const where = `${mod.key}/${step.key}/${question.key}`;

    if (question.factKey) {
      const def = factDefinition(question.factKey);
      if (!def) {
        throw new Error(`Guided question ${where} has factKey "${question.factKey}" with no such fact`);
      }
      if (def.type === "choice") {
        throw new Error(
          `Guided question ${where} binds to choice fact "${def.key}". Choice facts are read-only in modules — use relatedFacts instead.`,
        );
      }
    }

    for (const related of question.relatedFacts ?? []) {
      if (!factDefinition(related)) {
        throw new Error(`Guided question ${where} lists relatedFact "${related}" with no such fact`);
      }
      if (related === question.factKey) {
        throw new Error(`Guided question ${where} lists its own factKey in relatedFacts`);
      }
    }
  }

  // A fact written by two different questions would flip-flop depending on
  // which module the member touched last, with no way to tell which answer
  // was meant. Facts may be READ anywhere, but written from exactly one place.
  const writers = new Map<string, string>();
  for (const { module: mod, step, question } of allGuidedQuestions()) {
    if (!question.factKey) continue;
    const existing = writers.get(question.factKey);
    const where = `${mod.key}/${step.key}/${question.key}`;
    if (existing) {
      throw new Error(
        `Fact "${question.factKey}" is written by two questions (${existing} and ${where}). Only one may own it.`,
      );
    }
    writers.set(question.factKey, where);
  }
}

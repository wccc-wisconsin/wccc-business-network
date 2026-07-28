export type MembershipTierKey = "network" | "individual" | "business" | "corporate";

// "Essential" = can't operate without it. "Recommended" = important, but can
// be lean or come soon after — keeps a 6-step module from feeling like 6
// hard requirements.
export type StepLabel = "essential" | "recommended";

export type GuidedQuestion = {
  key: string;
  label: string;
  placeholder?: string;
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

export type BusinessModule = {
  key: string;
  icon: string;
  label: string;
  tagline: string;
  /** Minimum tier required to unlock this module. */
  minTier: MembershipTierKey;
  resources: string[];
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
              { key: "problem", label: "What problem does your business solve, and for whom?" },
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
              { key: "structure", label: "What business structure are you using (LLC, sole prop, corporation)?" },
              { key: "dfi-status", label: "Have you registered with WI DFI yet? If not, what's blocking you?" },
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
              { key: "license-status", label: "Which of those do you already hold, and which are still outstanding?" },
              { key: "seller-permit", label: "Do you sell anything taxable in Wisconsin, and do you have a seller's permit from the Department of Revenue?" },
              { key: "local-requirements", label: "Have you checked with your city or county about zoning, signage, or occupancy requirements at your location?" },
            ],
          },
          {
            key: "bank-insurance",
            title: "Bank account & insurance",
            label: "essential",
            questions: [
              { key: "bank-account", label: "Have you opened a dedicated business bank account?" },
              { key: "insurance-type", label: "What type of insurance does your business need (general liability, professional, etc.)?" },
              { key: "insurance-provider", label: "Who's your insurance provider, or are you still shopping?" },
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
              { key: "tracking", label: "How will you track income and expenses (software, spreadsheet, bookkeeper)?" },
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
              { key: "next-prospects", label: "Who are 5 real, specific people or businesses you could reach out to this week?" },
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
              { key: "cost-per-sale", label: "For your best-selling product or service, what does it actually cost you to deliver one?" },
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
              { key: "pricing-basis", label: "How did you set your current prices (cost-based, competitor-based, gut feeling)?" },
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
              { key: "monthly-costs", label: "Roughly what does it cost to keep the doors open for one month?" },
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
              { key: "worker-classification", label: "For each person who works with you, are they set up as a W-2 employee or a 1099 contractor — and are you confident that's the right classification?" },
              { key: "payroll-setup", label: "How do you run payroll and withholding (payroll service, accountant, by hand, not yet)?" },
              { key: "state-registrations", label: "Are you registered with Wisconsin for withholding and unemployment insurance, and do you carry workers' compensation coverage?" },
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
              { key: "revenue-trend", label: "What did the business bring in over the last 12 months, and is that trending up or down?" },
              { key: "books-current", label: "Are your books current enough that you could hand someone a P&L this week?" },
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
              { key: "documents-ready", label: "Which of these do you have ready: business plan, financial projections, last 2 years of tax returns, bank statements?" },
              { key: "biggest-gap", label: "Of those, which one would take you the longest to produce?" },
              { key: "advisor", label: "Has anyone — an accountant, an SBDC advisor, a lender — looked at your numbers with you yet?" },
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
    minTier: "corporate",
    resources: [
      "MBE / DBE certification help",
      "SAM.gov procurement registration",
      "Capability-statement drafter",
    ],
    // Contract work has a hard gate in front of it: certifications and
    // registrations take weeks to months and you cannot bid without them.
    // That's why they come first here, before anything about finding or
    // writing bids — a member who starts at "go win one" wastes the season.
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
              { key: "eligibility", label: "Which certifications might your ownership qualify for — MBE, WBE, DBE, veteran-owned, SBA 8(a), HUBZone?" },
              { key: "cert-status", label: "Which have you applied for or already hold, and when do they come up for renewal?" },
              { key: "cert-blocker", label: "If you haven't applied, what's stopping you — paperwork, not knowing where to start, unsure it's worth it?" },
            ],
          },
          {
            key: "registrations",
            title: "Where buyers actually look for you",
            label: "essential",
            questions: [
              { key: "sam-status", label: "Are you registered in SAM.gov with an active UEI (required for any federal work)?" },
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
              { key: "core-competencies", label: "In plain terms, what are the 3-4 things you do that a buyer would hire you for?" },
              { key: "naics-codes", label: "Which NAICS codes describe your work?" },
              { key: "past-performance", label: "What past jobs would you point to as proof you can deliver — and can you name the client?" },
              { key: "differentiator", label: "Why you over the incumbent who already has this contract?" },
            ],
          },
          {
            key: "contract-readiness",
            title: "Can you actually carry the job",
            label: "recommended",
            questions: [
              { key: "insurance-bonding", label: "What are your current insurance limits, and can you get bonded if a contract requires it?" },
              { key: "capacity", label: "What's the largest job you could take on right now without dropping existing customers?" },
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
    minTier: "corporate",
    resources: [
      "Multi-location readiness assessment",
      "New-market research tool",
    ],
    // The first phase is deliberately a gate, not a warm-up: expansion
    // multiplies whatever the business already is, including its problems.
    // A member whose current operation only works because they're personally
    // in it will get two struggling operations, not two good ones.
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
              { key: "unit-economics", label: "Does your current location or product line make a reliable profit, month after month?" },
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
              { key: "startup-cost", label: "What's the all-in cost to open or launch, including the months before it earns anything?" },
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
    minTier: "corporate",
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
              { key: "clean-financials", label: "Are the last 3 years of financials clean and separate from your personal finances?" },
              { key: "valuation", label: "Has the business ever been formally valued, or do you have a number in your head?" },
              { key: "contracts-and-ip", label: "Are your lease, key contracts, licenses, and brand or recipes documented and transferable to someone else?" },
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

/**
 * Looks up a single module by its `key` (used as the URL slug for
 * app/dashboard/roadmap/[module]/page.tsx) across every track, plus the
 * track it belongs to and its position for prev/next navigation.
 */
export function findModule(moduleKey: string) {
  for (const track of roadmapTracks) {
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

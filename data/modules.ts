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
   * Optional because only Launch has this fleshed out so far — it's the
   * master template (see app/dashboard/roadmap/[module]/page.tsx); the
   * other 6 modules get their phases/steps cloned in next, same shell.
   * Modules without `phases` fall back to the plain resource-list view.
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
            key: "bank-insurance",
            title: "Bank account & insurance",
            label: "essential",
            questions: [
              { key: "bank-account", label: "Have you opened a dedicated business bank account?" },
              { key: "insurance-type", label: "What type of insurance does your business need (general liability, professional, etc.)?" },
              { key: "insurance-provider", label: "Who's your insurance provider, or are you still shopping?" },
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

export type MembershipTierKey = "network" | "individual" | "business" | "corporate";

export type BusinessModule = {
  key: string;
  icon: string;
  label: string;
  tagline: string;
  /** Minimum tier required to unlock this module. */
  minTier: MembershipTierKey;
  resources: string[];
};

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

// The 7 stages of the "Know Yourself" personal-growth track, mirroring the
// same lifecycle shape and tier gating as businessModules above, so both
// journeys unlock at the same pace as a member upgrades.
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
    key: "wellness",
    icon: "💪",
    label: "Wellness",
    tagline: "Build health and financial confidence",
    minTier: "individual",
    resources: [
      "Mental health resource guide",
      "Financial wellness workshop",
      "Wellness partner discounts",
    ],
  },
  {
    key: "leadership",
    icon: "🧠",
    label: "Leadership",
    tagline: "Sharpen how you lead and communicate",
    minTier: "business",
    resources: [
      "Leadership skills workshop series",
      "360 feedback & coaching guide",
    ],
  },
  {
    key: "career",
    icon: "📈",
    label: "Career",
    tagline: "Advance your career momentum",
    minTier: "business",
    resources: [
      "Resume & LinkedIn review",
      "Career pathing session",
      "Mentor matching (career track)",
    ],
  },
  {
    key: "belonging",
    icon: "🤝",
    label: "Belonging",
    tagline: "Deepen community connection",
    minTier: "corporate",
    resources: [
      "Affinity group access",
      "Cultural heritage programming",
      "Peer mastermind groups",
    ],
  },
  {
    key: "empowerment",
    icon: "🌟",
    label: "Empowerment",
    tagline: "Senior and lifelong empowerment",
    minTier: "corporate",
    resources: [
      "Senior empowerment programming",
      "Public speaking & visibility opportunities",
    ],
  },
  {
    key: "legacy-personal",
    icon: "👑",
    label: "Legacy",
    tagline: "Pass it forward",
    minTier: "corporate",
    resources: [
      "Mentor-the-next-generation matching",
      "Community leadership pathways",
    ],
  },
];

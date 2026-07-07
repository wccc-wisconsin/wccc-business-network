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

// The 4 stages of the "Know Yourself" personal-growth track. Trimmed down
// from an earlier 7-stage draft to keep every item traceable to WCCC's own
// professional/community programming — general wellness content, senior
// empowerment, and mentor-matching (live or otherwise) were cut as outside
// the chamber's scope. Tier gating still mirrors businessModules above.
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
    minTier: "individual",
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
    minTier: "business",
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
    minTier: "corporate",
    resources: [
      "Affinity group access",
      "Cultural heritage programming",
      "Peer mastermind groups",
      "Community leadership pathways",
    ],
  },
];

export type JourneyCard = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  items: string[];
  cta: string;
  accent: "teal" | "plum";
};

export type ProgramItem = {
  title: string;
  subtitle: string;
  description: string;
  track: string;
};

export type RecommendationItem = {
  label: string;
  title: string;
  subtitle: string;
};

export const journeyCards: JourneyCard[] = [
  {
    eyebrow: "Personal Growth Journey",
    title: "Know Yourself",
    subtitle: "Build capacity from the inside out",
    description:
      "Support for wellness, financial confidence, leadership, and career momentum across every season of work.",
    items: [
      "Health and wellness",
      "Financial wellness",
      "Leadership",
      "Career development",
      "Senior empowerment",
      "Community connection",
    ],
    cta: "Start Your Journey",
    accent: "teal",
  },
  {
    eyebrow: "Entrepreneur Journey",
    title: "Know Your Business",
    subtitle: "Move from idea to durable growth",
    description:
      "Practical programs for starting, funding, scaling, and modernizing a business with trusted local partners.",
    items: [
      "Start a business",
      "Access capital",
      "AI and technology",
      "Marketing",
      "Scale and grow",
      "Government contracts",
    ],
    cta: "Build Your Business",
    accent: "plum",
  },
];

export const programs: ProgramItem[] = [
  {
    title: "Ignite Academy",
    subtitle: "Start and grow",
    description: "Foundational support for new and emerging entrepreneurs.",
    track: "Launch",
  },
  {
    title: "Business Accelerator",
    subtitle: "Scale and expand",
    description: "Cohort-based planning for owners ready for the next stage.",
    track: "Scale",
  },
  {
    title: "AI Business Builder",
    subtitle: "Learn and implement",
    description: "Hands-on guidance for putting practical AI tools to work.",
    track: "Modernize",
  },
  {
    title: "Access to Capital",
    subtitle: "Fund and grow",
    description: "Connections to lenders, grants, and capital readiness help.",
    track: "Finance",
  },
  {
    title: "Office Hours",
    subtitle: "Get expert help",
    description: "Short advising sessions with business and banking partners.",
    track: "Advising",
  },
  {
    title: "Contract Ready",
    subtitle: "Win and grow",
    description: "Preparation for public-sector and corporate opportunities.",
    track: "Opportunity",
  },
];

export const recommendations: RecommendationItem[] = [
  {
    label: "Event",
    title: "Government Contracting 101",
    subtitle: "Workshop - July 16, 2026 - Milwaukee, WI",
  },
  {
    label: "Program",
    title: "Business Accelerator Program",
    subtitle: "Next cohort starts August 20, 2026",
  },
  {
    label: "Advising",
    title: "Office Hours with Bank Partner",
    subtitle: "July 23, 2026 - 2:00 PM - Virtual",
  },
];

export const partners = [
  "Old National Bank",
  "U.S. Bank",
  "WEDC",
  "SBA",
  "United Way",
  "Aurora Health Care",
];

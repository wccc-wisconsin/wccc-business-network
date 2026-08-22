// Journey pathways and partner list for the public homepage.
//
// This file used to also hold a `programs` array (Ignite Academy, Business
// Accelerator, AI Business Builder, Access to Capital, Office Hours, Contract
// Ready) and a `recommendations` array. Both were placeholder content that
// didn't describe anything WCCC actually runs, so they've been removed rather
// than left on the site telling members about programs they can't enrol in.
// A `data/events.ts` file went the same way — real WCCC events are published
// on the Wisconsin Asian Hub, which the site now links to instead (see
// data/hub.ts).
export type JourneyCard = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  items: string[];
  cta: string;
  accent: "teal" | "plum";
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
    subtitle: "Launch, grow, and scale your enterprise",
    description:
      "Practical programs for startups, growing businesses, and established enterprises — from first idea to lasting impact.",
    items: [
      "Startup support",
      "Start a business",
      "Access capital",
      "AI and technology",
      "Scale and grow",
      "Government contracts",
    ],
    cta: "Build Your Business",
    accent: "plum",
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

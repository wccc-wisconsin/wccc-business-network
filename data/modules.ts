export type BusinessModule = {
  key: string;
  icon: string;
  label: string;
  tagline: string;
  status: "available" | "soon";
};

// The 7 engines of the AI Business Builder, in lifecycle order:
// Launch (set up) -> Revenue (sell) -> Growth (scale) -> Capital (fund)
// -> Opportunity (win contracts) -> Expansion (multiply) -> Legacy (hand off)
export const businessModules: BusinessModule[] = [
  {
    key: "launch",
    icon: "🚀",
    label: "Launch",
    tagline: "Become a real, legal, payable business",
    status: "available",
  },
  {
    key: "revenue",
    icon: "💰",
    label: "Revenue",
    tagline: "Get found and get paid",
    status: "soon",
  },
  {
    key: "growth",
    icon: "📊",
    label: "Growth",
    tagline: "Run it and scale it",
    status: "soon",
  },
  {
    key: "capital",
    icon: "🏦",
    label: "Capital",
    tagline: "Get funded",
    status: "soon",
  },
  {
    key: "opportunity",
    icon: "🤝",
    label: "Opportunity",
    tagline: "Win contracts",
    status: "soon",
  },
  {
    key: "expansion",
    icon: "🏢",
    label: "Expansion",
    tagline: "Multiply",
    status: "soon",
  },
  {
    key: "legacy",
    icon: "👑",
    label: "Legacy",
    tagline: "Hand it off",
    status: "soon",
  },
];

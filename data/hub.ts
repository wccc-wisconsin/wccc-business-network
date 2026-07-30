export type HubLink = {
  icon: string;
  label: string;
  description: string;
  href: string;
};

// Wisconsin Asian Hub (hub.wcccbusinessnetwork.org) is a separate site under
// the same organization — its own business directory, events calendar,
// bid/RFP board, and video spotlights. This portal has no API access to pull
// that data in live, so both surfaces link straight out to it rather than
// duplicating (and risking drifting from) content WCCC already maintains there.
//
// Shared between the signed-in dashboard (components/CommunityHubLinks.tsx)
// and the public homepage (components/HubHighlights.tsx). It lives here rather
// than in either component so a changed URL updates both at once — the
// homepage version exists precisely because "Community directory" is sold as
// the free tier's headline perk on the membership page, and until now the only
// links to it were behind the login.
export const hubLinks: HubLink[] = [
  {
    icon: "🏢",
    label: "Business Directory",
    description: "Find and support Asian-owned businesses across Wisconsin.",
    href: "https://hub.wcccbusinessnetwork.org/members",
  },
  {
    icon: "📅",
    label: "Community Events",
    description: "WCCC, WEDC & Wisconsin Asian community events calendar.",
    href: "https://hub.wcccbusinessnetwork.org/events",
  },
  {
    icon: "📌",
    label: "Opportunities & RFPs",
    description: "Live Milwaukee County bids and contract opportunities.",
    href: "https://hub.wcccbusinessnetwork.org/opportunities",
  },
  {
    icon: "🎬",
    label: "Member Spotlights",
    description: "Video stories from WCCC business owners across the state.",
    href: "https://hub.wcccbusinessnetwork.org/",
  },
];

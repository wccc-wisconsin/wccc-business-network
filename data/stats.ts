export type StatItem = {
  value: string;
  label: string;
  detail: string;
};

/**
 * WCCC's headline impact figures.
 *
 * These are copied from the organisation's public site, WCCC Connect
 * (wccc-platform, intended for wisccc.org), which is the outward-facing site
 * shown to partners and funders. They are NOT independently verified here —
 * this file exists so both sites quote the same numbers, not because these are
 * confirmed.
 *
 * They previously read 240+ businesses, 60+ partners and 1,500+ participants,
 * which contradicted WCCC Connect's 260+, 30+ and 5,000+. Two live WCCC sites
 * publishing different figures about the same organisation is worse than
 * either figure being slightly stale, so they're aligned to the site that
 * partners actually see. A "40+ Programs" stat was also dropped: the programs
 * it counted were placeholder content and have been removed (see
 * data/programs.ts).
 *
 * Whoever owns WCCC Connect owns these numbers. If they change there, change
 * them here — or better, retire this file and link to that site instead once
 * the two properties are joined up.
 *
 * The homepage hero reads this same array, so there is one copy rather than
 * two that can drift.
 */
export const stats: StatItem[] = [
  {
    value: "260+",
    label: "Business Members",
    detail: "served through programs and partnerships",
  },
  {
    value: "5,000+",
    label: "Event & Program Participants",
    detail: "learning, connecting, and building",
  },
  {
    value: "30+",
    label: "Strategic Partners",
    detail: "supporting members across Wisconsin",
  },
  {
    value: "10+",
    label: "Communities Served",
    detail: "across the state of Wisconsin",
  },
];

/**
 * Short labels for the strip under the hero image. Same numbers as `stats`
 * above, since they describe the same organisation — the hero used to carry
 * its own hardcoded copy, which is how the two ended up able to disagree.
 */
export const heroStats = stats.map((stat) => ({
  val: stat.value,
  label: stat.label,
}));

const tiers = [
  {
    label: "Network",
    price: "Free",
    description: "Join the community",
    perks: ["Community directory", "Public events", "Newsletter", "One-time help requests"],
    cta: "Join Free",
    href: "/login",
    highlight: false,
  },
  {
    label: "Individual",
    price: "$150",
    period: "/year",
    description: "For professionals",
    perks: ["Everything in Network", "All programs & Office Hours", "Mentorship matching", "Member-only events"],
    cta: "Get Started",
    href: "/login",
    highlight: false,
  },
  {
    label: "Business",
    price: "$300",
    period: "/year",
    description: "For businesses & startups",
    perks: ["Everything in Individual", "Business resources", "Startup support", "Priority advising"],
    cta: "Join as Business",
    href: "/login",
    highlight: true,
  },
  {
    label: "Corporate",
    price: "$1,500",
    period: "/year",
    description: "For organizations",
    perks: ["Everything in Business", "Up to 10 staff seats", "Prominent listing", "Sponsorship opportunities"],
    cta: "Contact Us",
    href: "mailto:info@wisccc.org?subject=Corporate Membership",
    highlight: false,
  },
];

export default function MembershipCTA() {
  return (
    <section className="bg-[#0c1e3a] px-6 py-24" id="membership">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-12 bg-[#a07830]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-[#a07830]">Membership</p>
            <div className="h-px w-12 bg-[#a07830]" />
          </div>
          <h2 className="font-serif text-4xl font-bold text-white sm:text-5xl leading-[1.1]">
            Invest in yourself.{" "}
            <em className="not-italic text-[#c9993a]">Grow your business.</em>{" "}
            Shape Wisconsin.
          </h2>
          <p className="mt-5 max-w-2xl mx-auto text-base leading-8 text-white/55">
            WCCC is Wisconsin's diverse chamber — rooted in Asian-American heritage and open to every
            entrepreneur and professional ready to grow.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.label}
              className={`relative flex flex-col rounded-lg border p-6 ${
                tier.highlight
                  ? "border-[#c9993a] bg-white/5"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#c9993a] px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#0c1e3a]">
                  Most Popular
                </span>
              )}
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#a07830] mb-3">{tier.label}</p>
              <div className="font-serif text-3xl font-bold text-white">
                {tier.price}
                {tier.period && <span className="text-sm font-normal text-white/40">{tier.period}</span>}
              </div>
              <p className="mt-1 text-xs text-white/45 mb-5">{tier.description}</p>
              <ul className="space-y-2 flex-1 mb-6">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-xs text-white/60">
                    <span className="text-[#c9993a] shrink-0 mt-0.5">✓</span>{perk}
                  </li>
                ))}
              </ul>
              <a
                href={tier.href}
                className={`block text-center rounded px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                  tier.highlight
                    ? "bg-[#c9993a] text-[#0c1e3a] hover:bg-[#a07830]"
                    : "border border-white/20 text-white/70 hover:border-white/50 hover:text-white"
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/30">
          Payment for paid tiers is arranged by our team after signup. Contact{" "}
          <a href="mailto:info@wisccc.org" className="underline hover:text-white/60">info@wisccc.org</a>{" "}
          with questions.
        </p>
      </div>
    </section>
  );
}

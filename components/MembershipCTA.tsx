export default function MembershipCTA() {
  return (
    <section className="bg-[#07172b] px-6 py-16">
      <div className="mx-auto max-w-7xl grid gap-10 lg:grid-cols-2 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">
            Join Our Community
          </p>
          <h2 className="mt-4 font-serif text-4xl font-bold text-white sm:text-5xl">
            Become a WCCC Member
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/72 max-w-lg">
            Join hundreds of entrepreneurs, professionals, and community partners
            across Wisconsin. Access exclusive programs, events, funding resources,
            and a network built for growth.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="/login"
              className="rounded-full bg-[#d7a84d] px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-[#07172b] transition hover:bg-[#f1c864]"
            >
              Join Us
            </a>
            <a
              href="#programs"
              className="rounded-full border border-white/25 px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:border-[#d7a84d] hover:text-[#d7a84d]"
            >
              Support Us
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { value: "240+", label: "Member Businesses" },
            { value: "60+", label: "Community Partners" },
            { value: "1,500+", label: "Event Participants" },
            { value: "Est. 2017", label: "Serving Wisconsin" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[12px] border border-[#d7a84d]/20 bg-white/5 p-6 text-center"
            >
              <div className="font-serif text-4xl font-bold text-[#d7a84d]">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-white/65">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

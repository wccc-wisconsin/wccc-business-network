const memberStats = [
  { value: "240+", label: "Active Members" },
  { value: "60+", label: "Community Partners" },
  { value: "1,500+", label: "Event Attendees" },
  { value: "Est. 2017", label: "Serving Wisconsin" },
];

export default function MembershipCTA() {
  return (
    <section className="bg-[#0c1e3a] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-14 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px w-12 bg-[#a07830]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-[#a07830]">Membership</p>
            </div>
            <h2 className="font-serif text-4xl font-bold text-white sm:text-5xl leading-[1.1]">
              Invest in yourself.{" "}
              <em className="not-italic text-[#c9993a]">Grow your business.</em>{" "}
              Shape Wisconsin.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/55">
              WCCC membership opens two journeys at once — personal development programs
              that sharpen your leadership, and business resources that help you scale.
              Join 240+ professionals building a stronger Wisconsin, together.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="/login" className="rounded border border-[#c9993a] bg-[#c9993a] px-8 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0c1e3a] transition hover:bg-[#a07830] hover:border-[#a07830]">
                Become a Member
              </a>
              <a href="#programs" className="rounded border border-white/20 px-8 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70 transition hover:border-white/50 hover:text-white">
                Explore Programs
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:min-w-[260px]">
            {memberStats.map((s) => (
              <div key={s.label} className="rounded border border-white/10 bg-white/5 p-5">
                <div className="font-serif text-3xl font-bold text-[#c9993a]">{s.value}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

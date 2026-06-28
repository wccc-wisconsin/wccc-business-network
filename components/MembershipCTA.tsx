const memberStats = [
  { value: "240+", label: "Active Members" },
  { value: "60+", label: "Community Partners" },
  { value: "1,500+", label: "Event Attendees" },
  { value: "Est. 2017", label: "Serving Wisconsin" },
];

export default function MembershipCTA() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-[#d7a84d]/25 bg-gradient-to-br from-[#fffbf0] to-white p-10 lg:p-16 shadow-sm">
          <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#d7a84d] mb-3">Membership</p>
              <h2 className="font-serif text-4xl font-bold text-[#0f1e35] sm:text-5xl">
                Become a{" "}
                <span className="text-gradient-gold">WCCC Member</span>
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-500">
                Join Wisconsin&apos;s leading Chinese-American business network. Access programs,
                events, mentorship, and a community of over 240 member businesses
                driving economic growth across the state.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="/login"
                  className="rounded-full bg-[#d7a84d] px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#c4953a] glow-gold"
                >
                  Join Us
                </a>
                <a
                  href="#programs"
                  className="rounded-full border border-[#d7a84d] px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-[#d7a84d] transition hover:bg-[#d7a84d] hover:text-white"
                >
                  Support Us
                </a>
              </div>
            </div>

            <div className="grid w-full max-w-xs gap-4 sm:grid-cols-2 lg:max-w-none lg:w-auto lg:min-w-[260px]">
              {memberStats.map((s) => (
                <div key={s.label} className="rounded-xl border border-[#d7a84d]/20 bg-white p-5 shadow-sm">
                  <div className="text-gradient-gold font-serif text-3xl font-bold">{s.value}</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

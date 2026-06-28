export default function Hero() {
  return (
    <section id="top" aria-labelledby="home-heading" className="relative overflow-hidden">
      {/* Full image — no cropping, section height follows the photo */}
      <div className="relative w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/wccc-hero.png"
          alt="WCCC community events"
          className="w-full h-auto brightness-110 saturate-[1.3]"
        />

        {/* Light overlay — photo stays visible, left edge darkened for text */}
        <div className="absolute inset-0 bg-[#0c1e3a]/35" />
        <div className="absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-[#0c1e3a]/50 to-transparent" />

        {/* Content sits on top */}
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="max-w-2xl">
              {/* Eyebrow */}
              <div className="fade-up flex items-center gap-4 mb-5">
                <div className="h-px w-10 bg-[#c9993a]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#c9993a]">
                  Wisconsin Chinese Chamber of Commerce
                </span>
              </div>

              {/* Headline */}
              <h1
                id="home-heading"
                className="fade-up fade-up-delay-1 font-serif text-4xl font-bold leading-[1.1] text-white lg:text-5xl"
              >
                Empowering Wisconsin's{" "}
                <em className="not-italic text-[#c9993a]">small businesses</em>{" "}
                to grow, connect, and lead.
              </h1>

              <div className="fade-up fade-up-delay-2 mt-5 mb-4 w-12 border-t-2 border-[#c9993a]" />

              <p className="fade-up fade-up-delay-2 max-w-md text-sm leading-7 text-white/75">
                Programs, mentorship, and strategic connections for entrepreneurs and
                professionals across Wisconsin.
              </p>

              <div className="fade-up fade-up-delay-3 mt-6 flex flex-wrap gap-3">
                <a href="#programs" className="rounded border border-[#c9993a] bg-[#c9993a] px-7 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0c1e3a] transition hover:bg-[#a07830] hover:border-[#a07830]">
                  Explore Programs →
                </a>
                <a href="/login" className="rounded border border-white/50 px-7 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-white hover:text-[#0c1e3a]">
                  Become a Member
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat strip below photo — on the cream background */}
      <div className="bg-[#0c1e3a]">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/10">
            {[
              { val: "240+",     label: "Member Businesses" },
              { val: "60+",      label: "Community Partners" },
              { val: "1,500+",   label: "Event Participants" },
              { val: "Est. 2017",label: "Serving Wisconsin" },
            ].map((s) => (
              <div key={s.label} className="px-6 py-5">
                <div className="font-serif text-2xl font-bold text-[#c9993a]">{s.val}</div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

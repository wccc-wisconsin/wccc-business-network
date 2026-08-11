export default function Hero() {
  return (
    <section id="top" aria-labelledby="home-heading" className="relative overflow-hidden">
      {/* The photo used to set this section's height (`h-auto`, with the copy
          absolutely positioned over it). It's 1200×400 — a 3:1 strip — so on a
          390px-wide phone it rendered 130px tall while the headline, paragraph
          and buttons needed roughly 380px, and the section's `overflow-hidden`
          cut the difference off. Anything narrower than about 1280px lost text.

          Now the copy is in normal flow and sets the height, the photo is
          absolutely positioned behind it as a cover background, and `min-h`
          keeps the band generous on wide screens where the text is short. The
          photo crops a little at the top and bottom on narrow screens, which
          is the trade for the words being readable. */}
      <div className="relative w-full min-h-[540px] sm:min-h-[460px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/wccc-hero.png"
          alt="WCCC community events"
          className="absolute inset-0 h-full w-full object-cover brightness-110 saturate-[1.3]"
        />

        {/* Light overlay — photo stays visible, left edge darkened for text */}
        <div className="absolute inset-0 bg-[#0c1e3a]/35" />
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#0c1e3a]/70 to-transparent sm:w-[55%] sm:from-[#0c1e3a]/50" />

        {/* Content sits on top */}
        <div className="relative flex min-h-[540px] items-center sm:min-h-[460px]">
          <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
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
                className="fade-up fade-up-delay-1 font-serif text-3xl font-bold leading-[1.15] text-white sm:text-4xl sm:leading-[1.1] lg:text-5xl"
              >
                Grow as a person.{" "}
                <em className="not-italic text-[#c9993a]">Build your business.</em>{" "}
                Lead your community.
              </h1>

              <div className="fade-up fade-up-delay-2 mt-5 mb-4 w-12 border-t-2 border-[#c9993a]" />

              <p className="fade-up fade-up-delay-2 max-w-md text-sm leading-7 text-white/75">
                A diverse chamber rooted in Asian-American heritage, open to all. WCCC
                connects Wisconsin professionals, entrepreneurs, and community leaders to
                the programs, mentorship, and people to thrive at every stage.
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

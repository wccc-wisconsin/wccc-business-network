import Image from "next/image";

export default function Hero() {
  return (
    <section id="top" aria-labelledby="home-heading" className="relative overflow-hidden bg-[#faf8f5]">
      {/* Warm dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/20 to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

          {/* Left — text */}
          <div>
            <div className="fade-up flex items-center gap-4 mb-8">
              <div className="h-px w-12 bg-[#a07830]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.42em] text-[#a07830]">
                Wisconsin Chinese Chamber of Commerce
              </span>
            </div>

            <h1
              id="home-heading"
              className="fade-up fade-up-delay-1 font-serif text-[2.9rem] font-bold leading-[1.08] text-[#0c1e3a] lg:text-[3.5rem]"
            >
              Empowering Wisconsin's{" "}
              <span className="text-gold">small businesses</span>{" "}
              to grow, connect, and lead.
            </h1>

            <div className="fade-up fade-up-delay-2 mt-8 mb-7 w-16 border-t-2 border-[#a07830]" />

            <p className="fade-up fade-up-delay-2 max-w-lg text-base leading-8 text-[#64748b]">
              Programs, mentorship, and strategic connections for entrepreneurs and
              professionals across Wisconsin — backed by a chamber with years of
              community impact.
            </p>

            <div className="fade-up fade-up-delay-3 mt-8 flex flex-wrap gap-4">
              <a href="#programs" className="btn-navy">Explore Programs →</a>
              <a href="/login" className="btn-gold-outline">Become a Member</a>
            </div>

            {/* Stats row */}
            <div className="fade-up fade-up-delay-3 mt-12 grid grid-cols-2 gap-px border border-[#e8e3db] rounded-lg overflow-hidden sm:grid-cols-4 bg-[#e8e3db]">
              {[
                { val: "240+", label: "Members" },
                { val: "60+", label: "Partners" },
                { val: "1,500+", label: "Attendees" },
                { val: "Est. 2017", label: "Wisconsin" },
              ].map((s) => (
                <div key={s.label} className="bg-white px-4 py-4">
                  <div className="font-serif text-2xl font-bold text-[#a07830]">{s.val}</div>
                  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#94a3b8]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — photo */}
          <div className="fade-up fade-up-delay-2 relative hidden lg:block">
            {/* Gold frame accent */}
            <div className="absolute -top-4 -right-4 h-full w-full rounded-2xl border-2 border-[#a07830]/25" />
            <div className="relative overflow-hidden rounded-2xl shadow-2xl">
              <Image
                src="/wccc-hero.png"
                alt="WCCC members at a community event"
                width={720}
                height={480}
                className="w-full object-cover"
                priority
              />
              {/* Subtle overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c1e3a]/20 to-transparent" />
              {/* Caption badge */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-lg bg-white/90 backdrop-blur px-4 py-3 shadow-sm">
                <div className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded bg-[#0c1e3a] font-serif text-sm font-bold text-[#c9993a]">W</div>
                <div>
                  <div className="text-[11px] font-bold text-[#0c1e3a]">WCCC Community Events</div>
                  <div className="text-[10px] text-[#94a3b8]">Connecting Wisconsin businesses since 2017</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

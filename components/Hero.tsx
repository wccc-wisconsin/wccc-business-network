export default function Hero() {
  return (
    <section id="top" aria-labelledby="home-heading" className="relative overflow-hidden bg-[#050d1a]">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-60" />

      {/* Radial glow blobs */}
      <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[#38bdf8]/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-20 right-0 h-[500px] w-[500px] rounded-full bg-[#d7a84d]/8 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-[800px] rounded-full bg-[#6d28d9]/10 blur-[100px] pointer-events-none" />

      {/* Scan line */}
      <div className="scan-line absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#38bdf8]/40 to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 py-28 lg:py-36">
        {/* Eyebrow */}
        <div className="fade-up flex items-center gap-3 mb-8">
          <div className="h-px w-12 bg-gradient-to-r from-[#38bdf8] to-transparent" />
          <span className="text-xs font-bold uppercase tracking-[0.35em] text-[#38bdf8]">
            Wisconsin Chinese Chamber of Commerce
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#38bdf8]/30 to-transparent" />
        </div>

        {/* Headline */}
        <h1
          id="home-heading"
          className="fade-up fade-up-delay-1 font-serif text-5xl font-bold leading-[1.08] text-white sm:text-6xl lg:text-7xl max-w-4xl"
        >
          We help Wisconsin{" "}
          <span className="text-gradient-gold">small businesses grow</span>
          {" "}— with programs, mentorship, and strategic connections.
        </h1>

        <p className="fade-up fade-up-delay-2 mt-6 max-w-2xl text-lg leading-8 text-white/60">
          A forward-looking member hub for entrepreneurs, professionals, and community
          partners building stronger companies and careers across Wisconsin.
        </p>

        {/* CTAs */}
        <div className="fade-up fade-up-delay-3 mt-10 flex flex-wrap gap-4">
          <a
            href="#programs"
            className="group relative rounded-full bg-[#d7a84d] px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-[#050d1a] transition hover:bg-[#f1c864] glow-gold"
          >
            View Programs
          </a>
          <a
            href="#events"
            className="rounded-full border border-[#38bdf8]/40 px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-[#38bdf8] transition hover:bg-[#38bdf8]/10 hover:border-[#38bdf8]"
          >
            Upcoming Events
          </a>
          <a
            href="/login"
            className="rounded-full border border-white/15 px-8 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white/70 transition hover:border-white/40 hover:text-white"
          >
            Become a Member
          </a>
        </div>

        {/* Floating stat chips */}
        <div className="fade-up fade-up-delay-3 mt-16 flex flex-wrap gap-4">
          {[
            { val: "240+", label: "Member Businesses" },
            { val: "60+", label: "Community Partners" },
            { val: "1,500+", label: "Event Participants" },
            { val: "Est. 2017", label: "Serving Wisconsin" },
          ].map((s) => (
            <div key={s.label} className="glass rounded-full px-5 py-2 flex items-center gap-3">
              <span className="font-bold text-[#d7a84d]">{s.val}</span>
              <span className="text-xs text-white/50">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

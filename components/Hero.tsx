export default function Hero() {
  return (
    <section id="top" aria-labelledby="home-heading" className="relative overflow-hidden bg-[#faf8f5]">
      {/* Warm dot grid */}
      <div className="absolute inset-0 dot-grid opacity-70 pointer-events-none" />

      {/* Soft gradient sweep */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-[#f0ebe3]/60 pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-28 lg:pt-32 lg:pb-36">

        {/* Eyebrow */}
        <div className="fade-up flex items-center gap-4 mb-10">
          <div className="h-px w-16 bg-[#a07830]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.42em] text-[#a07830]">
            Wisconsin Chinese Chamber of Commerce
          </span>
        </div>

        {/* Headline */}
        <h1
          id="home-heading"
          className="fade-up fade-up-delay-1 font-serif text-5xl font-bold leading-[1.06] text-[#0c1e3a] sm:text-6xl lg:text-[5rem] max-w-4xl"
        >
          Empowering Wisconsin's{" "}
          <em className="not-italic text-gold">small businesses</em>{" "}
          to grow, connect, and lead.
        </h1>

        {/* Thin rule */}
        <div className="fade-up fade-up-delay-2 mt-10 mb-8 w-24 border-t-2 border-[#a07830]" />

        <p className="fade-up fade-up-delay-2 max-w-xl text-lg leading-8 text-[#64748b]">
          Programs, mentorship, and strategic connections for entrepreneurs and
          professionals across Wisconsin — backed by a chamber with over two decades
          of community impact.
        </p>

        {/* CTAs */}
        <div className="fade-up fade-up-delay-3 mt-10 flex flex-wrap gap-4">
          <a href="#programs" className="btn-navy">Explore Programs →</a>
          <a href="/login" className="btn-gold-outline">Become a Member</a>
        </div>

        {/* Stats row */}
        <div className="fade-up fade-up-delay-3 mt-20 grid grid-cols-2 gap-px border border-[#e8e3db] rounded-lg overflow-hidden sm:grid-cols-4 bg-[#e8e3db]">
          {[
            { val: "240+", label: "Member Businesses" },
            { val: "60+", label: "Community Partners" },
            { val: "1,500+", label: "Event Participants" },
            { val: "Est. 2017", label: "Serving Wisconsin" },
          ].map((s) => (
            <div key={s.label} className="bg-white px-6 py-5">
              <div className="font-serif text-3xl font-bold text-[#a07830]">{s.val}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

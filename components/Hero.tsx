import Image from "next/image";

export default function Hero() {
  return (
    <section id="top" aria-labelledby="home-heading" className="relative overflow-hidden">
      {/* Full-width background photo */}
      <div className="absolute inset-0">
        <Image
          src="/wccc-hero.png"
          alt="WCCC community event"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Dark gradient overlay so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c1e3a]/85 via-[#0c1e3a]/60 to-[#0c1e3a]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1e3a]/70 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-6 py-32 lg:py-44">
        <div className="max-w-2xl">
          {/* Eyebrow */}
          <div className="fade-up flex items-center gap-4 mb-8">
            <div className="h-px w-12 bg-[#c9993a]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.42em] text-[#c9993a]">
              Wisconsin Chinese Chamber of Commerce
            </span>
          </div>

          {/* Headline */}
          <h1
            id="home-heading"
            className="fade-up fade-up-delay-1 font-serif text-5xl font-bold leading-[1.08] text-white lg:text-[3.8rem]"
          >
            Empowering Wisconsin's{" "}
            <em className="not-italic text-[#c9993a]">small businesses</em>{" "}
            to grow, connect, and lead.
          </h1>

          <div className="fade-up fade-up-delay-2 mt-8 mb-7 w-16 border-t-2 border-[#c9993a]" />

          <p className="fade-up fade-up-delay-2 max-w-lg text-lg leading-8 text-white/75">
            Programs, mentorship, and strategic connections for entrepreneurs and
            professionals across Wisconsin — backed by years of community impact.
          </p>

          <div className="fade-up fade-up-delay-3 mt-8 flex flex-wrap gap-4">
            <a href="#programs" className="rounded border border-[#c9993a] bg-[#c9993a] px-8 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0c1e3a] transition hover:bg-[#a07830] hover:border-[#a07830]">
              Explore Programs →
            </a>
            <a href="/login" className="rounded border border-white/50 px-8 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-white hover:text-[#0c1e3a]">
              Become a Member
            </a>
          </div>
        </div>

        {/* Stat strip pinned to bottom */}
        <div className="fade-up fade-up-delay-3 mt-20 grid grid-cols-2 gap-px sm:grid-cols-4 border border-white/15 rounded-lg overflow-hidden bg-white/10">
          {[
            { val: "240+", label: "Member Businesses" },
            { val: "60+",  label: "Community Partners" },
            { val: "1,500+", label: "Event Participants" },
            { val: "Est. 2017", label: "Serving Wisconsin" },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 backdrop-blur-sm px-6 py-5">
              <div className="font-serif text-2xl font-bold text-[#c9993a]">{s.val}</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

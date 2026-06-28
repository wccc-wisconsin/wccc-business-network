import { journeyCards } from "@/data/programs";

const accentStyles: Record<string, string> = {
  teal: "glass-cyan",
  plum: "glass border-[#818cf8]/20",
};

const glowStyles: Record<string, string> = {
  teal: "glow-cyan",
  plum: "",
};

export default function JourneyCards() {
  return (
    <section className="bg-[#050d1a] px-6 py-16" aria-labelledby="journeys">
      {/* Section glow */}
      <div className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-[#38bdf8]/20 to-transparent" />

      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#38bdf8] mb-3">Your Path Forward</p>
          <h2 id="journeys" className="font-serif text-4xl font-bold text-white sm:text-5xl">
            Choose Your Journey
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {journeyCards.map((journey) => (
            <article
              key={journey.title}
              className={`rounded-2xl p-8 transition duration-300 hover:scale-[1.01] ${accentStyles[journey.accent]}`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#38bdf8]">
                {journey.eyebrow}
              </p>
              <h3 className="mt-3 font-serif text-3xl font-bold text-white">
                {journey.title}
              </h3>
              <p className="mt-2 text-base font-semibold text-[#d7a84d]">
                {journey.subtitle}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/60">
                {journey.description}
              </p>

              <div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
                {journey.items.map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-white/70"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#38bdf8] shrink-0" />
                    {item}
                  </span>
                ))}
              </div>

              <a
                href="#assistant"
                className={`mt-8 inline-flex rounded-full bg-white/10 border border-white/15 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#d7a84d] hover:text-[#050d1a] hover:border-[#d7a84d]`}
              >
                {journey.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

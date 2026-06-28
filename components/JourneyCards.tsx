import { journeyCards } from "@/data/programs";

export default function JourneyCards() {
  return (
    <section className="bg-[#f8fafc] px-6 py-16" aria-labelledby="journeys">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#38bdf8] mb-3">Your Path Forward</p>
          <h2 id="journeys" className="font-serif text-4xl font-bold text-[#0f1e35] sm:text-5xl">
            Choose Your Journey
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {journeyCards.map((journey) => (
            <article
              key={journey.title}
              className="rounded-2xl border border-slate-200 bg-white p-8 transition duration-300 hover:shadow-lg hover:border-[#d7a84d]/30"
            >
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#38bdf8]">
                {journey.eyebrow}
              </p>
              <h3 className="mt-3 font-serif text-3xl font-bold text-[#0f1e35]">
                {journey.title}
              </h3>
              <p className="mt-2 text-base font-semibold text-[#d7a84d]">
                {journey.subtitle}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
                {journey.description}
              </p>

              <div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
                {journey.items.map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-600"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#38bdf8] shrink-0" />
                    {item}
                  </span>
                ))}
              </div>

              <a
                href="#assistant"
                className="mt-8 inline-flex rounded-full border border-[#d7a84d] px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#d7a84d] transition hover:bg-[#d7a84d] hover:text-white"
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

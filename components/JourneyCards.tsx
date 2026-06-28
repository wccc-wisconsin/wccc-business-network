import { journeyCards } from "@/data/programs";

export default function JourneyCards() {
  return (
    <section className="bg-[#faf8f5] px-6 py-20" aria-labelledby="journeys">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="mb-12 flex items-end justify-between border-b border-[#e8e3db] pb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-[#a07830] mb-2">Pathways</p>
            <h2 id="journeys" className="font-serif text-4xl font-bold text-[#0c1e3a]">
              Choose Your Journey
            </h2>
          </div>
          <a href="#assistant" className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a07830] hover:text-[#0c1e3a] transition sm:block">
            Talk to an Advisor →
          </a>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {journeyCards.map((journey, i) => (
            <article key={journey.title} className="card p-8">
              {/* Number + eyebrow */}
              <div className="flex items-center gap-3 mb-5">
                <span className="font-serif text-4xl font-bold text-[#e8e3db]">0{i + 1}</span>
                <div className="h-px flex-1 bg-[#e8e3db]" />
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#a07830]">{journey.eyebrow}</span>
              </div>

              <h3 className="font-serif text-3xl font-bold text-[#0c1e3a]">{journey.title}</h3>
              <p className="mt-1 text-sm font-semibold text-[#a07830]">{journey.subtitle}</p>
              <p className="mt-3 text-sm leading-7 text-[#64748b]">{journey.description}</p>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {journey.items.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-[#0c1e3a]">
                    <span className="h-1 w-4 flex-shrink-0 bg-[#a07830]" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-[#e8e3db]">
                <a href="#assistant" className="btn-gold-outline">{journey.cta}</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

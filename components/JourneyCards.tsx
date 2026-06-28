import { journeyCards } from "@/data/programs";

const accentStyles = {
  teal: "border-[#2dd4bf]/40 bg-[#0f3f44]",
  plum: "border-[#c084fc]/40 bg-[#36215a]",
};

export default function JourneyCards() {
  return (
    <section className="bg-[#07172b] px-6 py-8" aria-labelledby="journeys">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="h-px w-20 bg-[#d7a84d]" />
          <h2
            id="journeys"
            className="font-serif text-3xl font-bold text-white sm:text-4xl"
          >
            Choose Your Journey
          </h2>
          <div className="h-px flex-1 bg-[#d7a84d]/40" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {journeyCards.map((journey) => (
            <article
              key={journey.title}
              className={
                "rounded-[8px] border p-6 shadow-2xl shadow-black/15 " +
                accentStyles[journey.accent]
              }
            >
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#f1c864]">
                {journey.eyebrow}
              </p>
              <h3 className="mt-3 font-serif text-3xl font-bold text-white">
                {journey.title}
              </h3>
              <p className="mt-2 text-base font-semibold text-white/90">
                {journey.subtitle}
              </p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
                {journey.description}
              </p>

              <div className="mt-6 grid gap-3 text-sm text-white/82 sm:grid-cols-2">
                {journey.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <a
                href="#assistant"
                className="mt-7 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#07172b] transition hover:bg-[#f1c864]"
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

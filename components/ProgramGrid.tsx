import { programs } from "@/data/programs";

export default function ProgramGrid() {
  return (
    <section id="programs" aria-labelledby="programs-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="programs-heading" className="font-serif text-3xl font-bold text-white">
          Our Programs
        </h2>
        <a className="text-sm font-bold text-[#d7a84d] hover:text-[#f1c864] transition" href="#assistant">
          View all →
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {programs.map((program) => (
          <article
            key={program.title}
            className="glass min-h-[168px] rounded-xl p-5 transition hover:border-[#38bdf8]/20"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#38bdf8]">
              {program.track}
            </p>
            <h3 className="mt-3 text-base font-bold text-white">
              {program.title}
            </h3>
            <p className="mt-1 text-sm font-semibold text-[#d7a84d]">
              {program.subtitle}
            </p>
            <p className="mt-3 text-sm leading-6 text-white/50">
              {program.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

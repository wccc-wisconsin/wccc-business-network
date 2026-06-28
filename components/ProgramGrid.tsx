import { programs } from "@/data/programs";

export default function ProgramGrid() {
  return (
    <section id="programs" aria-labelledby="programs-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="programs-heading"
          className="font-serif text-3xl font-bold text-[#07172b]"
        >
          Our Programs
        </h2>
        <a className="text-sm font-bold text-[#9b6b1f]" href="#assistant">
          View all programs
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {programs.map((program) => (
          <article
            key={program.title}
            className="min-h-[168px] rounded-[8px] border border-[#07172b]/10 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b6b1f]">
              {program.track}
            </p>
            <h3 className="mt-3 text-lg font-bold text-[#07172b]">
              {program.title}
            </h3>
            <p className="mt-1 text-sm font-semibold text-[#0f766e]">
              {program.subtitle}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {program.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

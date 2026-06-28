import { programs } from "@/data/programs";

export default function ProgramGrid() {
  return (
    <section id="programs" aria-labelledby="programs-heading">
      <div className="mb-6 flex items-end justify-between border-b border-[#e8e3db] pb-4">
        <h2 id="programs-heading" className="font-serif text-2xl font-bold text-[#0c1e3a]">
          Our Programs
        </h2>
        <a href="#assistant" className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a07830] hover:text-[#0c1e3a] transition">
          View All →
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {programs.map((program) => (
          <article key={program.title} className="card p-5 min-h-[160px]">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[#a07830]">
              {program.track}
            </p>
            <h3 className="mt-2 text-[15px] font-bold text-[#0c1e3a]">
              {program.title}
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#64748b]">
              {program.subtitle}
            </p>
            <p className="mt-2 text-xs leading-6 text-[#94a3b8]">
              {program.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

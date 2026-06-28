import { stats } from "@/data/stats";

export default function Stats() {
  return (
    <section className="bg-[#0f2d4a] px-6 pb-12 pt-3" aria-label="WCCC impact">
      <div className="mx-auto grid max-w-7xl gap-4 rounded-[8px] border border-[#d7a84d]/25 bg-[#132f52] p-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-white/10 p-4 lg:border-r lg:last:border-r-0"
          >
            <div className="font-serif text-4xl font-bold text-[#d7a84d]">
              {stat.value}
            </div>
            <div className="mt-1 text-base font-bold text-white">
              {stat.label}
            </div>
            <p className="mt-2 text-sm leading-6 text-white/68">
              {stat.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

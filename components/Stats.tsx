import { stats } from "@/data/stats";

export default function Stats() {
  return (
    <section className="bg-[#050d1a] px-6 pb-16 pt-0" aria-label="WCCC impact">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4 rounded-2xl overflow-hidden border border-white/[0.06]">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="glass p-8 relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#38bdf8]/5 to-transparent opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative">
                <div className="text-gradient-gold font-serif text-5xl font-bold">
                  {stat.value}
                </div>
                <div className="mt-2 text-base font-bold text-white">
                  {stat.label}
                </div>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  {stat.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

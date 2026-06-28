import { partners } from "@/data/programs";

export default function Partners() {
  return (
    <section
      id="partners"
      className="bg-[#050d1a] px-6 pb-16 pt-8"
      aria-labelledby="partners-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 id="partners-heading" className="font-serif text-3xl font-bold text-white">
            Our Partners
          </h2>
          <div className="h-px flex-1 mx-6 bg-gradient-to-r from-[#38bdf8]/20 to-transparent" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {partners.map((partner) => (
            <div
              key={partner}
              className="glass flex min-h-[80px] items-center justify-center rounded-xl px-4 text-center text-sm font-bold text-white/50 transition hover:border-white/20 hover:text-white"
            >
              {partner}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

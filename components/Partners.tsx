import { partners } from "@/data/programs";

export default function Partners() {
  return (
    <section
      id="partners"
      className="bg-[#f8fafc] px-6 pb-16 pt-8"
      aria-labelledby="partners-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <h2 id="partners-heading" className="font-serif text-3xl font-bold text-[#0f1e35]">
            Our Partners
          </h2>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {partners.map((partner) => (
            <div
              key={partner}
              className="flex min-h-[80px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-center text-sm font-bold text-slate-500 shadow-sm transition hover:border-[#d7a84d]/30 hover:text-[#0f1e35] hover:shadow-md"
            >
              {partner}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

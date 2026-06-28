import { partners } from "@/data/programs";

export default function Partners() {
  return (
    <section
      id="partners"
      className="bg-[#f8f1e7] px-6 pb-14 pt-4 text-[#0f2d4a]"
      aria-labelledby="partners-heading"
    >
      <div className="mx-auto max-w-7xl">
        <h2
          id="partners-heading"
          className="font-serif text-3xl font-bold text-[#0f2d4a]"
        >
          Our Partners
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {partners.map((partner) => (
            <div
              key={partner}
              className="flex min-h-[92px] items-center justify-center rounded-[8px] border border-[#0f2d4a]/10 bg-white px-4 text-center text-sm font-bold text-slate-700 shadow-sm"
            >
              {partner}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

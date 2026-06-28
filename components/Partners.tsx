import { partners } from "@/data/programs";

export default function Partners() {
  return (
    <section id="partners" className="bg-white px-6 py-16" aria-labelledby="partners-heading">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between border-b border-[#e8e3db] pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-[#a07830] mb-1">Community</p>
            <h2 id="partners-heading" className="font-serif text-3xl font-bold text-[#0c1e3a]">
              Our Partners
            </h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {partners.map((partner) => (
            <div
              key={partner}
              className="card flex min-h-[80px] items-center justify-center px-4 text-center text-[12px] font-semibold text-[#64748b] hover:text-[#0c1e3a]"
            >
              {partner}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

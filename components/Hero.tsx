const heroBackground =
  "linear-gradient(90deg, rgba(7, 23, 43, 0.98) 0%, rgba(7, 23, 43, 0.9) 46%, rgba(7, 23, 43, 0.3) 100%), url('https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1600&auto=format&fit=crop')";

export default function Hero() {
  return (
    <section
      id="top"
      className="bg-[#07172b] px-6 py-8"
      aria-labelledby="home-heading"
    >
      <div
        className="mx-auto min-h-[560px] max-w-7xl overflow-hidden rounded-[8px] border border-[#d7a84d]/25 bg-cover bg-center"
        style={{ backgroundImage: heroBackground }}
      >
        <div className="flex min-h-[560px] items-end px-6 py-10 sm:px-10 lg:px-14">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.32em] text-[#f1c864]">
              Wisconsin Chinese Chamber of Commerce
            </p>

            <h1
              id="home-heading"
              className="font-serif text-5xl leading-tight text-white sm:text-6xl lg:text-7xl"
            >
              Helping people grow. Helping businesses thrive.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82">
              A practical member hub for entrepreneurs, professionals, and
              community partners building stronger companies and careers.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#programs"
                className="rounded-full bg-[#d7a84d] px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#07172b] transition hover:bg-[#f1c864]"
              >
                View Programs
              </a>
              <a
                href="#events"
                className="rounded-full border border-white/25 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:border-[#d7a84d]"
              >
                Upcoming Events
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

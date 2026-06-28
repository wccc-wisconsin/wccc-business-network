const photos = [
  {
    src: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop",
    alt: "Business networking event",
  },
  {
    src: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=800&auto=format&fit=crop",
    alt: "Speaker presenting at workshop",
  },
  {
    src: "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=800&auto=format&fit=crop",
    alt: "Community business meeting",
  },
  {
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800&auto=format&fit=crop",
    alt: "Team collaboration",
  },
  {
    src: "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?q=80&w=800&auto=format&fit=crop",
    alt: "Entrepreneurs networking",
  },
  {
    src: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop",
    alt: "Conference and events",
  },
];

export default function Hero() {
  return (
    <section id="top" aria-labelledby="home-heading">
      {/* Photo collage grid */}
      <div className="grid grid-cols-3 grid-rows-2 h-[520px] lg:h-[600px]">
        {photos.map((photo, i) => (
          <div key={i} className="relative overflow-hidden">
            <img
              src={photo.src}
              alt={photo.alt}
              className="h-full w-full object-cover transition duration-500 hover:scale-105"
            />
            <div className="absolute inset-0 bg-[#0f2d4a]/30" />
          </div>
        ))}
      </div>

      {/* Overlay headline bar */}
      <div className="relative -mt-28 px-6 pb-0 z-10">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[12px] bg-[#0f2d4a]/90 backdrop-blur-sm border border-[#d7a84d]/30 px-8 py-8 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#f1c864]">
              Wisconsin Chinese Chamber of Commerce
            </p>
            <h1
              id="home-heading"
              className="mt-3 font-serif text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl"
            >
              We help Wisconsin small businesses grow — with programs, mentorship, and strategic connections.
            </h1>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#programs"
                className="rounded-full bg-[#d7a84d] px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#0f2d4a] transition hover:bg-[#f1c864]"
              >
                View Programs
              </a>
              <a
                href="#events"
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition hover:border-[#d7a84d] hover:text-[#d7a84d]"
              >
                Upcoming Events
              </a>
              <a
                href="/login"
                className="rounded-full border border-[#d7a84d]/60 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#d7a84d] transition hover:bg-[#d7a84d] hover:text-[#0f2d4a]"
              >
                Become a Member
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

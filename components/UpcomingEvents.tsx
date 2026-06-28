import { events } from "@/data/events";

export default function UpcomingEvents() {
  return (
    <section id="events" aria-labelledby="events-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="events-heading" className="font-serif text-3xl font-bold text-white">
          Upcoming Events
        </h2>
        <a className="text-sm font-bold text-[#d7a84d] hover:text-[#f1c864] transition" href="#assistant">
          View all →
        </a>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <article
            key={event.title}
            className="glass grid gap-4 rounded-xl p-4 transition hover:border-white/15 sm:grid-cols-[72px_1fr_auto] sm:items-center"
          >
            <div className="flex h-16 w-[72px] flex-col items-center justify-center rounded-lg bg-[#d7a84d]/15 border border-[#d7a84d]/25">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d7a84d]">
                {event.month}
              </span>
              <span className="font-serif text-2xl font-bold text-white">{event.day}</span>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#38bdf8]">
                {event.category}
              </p>
              <h3 className="mt-1 text-base font-bold text-white">
                {event.title}
              </h3>
              <p className="mt-1 text-xs text-white/40">
                {event.date} · {event.time} · {event.location}
              </p>
              <p className="text-xs font-semibold text-[#38bdf8]/70">
                {event.audience}
              </p>
            </div>

            <a
              href="#assistant"
              className="rounded-full border border-[#d7a84d]/30 px-4 py-2 text-center text-sm font-bold text-[#d7a84d] transition hover:bg-[#d7a84d] hover:text-[#050d1a]"
            >
              Register
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

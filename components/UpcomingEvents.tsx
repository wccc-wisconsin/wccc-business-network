import { events } from "@/data/events";

export default function UpcomingEvents() {
  return (
    <section id="events" aria-labelledby="events-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="events-heading" className="font-serif text-3xl font-bold text-[#0f1e35]">
          Upcoming Events
        </h2>
        <a className="text-sm font-bold text-[#d7a84d] hover:text-[#c4953a] transition" href="#assistant">
          View all →
        </a>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <article
            key={event.title}
            className="grid gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:shadow-md sm:grid-cols-[72px_1fr_auto] sm:items-center"
          >
            <div className="flex h-16 w-[72px] flex-col items-center justify-center rounded-lg bg-[#d7a84d]/10 border border-[#d7a84d]/25">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d7a84d]">
                {event.month}
              </span>
              <span className="font-serif text-2xl font-bold text-[#0f1e35]">{event.day}</span>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0369a1]">
                {event.category}
              </p>
              <h3 className="mt-1 text-base font-bold text-[#0f1e35]">
                {event.title}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {event.date} · {event.time} · {event.location}
              </p>
              <p className="text-xs font-semibold text-[#0369a1]">
                {event.audience}
              </p>
            </div>

            <a
              href="#assistant"
              className="rounded-full border border-[#d7a84d] px-4 py-2 text-center text-sm font-bold text-[#d7a84d] transition hover:bg-[#d7a84d] hover:text-white"
            >
              Register
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

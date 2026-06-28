import { events } from "@/data/events";

export default function UpcomingEvents() {
  return (
    <section id="events" aria-labelledby="events-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="events-heading"
          className="font-serif text-3xl font-bold text-[#07172b]"
        >
          Upcoming Events
        </h2>
        <a className="text-sm font-bold text-[#9b6b1f]" href="#assistant">
          View all events
        </a>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <article
            key={event.title}
            className="grid gap-4 rounded-[8px] border border-[#07172b]/10 bg-white p-4 shadow-sm sm:grid-cols-[72px_1fr_auto] sm:items-center"
          >
            <div className="flex h-20 w-[72px] flex-col items-center justify-center rounded-[8px] bg-[#07172b] text-white">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7a84d]">
                {event.month}
              </span>
              <span className="font-serif text-3xl font-bold">{event.day}</span>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b6b1f]">
                {event.category}
              </p>
              <h3 className="mt-1 text-lg font-bold text-[#07172b]">
                {event.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {event.date} | {event.time}
              </p>
              <p className="text-sm text-slate-600">{event.location}</p>
              <p className="mt-1 text-xs font-semibold text-[#0f766e]">
                {event.audience}
              </p>
            </div>

            <a
              href="#assistant"
              className="rounded-full border border-[#07172b]/15 px-4 py-2 text-center text-sm font-bold text-[#07172b] transition hover:border-[#d7a84d]"
            >
              Register
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

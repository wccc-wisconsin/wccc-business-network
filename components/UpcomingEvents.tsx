import { events } from "@/data/events";

export default function UpcomingEvents() {
  return (
    <section id="events" aria-labelledby="events-heading">
      <div className="mb-6 flex items-end justify-between border-b border-[#e8e3db] pb-4">
        <h2 id="events-heading" className="font-serif text-2xl font-bold text-[#0c1e3a]">
          Upcoming Events
        </h2>
        {/* Points at the dashboard, not #assistant. The dashboard is where the
            full events list with working Register buttons lives; signed-out
            visitors get redirected to /login, which is the right funnel.
            Scrolling to the AI chat panel was a dead end. */}
        <a href="/dashboard" className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#a07830] hover:text-[#0c1e3a] transition">
          View All →
        </a>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <article
            key={event.title}
            className="card grid gap-4 p-4 sm:grid-cols-[64px_1fr_auto] sm:items-center"
          >
            {/* Date badge */}
            <div className="flex h-14 w-16 flex-col items-center justify-center rounded border border-[#e8e3db]">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a07830]">{event.month}</span>
              <span className="font-serif text-2xl font-bold text-[#0c1e3a] leading-none">{event.day}</span>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#a07830]">{event.category}</p>
              <h3 className="mt-0.5 text-[15px] font-bold text-[#0c1e3a]">{event.title}</h3>
              <p className="mt-1 text-xs text-[#94a3b8]">{event.date} · {event.time} · {event.location}</p>
            </div>

            {/* Registration actually happens on the dashboard (server action
                registerForEventAction). This used to scroll to the AI chat
                panel, so clicking "Register" never registered anyone. */}
            <a
              href="/dashboard"
              className="whitespace-nowrap rounded border border-[#0c1e3a] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0c1e3a] transition hover:bg-[#0c1e3a] hover:text-white"
            >
              Register
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

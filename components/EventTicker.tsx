import { events } from "@/data/events";

export default function EventTicker() {
  const items = [...events, ...events];

  return (
    <div className="border-y border-[#d7a84d]/20 bg-[#d7a84d]/10 py-2.5 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((event, i) => (
          <span key={i} className="inline-flex items-center gap-3 mx-8 text-sm font-bold text-[#0f1e35]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d7a84d]" />
            <span className="text-slate-400 font-normal">{event.date}</span>
            <span>{event.title}</span>
            <a href="#events" className="text-[#0369a1] hover:text-[#38bdf8] transition">→</a>
          </span>
        ))}
      </div>
    </div>
  );
}

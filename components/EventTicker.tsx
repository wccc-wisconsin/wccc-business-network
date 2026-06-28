import { events } from "@/data/events";

export default function EventTicker() {
  const items = [...events, ...events];
  return (
    <div className="overflow-hidden bg-[#0c1e3a] py-3">
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((event, i) => (
          <span key={i} className="inline-flex items-center gap-4 mx-10 text-[12px] font-medium text-white/60">
            <span className="h-1 w-1 rounded-full bg-[#c9993a]" />
            <span className="font-bold uppercase tracking-[0.14em] text-[#c9993a]">{event.date}</span>
            <span className="text-white/80">{event.title}</span>
            <a href="#events" className="text-white/40 hover:text-[#c9993a] transition text-xs uppercase tracking-widest">
              Register →
            </a>
          </span>
        ))}
      </div>
    </div>
  );
}

import { events } from "@/data/events";

export default function EventTicker() {
  const items = [...events, ...events]; // duplicate for seamless loop

  return (
    <div className="border-y border-[#d7a84d]/20 bg-[#d7a84d]/[0.07] py-2.5 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((event, i) => (
          <span key={i} className="inline-flex items-center gap-3 mx-8 text-sm font-bold text-[#d7a84d]">
            <span className="h-1 w-1 rounded-full bg-[#d7a84d]/50" />
            <span className="text-white/40">{event.date}</span>
            <span>{event.title}</span>
            <a href="#events" className="text-[#38bdf8] hover:text-white transition">
              →
            </a>
          </span>
        ))}
      </div>
    </div>
  );
}

import { events } from "@/data/events";

export default function EventTicker() {
  const items = [...events, ...events]; // duplicate for seamless loop

  return (
    <div className="bg-[#d7a84d] py-2 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((event, i) => (
          <span key={i} className="inline-flex items-center gap-3 mx-8 text-sm font-bold text-[#07172b]">
            <span className="opacity-60">{event.date}</span>
            <span>{event.title}</span>
            <a href="#events" className="underline underline-offset-2 hover:opacity-70 transition">
              Read More
            </a>
            <span className="opacity-30 mx-2">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}

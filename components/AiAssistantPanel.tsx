import { recommendations } from "@/data/programs";
import { journeyMetrics } from "@/data/stats";

const quickPrompts = [
  "Find grants for my business",
  "Show upcoming events for me",
  "How do I start a business?",
  "Help me get contract ready",
];

export default function AiAssistantPanel() {
  return (
    <section
      id="assistant"
      className="bg-[#07172b] px-6 py-12"
      aria-labelledby="assistant-heading"
    >
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[8px] border border-[#d7a84d]/35 bg-[#0b2544] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d7a84d]">
            WCCC AI Assistant
          </p>
          <h2
            id="assistant-heading"
            className="mt-3 font-serif text-4xl font-bold text-white"
          >
            How can WCCC help you today?
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
            Ask for program suggestions, event matches, funding resources, or a
            next-step checklist based on where your business is right now.
          </p>

          <form className="mt-6 flex rounded-full border border-white/15 bg-white/5 p-2">
            <input
              aria-label="Ask the WCCC assistant"
              className="min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/45"
              placeholder="Ask anything..."
            />
            <button
              type="submit"
              className="rounded-full bg-[#d7a84d] px-5 py-3 text-sm font-bold text-[#07172b] transition hover:bg-[#f1c864]"
            >
              Send
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/75 transition hover:border-[#d7a84d] hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[8px] border border-[#d7a84d]/35 bg-[#0b2544] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-white">
              Journey Summary
            </h2>
            <span className="rounded-full bg-[#4b2e83] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white">
              Know Your Business
            </span>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm text-white/75">
              <span>Progress</span>
              <span>82%</span>
            </div>
            <div className="h-2 rounded-full bg-white/15">
              <div className="h-2 w-[82%] rounded-full bg-[#d7a84d]" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {journeyMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[8px] border border-white/10 bg-white/5 p-4 text-center"
              >
                <div className="text-2xl font-bold text-[#d7a84d]">
                  {metric.value}
                </div>
                <div className="mt-1 text-xs text-white/68">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[8px] border border-[#d7a84d]/35 bg-[#0b2544] p-6 lg:col-span-2">
          <h2 className="font-serif text-2xl font-bold text-white">
            Recommended for You
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {recommendations.map((item) => (
              <article
                key={item.title}
                className="rounded-[8px] border border-white/10 bg-white/5 p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7a84d]">
                  {item.label}
                </p>
                <h3 className="mt-3 text-base font-bold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/68">
                  {item.subtitle}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

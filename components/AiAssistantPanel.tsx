"use client";
import { useState } from "react";

const suggestions = [
  "What programs can I apply for?",
  "How do I become a member?",
  "Tell me about networking events",
  "What mentorship is available?",
];

export default function AiAssistantPanel() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAsk(q: string) {
    const text = q || query;
    if (!text.trim()) return;
    setLoading(true);
    setAnswer("");
    await new Promise((r) => setTimeout(r, 900));
    setAnswer(
      `Thank you for your inquiry about "${text}". WCCC offers a wide range of programs and resources for Wisconsin small businesses. We recommend contacting our member services team or exploring the Programs section for tailored guidance.`
    );
    setLoading(false);
  }

  return (
    <section id="assistant" className="bg-[#faf8f5] px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-[#a07830] mb-3">Member Services</p>
          <h2 className="font-serif text-4xl font-bold text-[#0c1e3a]">Ask Our Advisor</h2>
          <p className="mt-3 text-sm text-[#64748b]">
            Instant guidance on programs, membership, and opportunities.
          </p>
        </div>

        <div className="rounded-lg border border-[#e8e3db] bg-white p-6 shadow-sm">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk("")}
              placeholder="e.g. What funding programs are available for my restaurant?"
              className="flex-1 rounded border border-[#e8e3db] bg-[#faf8f5] px-4 py-3 text-sm text-[#0c1e3a] placeholder-[#94a3b8] outline-none focus:border-[#a07830] focus:ring-1 focus:ring-[#a07830]/20 transition"
            />
            <button
              onClick={() => handleAsk("")}
              disabled={loading}
              className="btn-navy disabled:opacity-50"
            >
              {loading ? "…" : "Ask"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); handleAsk(s); }}
                className="rounded border border-[#e8e3db] bg-[#faf8f5] px-3 py-1.5 text-[11px] font-medium text-[#64748b] transition hover:border-[#a07830] hover:text-[#a07830]"
              >
                {s}
              </button>
            ))}
          </div>

          {(loading || answer) && (
            <div className="mt-5 rounded border border-[#e8e3db] bg-[#faf8f5] p-4">
              {loading ? (
                <div className="flex gap-1.5 py-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-[#a07830] animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-[#64748b]">{answer}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

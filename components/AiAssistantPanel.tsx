"use client";
import { useState } from "react";

const suggestions = [
  "What business programs can I apply for?",
  "How do I become a WCCC member?",
  "Tell me about upcoming networking events",
  "What mentorship opportunities are available?",
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
      `Thank you for asking about "${text}". Our team and programs are designed to help Wisconsin small businesses thrive. Please reach out to our member services team or explore the Programs section for detailed information.`
    );
    setLoading(false);
  }

  return (
    <section id="assistant" className="relative bg-[#050d1a] px-6 py-20">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#38bdf8]/6 blur-[120px]" />

      <div className="relative mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#38bdf8] mb-3">AI-Powered</p>
          <h2 className="font-serif text-4xl font-bold text-white sm:text-5xl">
            Ask <span className="text-gradient-cyan">WCCC Assistant</span>
          </h2>
          <p className="mt-3 text-white/50">Get instant answers about programs, events, and membership.</p>
        </div>

        <div className="glass-cyan rounded-2xl p-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk("")}
              placeholder="Ask anything about WCCC programs…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#38bdf8]/40 focus:ring-1 focus:ring-[#38bdf8]/20 transition"
            />
            <button
              onClick={() => handleAsk("")}
              disabled={loading}
              className="rounded-xl bg-[#38bdf8] px-5 py-3 text-sm font-bold text-[#050d1a] transition hover:bg-[#7dd3fc] disabled:opacity-50 glow-cyan"
            >
              {loading ? "…" : "Ask"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); handleAsk(s); }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50 transition hover:border-[#38bdf8]/40 hover:text-[#38bdf8]"
              >
                {s}
              </button>
            ))}
          </div>

          {(loading || answer) && (
            <div className="mt-6 rounded-xl border border-[#38bdf8]/10 bg-[#38bdf8]/[0.04] p-4">
              {loading ? (
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-2 w-2 rounded-full bg-[#38bdf8] opacity-50 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-white/70">{answer}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

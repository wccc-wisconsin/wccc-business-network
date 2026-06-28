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
    <section id="assistant" className="bg-[#f8fafc] px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#38bdf8] mb-3">AI-Powered</p>
          <h2 className="font-serif text-4xl font-bold text-[#0f1e35] sm:text-5xl">
            Ask <span className="text-gradient-cyan">WCCC Assistant</span>
          </h2>
          <p className="mt-3 text-slate-500">Get instant answers about programs, events, and membership.</p>
        </div>

        <div className="rounded-2xl border border-[#38bdf8]/20 bg-white p-6 shadow-sm">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk("")}
              placeholder="Ask anything about WCCC programs…"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#0f1e35] placeholder-slate-400 outline-none focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]/30 transition"
            />
            <button
              onClick={() => handleAsk("")}
              disabled={loading}
              className="rounded-xl bg-[#38bdf8] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0ea5e9] disabled:opacity-50"
            >
              {loading ? "…" : "Ask"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); handleAsk(s); }}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 transition hover:border-[#38bdf8]/40 hover:text-[#0369a1]"
              >
                {s}
              </button>
            ))}
          </div>

          {(loading || answer) && (
            <div className="mt-6 rounded-xl border border-[#38bdf8]/15 bg-[#38bdf8]/5 p-4">
              {loading ? (
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-2 w-2 rounded-full bg-[#38bdf8] animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-slate-600">{answer}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

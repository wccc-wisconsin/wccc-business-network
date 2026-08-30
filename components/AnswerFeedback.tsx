"use client";

import { useState } from "react";
import type { AiFeedbackRating, AiFeedbackRoute } from "@/lib/appStore";

type Props = {
  route: AiFeedbackRoute;
  /**
   * What is being rated, stable for as long as it is on screen.
   *
   * Built by the caller because only the caller knows what identifies one of
   * its answers — see the note on `target_key` in supabase-schema.sql. The
   * server upserts on it, so the same key sent twice is a change of mind
   * rather than a second vote.
   */
  targetKey: string;
  /** Sits inside a dark panel by default; the step review is on a lighter one. */
  tone?: "dark" | "light";
};

/**
 * "Was this useful?" under one AI answer.
 *
 * Optimistic and quiet on purpose. The tap registers in the UI immediately and
 * stays registered even if the write fails, because the alternative is a
 * member who did us a favour being shown an error about it. The rating is not
 * load-bearing for anything the member is doing; nothing they can see depends
 * on it having been stored.
 *
 * There is no "tell us more" box. A note column exists and the route accepts
 * one, but a second step in front of a one-tap action costs more ratings than
 * the notes would be worth — worth revisiting once there is a month of counts
 * to look at, and not before.
 */
export default function AnswerFeedback({ route, targetKey, tone = "dark" }: Props) {
  const [chosen, setChosen] = useState<AiFeedbackRating | null>(null);

  async function send(rating: AiFeedbackRating) {
    // Set before the request and never rolled back. See the note above.
    setChosen(rating);

    try {
      await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, targetKey, rating }),
      });
    } catch {
      // Swallowed deliberately. A failed rating is not the member's problem,
      // and there is nothing for them to retry.
    }
  }

  const muted = tone === "dark" ? "text-white/40" : "text-white/50";
  const idle =
    tone === "dark"
      ? "border-white/15 text-white/50 hover:border-white/30 hover:text-white/80"
      : "border-white/20 text-white/60 hover:border-white/40 hover:text-white/90";
  const picked = "border-[#d7a84d]/60 text-[#d7a84d]";

  if (chosen) {
    return (
      <p className={`mt-2 text-[11px] ${muted}`}>
        {chosen === "helpful"
          ? "Thanks — noted."
          : "Thanks — noted. That helps us make this better."}
      </p>
    );
  }

  return (
    <div className={`mt-2 flex items-center gap-2 text-[11px] ${muted}`}>
      <span>Was this useful?</span>
      <button
        type="button"
        onClick={() => send("helpful")}
        aria-label="This answer was useful"
        className={`rounded border px-2 py-0.5 transition ${idle} ${
          chosen === "helpful" ? picked : ""
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => send("not-helpful")}
        aria-label="This answer was not useful"
        className={`rounded border px-2 py-0.5 transition ${idle}`}
      >
        No
      </button>
    </div>
  );
}

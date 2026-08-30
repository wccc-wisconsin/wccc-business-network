import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  AI_FEEDBACK_NOTE_CHARS,
  AI_FEEDBACK_RATINGS,
  AI_FEEDBACK_ROUTES,
  saveAiFeedback,
  type AiFeedbackRating,
  type AiFeedbackRoute,
} from "@/lib/appStore";
import { MODEL } from "@/lib/ai";

// "Was this useful?" — the two buttons under a Coach reply, a decision brief
// and a step review.
//
// Deliberately not an AI route despite living under /api/ai. It calls no model
// and costs nothing, so it is exempt from the rate limiter: a member tapping
// thumbs-down twice must not spend a unit of the budget that lets them ask
// another question. What it shares with its neighbours is the subject — this
// is the only place that records whether any of them were any good.
//
// Everything about it fails soft. A rating is a favour the member is doing us,
// and the worst outcome is not a lost row, it is a member interrupted by an
// error message for having tried to help.

/** Longest target key accepted. The longest real one is well under this. */
const MAX_TARGET_KEY_CHARS = 200;

function isRating(value: unknown): value is AiFeedbackRating {
  return typeof value === "string" && (AI_FEEDBACK_RATINGS as readonly string[]).includes(value);
}

function isRoute(value: unknown): value is AiFeedbackRoute {
  return typeof value === "string" && (AI_FEEDBACK_ROUTES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const { route, targetKey, rating, note } = (body ?? {}) as Record<string, unknown>;

  // Validated against the same lists the column's check constraint uses, and
  // rejected rather than coerced. A rating this route does not recognise is a
  // client bug; storing it as "helpful" would hide that bug inside the data the
  // whole table exists to produce.
  if (!isRoute(route) || !isRating(rating)) {
    return NextResponse.json({ ok: false, error: "Unrecognised feedback." }, { status: 400 });
  }

  if (
    typeof targetKey !== "string" ||
    !targetKey.trim() ||
    targetKey.length > MAX_TARGET_KEY_CHARS
  ) {
    return NextResponse.json({ ok: false, error: "Unrecognised feedback." }, { status: 400 });
  }

  // A note is optional and free text. Anything that is not a string is treated
  // as absent rather than rejected — the rating is the part worth keeping, and
  // losing it over a malformed optional field would be the wrong trade.
  const trimmedNote =
    typeof note === "string" && note.trim() ? note.trim().slice(0, AI_FEEDBACK_NOTE_CHARS) : null;

  // The model is stamped server-side. The client neither knows it nor should:
  // it is a fact about what answered, not about what the member thought.
  const saved = await saveAiFeedback(userId, route, targetKey.trim(), rating, trimmedNote, MODEL);

  // 200 either way. The member has already seen their tap register in the UI,
  // and there is nothing useful for them to do about a database that is down.
  // `saved` is there for the client to decide whether to keep its optimistic
  // state, and for anyone reading logs to tell the two cases apart.
  return NextResponse.json({ ok: true, saved });
}

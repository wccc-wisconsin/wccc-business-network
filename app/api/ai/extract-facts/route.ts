import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceAiRateLimit, recordSpend } from "@/lib/aiRateLimit";
import { getMemberById, type ChatTurn } from "@/lib/appStore";
import { extractionPrompt, validateCandidates } from "@/lib/factExtraction";
import { callClaude, parseClaudeJson } from "@/lib/ai";

// "Save what we discussed" — reads a finished Coach conversation and returns
// candidate profile facts for the member to confirm.
//
// It returns proposals. It writes nothing. The write happens in
// saveExtractedFactsAction (app/actions.ts) and only for candidates the member
// has tapped, which is what keeps `confirmedAt` meaning that a person confirmed
// it. See the header of lib/factExtraction.ts for why that property is worth
// this much care.

/**
 * Bounded well below the Coach's own transcript cap. Extraction reads the whole
 * conversation in one call, and a very long chat is exactly where a model
 * starts proposing things from the middle that the member has since corrected.
 */
const MAX_TURNS = 40;
const MAX_TURN_CHARS = 4000;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  const { limited, usageId } = await enforceAiRateLimit(userId, "extract-facts");
  if (limited) return limited;

  const member = await getMemberById(userId);
  if (!member) {
    return NextResponse.json({ ok: false, error: "Member profile not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.messages)) {
    return NextResponse.json({ ok: false, error: "Nothing to read." }, { status: 400 });
  }

  const transcript: ChatTurn[] = body.messages
    .slice(-MAX_TURNS)
    .filter(
      (turn: unknown): turn is ChatTurn =>
        !!turn &&
        typeof turn === "object" &&
        ((turn as ChatTurn).role === "user" || (turn as ChatTurn).role === "assistant") &&
        typeof (turn as ChatTurn).content === "string",
    )
    .map((turn: ChatTurn) => ({ role: turn.role, content: turn.content.slice(0, MAX_TURN_CHARS) }));

  // Nothing the member said means nothing they could have stated about
  // themselves — no reason to spend a call finding that out.
  if (!transcript.some((turn) => turn.role === "user")) {
    return NextResponse.json({ ok: true, candidates: [] });
  }

  const conversation = transcript
    .map((turn) => `${turn.role === "user" ? "MEMBER" : "COACH"}: ${turn.content}`)
    .join("\n\n");

  const result = await callClaude(
    extractionPrompt(),
    [{ role: "user", content: conversation }],
    600,
    "extract-facts",
  );

  await recordSpend(usageId, result.ok ? result.usage : undefined);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  // A response that isn't the JSON array asked for yields no candidates rather
  // than an error. There is nothing for the member to act on either way, and
  // "nothing found" is a true and unalarming thing to tell them.
  const parsed = parseClaudeJson<unknown>(result.text);
  const candidates = validateCandidates(parsed, transcript, new Date());

  return NextResponse.json({ ok: true, candidates });
}

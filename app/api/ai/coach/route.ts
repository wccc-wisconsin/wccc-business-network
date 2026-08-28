import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceAiRateLimit, recordSpend } from "@/lib/aiRateLimit";
import { findModule } from "@/data/modules";
import { buildMemberContext } from "@/lib/memberContext";
import { callClaude, type ChatMessage } from "@/lib/ai";

// Freeform AI Coach chat. Runs on module pages (where it's told which module
// the member is looking at) and on the dashboard (where it isn't), so
// moduleKey is optional — the member's full context comes from
// buildMemberContext either way, which is what stops this being a generic
// chatbot regardless of where it's mounted.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  // Per-member daily cap. See lib/aiRateLimit.ts — every request past
  // this point spends money.
  const { limited, usageId } = await enforceAiRateLimit(userId, "coach");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const moduleKey = typeof body?.moduleKey === "string" ? body.moduleKey : null;
  const messages = body?.messages;
  if (!Array.isArray(messages)) {
    return NextResponse.json({ ok: false, error: "Missing messages." }, { status: 400 });
  }

  // A module key is optional, but if one is supplied it has to be real —
  // otherwise the prompt would claim the member is looking at something that
  // doesn't exist.
  if (moduleKey && !findModule(moduleKey)) {
    return NextResponse.json({ ok: false, error: "That module couldn't be found." }, { status: 404 });
  }

  // Keep the request bounded — cap history and message length rather than
  // trusting the client.
  const safeMessages: ChatMessage[] = messages
    .slice(-20)
    .filter(
      (m): m is ChatMessage =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (safeMessages.length === 0 || safeMessages[safeMessages.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "No question to answer." }, { status: 400 });
  }

  const context = await buildMemberContext(userId, moduleKey);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Member profile not found." }, { status: 404 });
  }

  const systemPrompt = `You are the WCCC AI Business Coach, a feature of the Wisconsin Chinese Chamber of Commerce member portal's AI Business Builder.

${context.summary}

${context.references}

Be concise, practical, and specific to their situation — no generic encouragement or filler. Keep replies to a few short paragraphs at most.`;
  // The paragraph this replaced asked the model to "reference real Wisconsin
  // resources (WI DFI, Wisconsin SBDC, WEDC, SCORE, WCCC programs)" and to
  // describe a type of resource when unsure a program was active. Both are now
  // in context.references, where they are backed by a list rather than by the
  // model's recall — and the old wording actively invited naming programs from
  // memory, which is the thing the reference block exists to stop.

  // Marked cacheable: every turn of one chat re-sends this exact prompt, and
  // for a member with a filled-in profile it runs to a couple of thousand
  // tokens. `stable` with no `volatile` because nothing in it varies turn to
  // turn — the conversation itself travels in `messages`, after the prompt.
  const result = await callClaude({ stable: systemPrompt }, safeMessages, 500, "coach");

  // Files what this call cost against the attempt the limiter recorded. A
  // failed call has no usage to report, so its row stays null — which is how a
  // call that never came back is told apart from one that cost nothing.
  await recordSpend(usageId, result.ok ? result.usage : undefined);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, reply: result.text });
}

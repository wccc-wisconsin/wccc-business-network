import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getMemberById, getModuleProgress } from "@/lib/appStore";
import { findModule, stepsForModule } from "@/data/modules";
import { callClaude, type ChatMessage } from "@/lib/ai";

// Freeform AI Coach chat at the bottom of each module page. Aware of the
// member's industry/business, and their progress within the current
// module, per the shared template — not a generic chatbot.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  const member = await getMemberById(userId);
  if (!member) {
    return NextResponse.json({ ok: false, error: "Member profile not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const moduleKey = typeof body?.moduleKey === "string" ? body.moduleKey : null;
  const messages = body?.messages;
  if (!moduleKey || !Array.isArray(messages)) {
    return NextResponse.json({ ok: false, error: "Missing moduleKey or messages." }, { status: 400 });
  }

  const found = findModule(moduleKey);
  if (!found) {
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

  const progress = await getModuleProgress(userId, moduleKey);
  const steps = stepsForModule(found.module);
  const completedCount = steps.filter((s) => progress[s.key]?.completed).length;

  const systemPrompt = `You are the WCCC AI Business Coach, a feature of the Wisconsin Chinese Chamber of Commerce member portal's AI Business Builder. You're helping ${member.name || "a member"}, who runs ${member.businessName || "a small business"} (industry: ${member.industry || "not specified"}) in ${member.city || "Wisconsin"}. They are currently on the "${found.module.label}" engine (${found.module.tagline}) and have completed ${completedCount} of ${steps.length} steps in it. Be concise, practical, and specific to their situation — no generic encouragement or filler. Where relevant, reference real Wisconsin resources (WI DFI, Wisconsin SBDC, WEDC, SCORE, WCCC programs) instead of vague suggestions. Keep replies to a few short paragraphs at most.`;

  const result = await callClaude(systemPrompt, safeMessages, 500);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, reply: result.text });
}

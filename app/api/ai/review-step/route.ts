import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getMemberById } from "@/lib/appStore";
import { findStep } from "@/data/modules";
import { callClaude, parseClaudeJson } from "@/lib/ai";

type ReviewJson = {
  strongestPoint: string;
  gap: string;
  wisconsinTip: string;
};

// "Review my answers" — reads what the member wrote for one guided step and
// returns exactly: strongest point, one gap, one Wisconsin tip. Deliberately
// narrow (see the shared template in the 7-module spec) rather than a
// general chat reply, so it stays concise and actionable instead of reading
// like marketing copy.
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
  const stepKey = typeof body?.stepKey === "string" ? body.stepKey : null;
  const answers = body?.answers;
  if (!moduleKey || !stepKey || typeof answers !== "object" || answers === null) {
    return NextResponse.json({ ok: false, error: "Missing moduleKey, stepKey, or answers." }, { status: 400 });
  }

  const found = findStep(moduleKey, stepKey);
  if (!found) {
    return NextResponse.json({ ok: false, error: "That step couldn't be found." }, { status: 404 });
  }

  const answerLines = found.step.questions
    .map((q) => `Q: ${q.label}\nA: ${(answers as Record<string, string>)[q.key]?.trim() || "(left blank)"}`)
    .join("\n\n");

  const systemPrompt = `You are reviewing one step of a Wisconsin small-business owner's AI Business Builder workbook, part of the Wisconsin Chinese Chamber of Commerce (WCCC) member portal. Respond with concise, specific, practical feedback only — no marketing language, no generic encouragement, no restating the question. Return ONLY a strict JSON object with exactly these keys: "strongestPoint" (one sentence naming what's genuinely strong or clear about their answers), "gap" (one sentence naming the single biggest gap, risk, or missing detail), "wisconsinTip" (one concise, concrete, actionable tip specific to running a small business in Wisconsin — reference a real resource where relevant, e.g. WI DFI, Wisconsin SBDC, WEDC, or a WCCC program). No text outside the JSON object.`;

  const userPrompt = `Module: ${found.module.label} (${found.module.tagline})
Step: ${found.step.title}
Member's business: ${member.businessName || "(not provided)"} — industry: ${member.industry || "(not provided)"}, city: ${member.city || "(not provided)"}, WI

${answerLines}`;

  const result = await callClaude(systemPrompt, [{ role: "user", content: userPrompt }], 400);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const parsed = parseClaudeJson<ReviewJson>(result.text);
  if (!parsed || !parsed.strongestPoint || !parsed.gap || !parsed.wisconsinTip) {
    // Fall back to showing the raw text rather than failing outright —
    // the model still produced something useful, just not clean JSON.
    return NextResponse.json({ ok: true, raw: result.text });
  }

  return NextResponse.json({ ok: true, review: parsed });
}

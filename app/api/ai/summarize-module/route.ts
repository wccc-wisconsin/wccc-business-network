import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getMemberById, getModuleProgress, saveModuleSummary } from "@/lib/appStore";
import { findModule, stepsForModule } from "@/data/modules";
import { callClaude } from "@/lib/ai";

// "Save summary" — turns everything a member has written across a module's
// steps into one short saved artifact (e.g. Launch -> a Business Idea
// Summary). Regenerating overwrites the previous saved summary for that
// module (see module_summaries in supabase-schema.sql).
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
  if (!moduleKey) {
    return NextResponse.json({ ok: false, error: "Missing moduleKey." }, { status: 400 });
  }

  const found = findModule(moduleKey);
  if (!found) {
    return NextResponse.json({ ok: false, error: "That module couldn't be found." }, { status: 404 });
  }

  const steps = stepsForModule(found.module);
  const progress = await getModuleProgress(userId, moduleKey);

  const answeredSteps = steps.filter((s) => {
    const answers = progress[s.key]?.answers ?? {};
    return Object.values(answers).some((v) => v?.trim());
  });

  if (answeredSteps.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Answer at least one step before generating a summary." },
      { status: 400 },
    );
  }

  const stepsText = answeredSteps
    .map((s) => {
      const answers = progress[s.key]?.answers ?? {};
      const qa = s.questions
        .map((q) => `${q.label}\n${answers[q.key]?.trim() || "(left blank)"}`)
        .join("\n");
      return `## ${s.title}\n${qa}`;
    })
    .join("\n\n");

  const summaryTitle =
    found.module.key === "launch" ? "Business Idea Summary" : `${found.module.label} Summary`;

  const systemPrompt = `You write short, concrete summary documents for Wisconsin small-business owners working through the WCCC AI Business Builder. Given a member's guided-question answers for the "${found.module.label}" engine, write a "${summaryTitle}" of 150-250 words in plain prose (no headers, no bullet lists) that synthesizes what they've told you into a clear, useful snapshot of their business at this stage. Be concrete and specific to what they actually wrote — do not invent details, and do not add generic encouragement or marketing language. If key information is missing, note it plainly in one sentence at the end.`;

  const result = await callClaude(systemPrompt, [{ role: "user", content: stepsText }], 500);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const saveResult = await saveModuleSummary(userId, moduleKey, summaryTitle, result.text);
  if (!saveResult.ok) {
    // Still return the generated text so the member sees it even if saving failed.
    return NextResponse.json({
      ok: true,
      summary: { title: summaryTitle, content: result.text, updatedAt: new Date().toISOString() },
      saved: false,
    });
  }

  return NextResponse.json({
    ok: true,
    summary: { title: summaryTitle, content: result.text, updatedAt: new Date().toISOString() },
    saved: true,
  });
}

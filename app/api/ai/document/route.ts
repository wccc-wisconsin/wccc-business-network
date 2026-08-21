import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceAiRateLimit } from "@/lib/aiRateLimit";
import {
  getModuleProgress,
  saveMemberDocument,
} from "@/lib/appStore";
import { buildMemberContext } from "@/lib/memberContext";
import { findTool, stepsForModule } from "@/data/modules";
import { callClaude } from "@/lib/ai";

// Module toolkit — generates one real document for the member's own business
// from a module's tool (see `tools` on BusinessModule in data/modules.ts).
//
// The point of this over a generic AI prompt is the input: the member's saved
// guided-step answers for the module are fed in alongside their profile, so a
// "90-day marketing plan" is written around the channels and customers they
// actually described rather than being a template they'd have to adapt.

/**
 * Bounded so generation reliably finishes inside the serverless function
 * timeout. The briefs in data/modules.ts all cap their output well below this;
 * this is the backstop, not the target.
 */
const MAX_DOCUMENT_TOKENS = 1400;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  // Per-member daily cap. Was a bespoke check that counted rows in
  // member_documents; that was bypassable (deleting a document freed quota)
  // and blind to generations that failed before saving. Now shares the
  // attempt-based limiter with every other AI route — see lib/aiRateLimit.ts,
  // where "document" keeps the same ceiling of 20 it had here.
  const limited = await enforceAiRateLimit(userId, "document");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const moduleKey = typeof body?.moduleKey === "string" ? body.moduleKey : null;
  const toolKey = typeof body?.toolKey === "string" ? body.toolKey : null;
  if (!moduleKey || !toolKey) {
    return NextResponse.json({ ok: false, error: "Missing moduleKey or toolKey." }, { status: 400 });
  }

  // Resolved from data/modules.ts, never from the request. The brief becomes
  // part of the system prompt, so accepting one off the wire would hand any
  // signed-in member arbitrary control of the prompt.
  const found = findTool(moduleKey, toolKey);
  if (!found) {
    return NextResponse.json({ ok: false, error: "That tool couldn't be found." }, { status: 404 });
  }

  const [context, progress] = await Promise.all([
    buildMemberContext(userId, moduleKey),
    getModuleProgress(userId, moduleKey),
  ]);

  if (!context) {
    return NextResponse.json({ ok: false, error: "Member profile not found." }, { status: 404 });
  }

  // Only steps the member actually wrote something in. A document generated
  // from nothing is a generic template with their name on it, which is worse
  // than telling them to fill the steps in first.
  const steps = stepsForModule(found.module);
  const answeredSteps = steps.filter((step) => {
    const answers = progress[step.key]?.answers ?? {};
    return Object.values(answers).some((v) => v?.trim());
  });

  if (answeredSteps.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Answer at least one guided step in this module first — that's what makes this document about your business rather than a blank template.",
      },
      { status: 400 },
    );
  }

  const answersText = answeredSteps
    .map((step) => {
      const answers = progress[step.key]?.answers ?? {};
      const qa = step.questions
        .map((q) => `${q.label}\n${answers[q.key]?.trim() || "(left blank)"}`)
        .join("\n");
      return `## ${step.title}\n${qa}`;
    })
    .join("\n\n");

  const systemPrompt = `You write practical documents for Wisconsin small-business owners, for the Wisconsin Chinese Chamber of Commerce member portal. You are producing: "${found.tool.title}".

${context.summary}

${found.tool.brief}

Rules that override anything above:
- Use only what the member actually told you. Never invent figures, customer names, testimonials, credentials, or track record.
- Where something needed is missing from their answers, say so in one short line rather than filling the gap with a plausible guess.
- Plain language a busy owner reads once. No preamble, no restating the task, no closing encouragement.
- Reference real Wisconsin resources (WI DFI, WEDC, Wisconsin SBDC, SCORE, WWBIC) only where you are confident they exist and are current; otherwise describe the type of organisation to look for.
- You are not their attorney, accountant, or financial adviser. Where something genuinely needs one, name that instead of advising it yourself.
- Output the document itself and nothing else.`;

  const result = await callClaude(
    systemPrompt,
    [{ role: "user", content: answersText }],
    MAX_DOCUMENT_TOKENS,
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const saved = await saveMemberDocument(
    userId,
    moduleKey,
    toolKey,
    found.tool.title,
    result.text,
  );

  // Return the document either way — a failed save (most likely the table not
  // being migrated yet) shouldn't cost the member the work they just waited for.
  return NextResponse.json({
    ok: true,
    document: {
      title: found.tool.title,
      content: result.text,
      createdAt: new Date().toISOString(),
    },
    saved: saved.ok,
  });
}

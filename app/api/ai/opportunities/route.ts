import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getMemberById, saveMemberOpportunities, type Opportunity } from "@/lib/appStore";
import { callClaude, parseClaudeJson } from "@/lib/ai";

// "Find funding & programs" — generates a short, personalized list of grants,
// loans, certifications, and WCCC/WEDC/SBA programs for one member, based on
// their industry, city, and membership stage. Deliberately excludes
// contracts/RFPs — that's already the 7-step roadmap's "Opportunity" module
// (win contracts), so this stays scoped to funding/support rather than
// duplicating it. Regenerating overwrites the previous saved set (see
// member_opportunities in supabase-schema.sql).
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  const member = await getMemberById(userId);
  if (!member) {
    return NextResponse.json({ ok: false, error: "Member profile not found." }, { status: 404 });
  }

  if (!member.industry) {
    return NextResponse.json(
      { ok: false, error: "Add your industry and city in onboarding before finding matches." },
      { status: 400 },
    );
  }

  const tierLabel: Record<string, string> = {
    network: "Network (free)",
    individual: "Individual",
    business: "Business",
    corporate: "Corporate",
  };

  const systemPrompt = `You help small-business owners find concrete funding and support opportunities, for the Wisconsin Chinese Chamber of Commerce (WCCC) member portal. Given one member's profile, return exactly 5 realistic, specific opportunities they could actually pursue right now — a mix of grants, loans/capital access, certifications (e.g. minority/women-owned business certification), and relevant support programs. Do NOT include government or corporate contracts/RFPs — contract-readiness is covered elsewhere in this portal (the roadmap's "Opportunity" stage), so stay focused on funding and support instead. Prefer real, named Wisconsin/federal resources where you are confident they exist and are current (e.g. WEDC, U.S. SBA, Wisconsin DFI, WWBIC, WCCC's own programs like Ignite Academy, Access to Capital, Office Hours) — but if you are not confident a specific named program is currently active, describe the general type of opportunity and where to look rather than inventing a fake name. Do not repeat the same opportunity twice. Do not add generic encouragement.

Return ONLY a strict JSON array of exactly 5 objects, each with exactly these keys (all strings): "title" (short name of the opportunity), "type" (one of: Grant, Loan, Certification, Program, Advising), "description" (1-2 sentences on what it is), "whyItFits" (1 sentence on why it fits this specific member's industry/city/stage), "nextStep" (1 concrete, actionable next step, e.g. where to apply or who to contact). No text outside the JSON array.`;

  const userPrompt = `Member business: ${member.businessName || "(not provided)"}
Industry: ${member.industry}
City: ${member.city || "(not provided)"}, WI
Membership tier: ${tierLabel[member.membershipTier] ?? member.membershipTier}
Journey: ${member.journey === "personal" ? "Personal growth" : member.journey === "both" ? "Business + personal growth" : "Business growth"}`;

  const result = await callClaude(systemPrompt, [{ role: "user", content: userPrompt }], 900);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const parsed = parseClaudeJson<unknown>(result.text);
  const items = isValidOpportunityList(parsed) ? parsed : null;

  if (!items) {
    return NextResponse.json(
      { ok: false, error: "Couldn't generate opportunities in the right format. Please try again." },
      { status: 502 },
    );
  }

  const saveResult = await saveMemberOpportunities(userId, items);
  const generatedAt = new Date().toISOString();

  // Still return the generated list even if saving failed, so the member
  // sees it — it just won't persist across a page reload until saving works.
  return NextResponse.json({
    ok: true,
    opportunities: { items, generatedAt },
    saved: saveResult.ok,
  });
}

function isValidOpportunityList(value: unknown): value is Opportunity[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).title === "string" &&
      typeof (item as Record<string, unknown>).type === "string" &&
      typeof (item as Record<string, unknown>).description === "string" &&
      typeof (item as Record<string, unknown>).whyItFits === "string" &&
      typeof (item as Record<string, unknown>).nextStep === "string",
  );
}

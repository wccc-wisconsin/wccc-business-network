import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceAiRateLimit, recordSpend } from "@/lib/aiRateLimit";
import { getMemberById, saveMemberOpportunities, type Opportunity } from "@/lib/appStore";
import { callClaude, parseClaudeJson } from "@/lib/ai";
import { buildCatalog, formatCatalogForPrompt, type CatalogEntry } from "@/lib/opportunityCatalog";

// "Find funding & programs" — a short, personalized list of grants, loans,
// certifications and support programs for one member.
//
// This route used to ask Claude to name five opportunities from memory. It no
// longer does, and the difference is the point of the whole file:
//
//   before — the model produced the opportunities. Whatever it returned was
//            what the member saw. A program that closed last year and a
//            program that never existed were indistinguishable from a real
//            one, and the only defence was a prompt asking it not to invent.
//
//   after  — lib/opportunityCatalog.ts assembles a list from a live Grants.gov
//            query and the human-verified Wisconsin entries, and the model
//            *selects* from it by reference. Title, type, description, deadline
//            and link are read back out of the catalog server-side; the model
//            contributes only "why it fits" and "next step", which are the two
//            things it is actually good at and the two things that cannot be
//            wrong about the world.
//
// So the guarantee is structural rather than rhetorical: an opportunity that
// isn't in the catalog cannot be returned, because there is nothing for its
// reference to resolve to.
//
// Still deliberately excludes contracts/RFPs — that's the 7-step roadmap's
// "Opportunity" module (win contracts), so this stays scoped to funding and
// support rather than duplicating it. Regenerating overwrites the previous
// saved set (see member_opportunities in supabase-schema.sql).

/**
 * This route is the only one that makes an outbound HTTP call before calling
 * Claude, so it is the only one that can plausibly exceed the platform's
 * default function timeout (10s on Vercel Hobby, 15s on Pro). lib/grantsGov.ts
 * caps its own share at 9 seconds; this leaves the rest of the window for the
 * model rather than letting a slow Grants.gov turn into a platform timeout
 * page, which would bypass every error message written below.
 *
 * 60 is the Hobby ceiling, so this is safe on either plan. It is a ceiling and
 * not a target — a normal request finishes in a few seconds.
 */
export const maxDuration = 60;

/** Matches the panel's `typeStyles` keys — anything else renders unstyled. */
const ALLOWED_TYPES = new Set(["Grant", "Loan", "Certification", "Program", "Advising"]);

const MAX_RESULTS = 5;

/**
 * The stable half of the system prompt, marked cacheable in lib/ai.ts.
 *
 * Everything that varies — the member, the catalog — goes in the user message
 * instead. That split is what makes caching worth anything here: this text is
 * identical for every member and every generation, so it is written to the
 * cache once and read at roughly a tenth of the input price thereafter. Moving
 * any of it into the per-request half would silently undo that.
 */
const SELECTION_RULES = `You help small-business owners in Wisconsin choose which funding and support opportunities to pursue, for the Wisconsin Chinese Chamber of Commerce (WCCC) member portal.

You will be given one member's profile and a numbered catalog of real opportunities. Every catalog entry has been either retrieved live from Grants.gov or verified by a person at WCCC.

Your job is SELECTION, not recall. Choose the entries that genuinely fit this member and explain the fit. Follow these rules exactly:

1. Only ever cite a reference that appears in the catalog you are given. Never invent an opportunity, a program name, an agency, a deadline, or a web address. If the catalog is short, return fewer results — returning three good matches is correct, and padding to five with poor ones is not.
2. Choose at most ${MAX_RESULTS}, best fit first. Do not cite the same reference twice.
3. Prefer opportunities the member could realistically pursue given their industry, city and stage. A grant closing in three days is a worse match for a member who has never applied for one than a standing advising service is.
4. Do not name any WCCC-run program, event or perk. This portal has no verified list of them, so anything you named would be a guess presented to a member as fact. If WCCC is the right route, point them at info@wisccc.org.
5. Do not add generic encouragement, praise, or filler.

Return ONLY a strict JSON array, no text outside it. Each object has exactly these three string keys:
  "ref"        — the catalog reference exactly as written, e.g. "F3" or "W1"
  "whyItFits"  — one sentence on why this fits THIS member's industry, city or stage. Be specific to them; do not restate the description.
  "nextStep"   — one concrete action to take next: what to read, what to prepare, or who to contact.`;

type Selection = { ref: string; whyItFits: string; nextStep: string };

function isSelectionList(value: unknown): value is Selection[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).ref === "string" &&
      typeof (item as Record<string, unknown>).whyItFits === "string" &&
      typeof (item as Record<string, unknown>).nextStep === "string",
  );
}

/**
 * Turns the model's references into opportunities, using the catalog as the
 * authority for every factual field.
 *
 * Unknown references are dropped rather than repaired. A model that cites "F9"
 * against an eight-entry catalog has either miscounted or invented, and there
 * is no safe way to tell which apart — so it does not become an opportunity.
 * Duplicates are dropped for the same reason the old prompt asked for no
 * repeats, except that this enforces it rather than requesting it.
 */
function resolveSelections(selections: Selection[], entries: CatalogEntry[]): Opportunity[] {
  const byRef = new Map(entries.map((entry) => [entry.ref, entry]));
  const used = new Set<string>();
  const items: Opportunity[] = [];

  for (const selection of selections) {
    if (items.length >= MAX_RESULTS) break;

    const ref = selection.ref.trim().toUpperCase();
    const entry = byRef.get(ref);

    if (!entry) {
      console.warn("opportunities: model cited an unknown catalog ref", {
        ref: selection.ref,
        catalogSize: entries.length,
      });
      continue;
    }
    if (used.has(ref)) continue;
    used.add(ref);

    items.push({
      // Factual fields: catalog only. The model never gets to write these.
      title: entry.title,
      type: ALLOWED_TYPES.has(entry.type) ? entry.type : "Program",
      description: entry.description,
      sourceUrl: entry.url,
      source: entry.source,
      // `closeDate` is optional on Opportunity, so an undated entry omits the
      // key rather than storing a null that every later reader has to guard.
      ...(entry.closeDate ? { closeDate: entry.closeDate } : {}),

      // Model-written fields. Trimmed because a stray leading newline shows up
      // as an indent in the panel.
      whyItFits: selection.whyItFits.trim(),
      nextStep: selection.nextStep.trim(),
    });
  }

  return items;
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  // Per-member daily cap. See lib/aiRateLimit.ts — every request past this
  // point spends money.
  //
  // Kept ahead of the catalog build, even though it means a failed build costs
  // a quota unit for a generation that never happened. The alternative — check
  // the catalog first — would let a member fire unlimited requests at
  // Grants.gov by clicking the button, and Grants.gov is a free public API
  // this app is a guest on. An empty catalog only happens when Grants.gov is
  // unreachable *and* no Wisconsin entry is verified, so the cost of this
  // ordering is one of twenty daily units in a rare state.
  const { limited, usageId } = await enforceAiRateLimit(userId, "opportunities");
  if (limited) return limited;

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

  const catalog = await buildCatalog(member.industry);

  // No catalog, no opportunities. This is where the old behaviour would have
  // been to let the model answer from memory — exactly the failure this
  // rewrite exists to remove — so it returns an honest error instead. The
  // member is told which source failed, because "nothing matched you" and "we
  // couldn't reach the source" are different facts and only one is about them.
  if (catalog.entries.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: catalog.federalError
          ? `Couldn't load funding opportunities right now (${catalog.federalError}) and no Wisconsin programs have been verified yet. Please try again shortly.`
          : "No current funding opportunities matched your industry. Try again in a few days — federal listings change weekly.",
      },
      { status: 503 },
    );
  }

  const userPrompt = `Member business: ${member.businessName || "(not provided)"}
Industry: ${member.industry}
City: ${member.city || "(not provided)"}, WI
Membership tier: ${member.membershipTier}
Journey: ${member.journey === "personal" ? "Personal growth" : member.journey === "both" ? "Business + personal growth" : "Business growth"}

CATALOG — choose only from these:
${formatCatalogForPrompt(catalog)}`;

  // 700 rather than the old 900: the model now returns a reference and two
  // sentences per result instead of a full description, so the output is
  // roughly half the size. Worth sizing to the work, since max_tokens is also
  // the ceiling on what a runaway generation can cost.
  const result = await callClaude(
    { stable: SELECTION_RULES },
    [{ role: "user", content: userPrompt }],
    700,
    "opportunities",
  );

  // Files what this call cost against the attempt the limiter recorded. A
  // failed call has no usage to report, so its row stays null — which is how a
  // call that never came back is told apart from one that cost nothing.
  await recordSpend(usageId, result.ok ? result.usage : undefined);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const parsed = parseClaudeJson<unknown>(result.text);
  if (!isSelectionList(parsed)) {
    return NextResponse.json(
      { ok: false, error: "Couldn't generate matches in the right format. Please try again." },
      { status: 502 },
    );
  }

  const items = resolveSelections(parsed, catalog.entries);
  if (items.length === 0) {
    // Every reference the model gave was unknown. Rare, and worth its own
    // message: unlike the errors above, retrying here is genuinely likely to
    // work.
    return NextResponse.json(
      { ok: false, error: "Couldn't match those results to current opportunities. Please try again." },
      { status: 502 },
    );
  }

  const saveResult = await saveMemberOpportunities(userId, items);
  const generatedAt = new Date().toISOString();

  // Still return the generated list even if saving failed, so the member sees
  // it — it just won't persist across a page reload until saving works.
  return NextResponse.json({
    ok: true,
    opportunities: { items, generatedAt },
    saved: saveResult.ok,
    // Provenance for the line under the heading. Deliberately not persisted:
    // it describes the sources of *this* generation, and re-showing it after a
    // reload would claim a freshness the saved rows don't have.
    sources: {
      federalCount: catalog.federalCount,
      wisconsinCount: catalog.wisconsinCount,
      federalError: catalog.federalError,
      wisconsinLastVerified: catalog.wisconsinLastVerified,
      federalFetchedAt: catalog.federalFetchedAt,
      federalStale: catalog.federalStale,
    },
  });
}

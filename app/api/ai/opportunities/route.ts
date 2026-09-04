import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceAiRateLimit, recordSpend } from "@/lib/aiRateLimit";
import { saveMemberOpportunities, type Opportunity } from "@/lib/appStore";
import { buildMemberContext } from "@/lib/memberContext";
import { callClaude, parseClaudeJson } from "@/lib/ai";
import { buildCatalog, formatCatalogForPrompt, type CatalogEntry } from "@/lib/opportunityCatalog";
import { validSelections, type Selection } from "@/lib/opportunitySelections";

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

Some catalog entries carry a "Suits:" line. That is WCCC's own judgement about who the entry helps and who it wastes time for, written by a person who knows these organisations. Weigh it above your own impression of the description — it is there because a one-line summary does not tell you who an organisation is actually useful to. Never quote it to the member or present it as something the organisation said.

Your job is SELECTION, not recall. Choose the entries that genuinely fit this member and explain the fit. Follow these rules exactly:

1. Only ever cite a reference that appears in the catalog you are given. Never invent an opportunity, a program name, an agency, a deadline, or a web address. If the catalog is short, return fewer results — returning three good matches is correct, and padding to five with poor ones is not.
2. Choose at most ${MAX_RESULTS}, best fit first. Do not cite the same reference twice.
3. Prefer opportunities the member could realistically pursue right now, judged against everything in their profile — stage, entity structure, whether they have employees or a bank account, what they said they are working on — not just their industry and city. Entries whose conditions the member clearly fails have already been removed before you see the catalog, so your job is ranking and honesty about fit, not eligibility screening. A grant closing in three days is a worse match for a member who has never applied for one than a standing advising service is.
4. Do not name any WCCC-run program, event or perk. This portal has no verified list of them, so anything you named would be a guess presented to a member as fact. If WCCC is the right route, point them at info@wisccc.org.
5. Do not add generic encouragement, praise, or filler.

Return ONLY a strict JSON array, no text outside it. Each object has exactly these three string keys:
  "ref"        — the catalog reference exactly as written, e.g. "F3" or "W1"
  "whyItFits"  — one sentence on why this fits THIS member, naming the specific thing about them that makes it fit — their stage, their structure, what they told you they are working on. Do not restate the description, and do not write a sentence that would be equally true of any other member.
  "nextStep"   — one concrete action to take next: what to read, what to prepare, or who to contact.`;



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

  // The full member context, not the members row.
  //
  // This route used to read `members` and the language preference and nothing
  // else, so the matcher was choosing funding from four columns — business
  // name, industry, city, tier — while the portal already knew the entity
  // structure, the Business Snapshot stage, whether there are employees, a
  // bank account, what the member said they were working on, and eleven other
  // facts. It wrote a confident "why this fits you" from the four, which reads
  // exactly like one written from all sixteen.
  //
  // Cost: this is one Promise.all of member-scoped reads instead of two, so it
  // is one round trip either way, and it *removes* a query — the language
  // directive arrives on the context rather than being fetched beside it. The
  // summary is larger than the five lines it replaces, but it goes in the user
  // message, which was never the cached half, so prompt caching is unaffected.
  const context = await buildMemberContext(userId);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Member profile not found." }, { status: 404 });
  }

  const { member, facts, languageDirective } = context;

  if (!member.industry) {
    return NextResponse.json(
      { ok: false, error: "Add your industry and city in onboarding before finding matches." },
      { status: 400 },
    );
  }

  // One instant for the whole request: the Wisconsin entries' expiry and their
  // fit against the member's facts are both judged against it, and so is the
  // "last checked" date the panel prints. See lib/adviceCatalog.ts for what
  // went wrong when one half used wall-clock time instead.
  const now = new Date();
  const catalog = await buildCatalog(member.industry, facts, now);

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
          ? `Couldn't load funding opportunities right now (${catalog.federalError}) and no Wisconsin programs are available to you${
              catalog.wisconsinState === "expired"
                ? " — their verification has lapsed and is due to be re-checked"
                : ""
            }. Please try again shortly.`
          : "No current funding opportunities matched your industry. Try again in a few days — federal listings change weekly.",
      },
      { status: 503 },
    );
  }

  const userPrompt = `MEMBER
${context.summary}

CATALOG — choose only from these:
${formatCatalogForPrompt(catalog)}`;

  // 1200, raised from 700 after that cap started truncating replies.
  //
  // 700 was sized when `whyItFits` was "one sentence on why this fits" and the
  // member profile was four lines. Both grew: the model now sees the whole
  // member context and is asked to name the specific thing about them that
  // makes an entry fit, which is a longer sentence by design. Five results ×
  // (a reference + two specific sentences + JSON overhead) does not reliably
  // fit in 700, and a JSON array cut off mid-string does not parse — so the
  // member was told the reply was in the wrong *format*, which sent everyone
  // looking at the schema instead of at the budget.
  //
  // Sized to roughly double what five full results need, because the failure
  // mode of too small is a dead feature and the failure mode of too large is a
  // few tenths of a cent. max_tokens is a ceiling, not a target — a shorter
  // reply costs less regardless of what this says.
  //
  // 2400, not 1200. Refresh was run on the deployed site on 2026-09-04 and hit
  // the ceiling again: the member saw "the list ran long and got cut off". The
  // arithmetic above was right about the shape and wrong about the size — the
  // prompt asks for "one sentence" per field and the model writes 40-50 words,
  // so five results run roughly double the estimate this was built on. Raised
  // on the same reasoning that set it the first time, with the measurement
  // instead of the estimate.
  // Appended rather than folded in: for an English-speaking member the stable
  // half stays byte-identical to what every other member sends, which is one
  // shared cache entry across the whole membership. A language preference
  // splits that into one entry per language, which is still five at most.
  const result = await callClaude(
    { stable: languageDirective ? `${SELECTION_RULES}\n\n${languageDirective}` : SELECTION_RULES },
    [{ role: "user", content: userPrompt }],
    2400,
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
  const selections = validSelections(parsed);

  // A malformed entry beside good ones is dropped, not fatal — see
  // validSelections. Logged when it happens, because a model quietly losing a
  // field on one match in five is a prompt problem that would otherwise only
  // show up as a slightly shorter list.
  if (selections && Array.isArray(parsed) && selections.length < parsed.length) {
    console.warn("opportunities: dropped malformed entries", {
      returned: parsed.length,
      kept: selections.length,
    });
  }

  if (!selections || selections.length === 0) {
    // Truncation and malformedness reach this line looking identical — both
    // are just text that will not parse — so they are told apart by the
    // model's own stop reason rather than by inspecting the wreckage. They
    // need different messages because they need different actions: one is
    // worth retrying, the other is a budget to raise, and telling a member to
    // "try again" on a reply that ran out of room produces the same failure a
    // second time.
    console.error("opportunities: reply did not parse", {
      truncated: result.truncated,
      outputTokens: result.usage.outputTokens,
      textLength: result.text.length,
      wasArray: Array.isArray(parsed),
      entriesReturned: Array.isArray(parsed) ? parsed.length : 0,
    });

    return NextResponse.json(
      {
        ok: false,
        error: result.truncated
          ? "The list ran long and got cut off before it was finished. This is on us — please try again, and tell WCCC if it keeps happening."
          : "Couldn't generate matches in the right format. Please try again.",
      },
      { status: 502 },
    );
  }

  const items = resolveSelections(selections, catalog.entries);
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
  const generatedAt = now.toISOString();

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
      wisconsinFilteredOut: catalog.wisconsinFilteredOut,
      wisconsinState: catalog.wisconsinState,
      federalError: catalog.federalError,
      wisconsinLastVerified: catalog.wisconsinLastVerified,
      federalFetchedAt: catalog.federalFetchedAt,
      federalStale: catalog.federalStale,
    },
  });
}

import "server-only";

import { getFederalGrants } from "@/lib/grantsCache";
import { wisconsinCatalogState, wisconsinLastVerified } from "@/data/wisconsinPrograms";
import { wisconsinProgramsForMember } from "@/lib/wisconsinFit";
import type { MemberFact } from "@/lib/appStore";

/**
 * The catalog the AI selects from.
 *
 * This is the hinge of the whole change. The old /api/ai/opportunities asked
 * Claude to *recall* five funding programs and return them as JSON. Whatever it
 * returned was what the member saw — there was no list to check it against, so
 * a program that closed in 2024 and a program that never existed both arrived
 * looking exactly like a real one.
 *
 * Here the model never supplies a fact. It receives a numbered list of
 * opportunities that were either fetched live from Grants.gov this minute or
 * verified by a human at WCCC, and it returns *references* into that list —
 * "F3", "W1" — plus two pieces of writing that are genuinely its job: why this
 * one fits this particular member, and what to do next. Title, type,
 * description, deadline and link are then read back out of the catalog
 * server-side.
 *
 * The consequence is worth stating plainly: a hallucinated opportunity cannot
 * reach a member, because a reference that isn't in the catalog resolves to
 * nothing and is dropped. That is a structural guarantee rather than a
 * well-worded instruction, and it is the reason this file exists instead of a
 * better prompt.
 */

export type CatalogSource = "federal" | "wisconsin";

export type CatalogEntry = {
  /** Short reference the model cites, e.g. "F1". Unique within one catalog. */
  ref: string;
  title: string;
  /** One of the five types the panel styles: Grant/Loan/Certification/Program/Advising. */
  type: string;
  description: string;
  /**
   * Who the entry actually suits, for the Wisconsin half — see `fitNote` in
   * data/wisconsinPrograms.ts. Null for federal grants, which have no
   * equivalent: a Grants.gov posting states its own eligibility and nobody at
   * WCCC has read it.
   *
   * Reaches the model and never the member. It is a judgement WCCC is making
   * about suitability, not a fact about the organisation, and the two must not
   * arrive on screen looking alike.
   */
  fitNote: string | null;
  url: string;
  /** ISO date for federal grants where known; always null for Wisconsin entries. */
  closeDate: string | null;
  source: CatalogSource;
};

export type Catalog = {
  entries: CatalogEntry[];
  /** How many came from the live Grants.gov call. */
  federalCount: number;
  /** How many came from the curated file, after the verified + fresh filter. */
  wisconsinCount: number;
  /**
   * How many verified Wisconsin entries this member's own facts ruled out.
   *
   * Carried to the panel so the member is told filtering happened rather than
   * being shown a shorter list — see WisconsinFitView.filteredOut. It also
   * separates two states the old provenance line could not tell apart: nothing
   * has been verified yet, and nothing that is verified suits this member.
   */
  wisconsinFilteredOut: number;
  /**
   * Set when the Grants.gov call failed. The catalog may still be usable from
   * verified Wisconsin entries alone, so this is reported rather than fatal —
   * but it must reach the member, because "no federal grants matched you" and
   * "we couldn't ask" are very different statements and only one of them is
   * about them.
   */
  federalError: string | null;
  /** Most recent human verification date among the Wisconsin entries shown. */
  wisconsinLastVerified: string | null;
  /**
   * Why the Wisconsin half is empty, when it is — see wisconsinCatalogState.
   *
   * Carried out to the panel because "nobody has signed these off yet" and "the
   * sign-off lapsed" need different people to do different things, and the one
   * message that used to cover both told the second group the wrong story.
   */
  wisconsinState: "ok" | "expired" | "unreviewed";
  /**
   * When the federal half was last fetched from Grants.gov, or null when it
   * could not be established. Shown to the member: a list of deadlines is only
   * as trustworthy as the date it was checked.
   */
  federalFetchedAt: string | null;
  /**
   * True when Grants.gov was unreachable and these are older cached rows. The
   * member still gets a usable list — see lib/grantsCache.ts — but a stale list
   * presented as current is exactly the failure this whole feature exists to
   * avoid, so it is reported rather than smoothed over.
   */
  federalStale: boolean;
};

/**
 * Federal entries offered to the model.
 *
 * Twelve rather than all twenty-five. The list goes into the user message on
 * every generation, so each entry is tokens spent per member per click, and a
 * model choosing five from twelve well-sorted candidates does not do a
 * measurably better job when given twenty-five. grantsGov sorts by soonest
 * deadline first, so the twelve kept are the twelve most urgent.
 */
const MAX_FEDERAL_ENTRIES = 12;

/**
 * Grants.gov titles run long — an agency's full program name plus a fiscal
 * year plus a modification number. Truncating keeps one entry from crowding
 * out the rest of the list; the full title is one click away at `url`.
 */
function trimTitle(title: string): string {
  const MAX = 120;
  if (title.length <= MAX) return title;
  return `${title.slice(0, MAX - 1).trimEnd()}…`;
}

/**
 * `facts` and `now` are required rather than optional.
 *
 * An optional `facts` would have made every existing call site compile
 * unchanged and silently keep the old unfiltered behaviour, which is the bug
 * this change exists to remove. Making it required means the compiler names
 * every caller that has to decide what it knows about the member.
 */
export async function buildCatalog(
  industry: string,
  facts: Record<string, MemberFact>,
  now = new Date(),
): Promise<Catalog> {
  const federalResult = await getFederalGrants(industry);
  const wisconsin = wisconsinProgramsForMember(facts, now);

  const entries: CatalogEntry[] = [];
  let federalError: string | null = null;
  let federalFetchedAt: string | null = null;
  let federalStale = false;

  if (federalResult.ok) {
    federalFetchedAt = federalResult.fetchedAt;
    federalStale = federalResult.stale;
    federalResult.grants.slice(0, MAX_FEDERAL_ENTRIES).forEach((grant, index) => {
      entries.push({
        ref: `F${index + 1}`,
        title: trimTitle(grant.title),
        type: "Grant",
        // The agency and status carry real meaning for a member deciding
        // whether to act: "forecasted" means they cannot apply yet, only
        // prepare, and that is not obvious from a title and a deadline.
        description:
          grant.status.toLowerCase() === "forecasted"
            ? `${grant.agencyName}. Forecasted — not yet open for applications.`
            : `${grant.agencyName}. Open for applications.`,
        fitNote: null,
        url: grant.url,
        closeDate: grant.closeDate,
        source: "federal",
      });
    });
  } else {
    federalError = federalResult.reason;
  }

  wisconsin.programs.forEach((program, index) => {
    entries.push({
      ref: `W${index + 1}`,
      title: program.name,
      type: program.type,
      description: program.description,
      fitNote: program.fitNote,
      url: program.url,
      // Curated entries describe standing services, not dated programs — see
      // rule 3 in data/wisconsinPrograms.ts. A deadline here would be a claim
      // nobody checked.
      closeDate: null,
      source: "wisconsin",
    });
  });

  return {
    entries,
    federalCount: entries.filter((entry) => entry.source === "federal").length,
    wisconsinCount: entries.filter((entry) => entry.source === "wisconsin").length,
    wisconsinFilteredOut: wisconsin.filteredOut,
    federalError,
    wisconsinLastVerified: wisconsinLastVerified(now),
    wisconsinState: wisconsinCatalogState(now),
    federalFetchedAt,
    federalStale,
  };
}

/**
 * The catalog as the model sees it.
 *
 * Deliberately terse and one line per entry. This text goes in the *user*
 * message, never the system prompt: the system prompt is the cached prefix
 * (see the `stable` half of SystemPrompt in lib/ai.ts), and the catalog changes
 * per member and per hour. Putting it in the cached half would invalidate the
 * cache on every single request and quietly undo the prompt-caching work.
 */
export function formatCatalogForPrompt(catalog: Catalog): string {
  if (catalog.entries.length === 0) return "(no opportunities available)";

  return catalog.entries
    .map((entry) => {
      const deadline = entry.closeDate ? ` | closes ${entry.closeDate}` : "";
      const scope = entry.source === "federal" ? "Federal" : "Wisconsin";
      // The fit note goes on its own labelled line rather than being run into
      // the description. They are different kinds of claim — one is what the
      // organisation does, the other is WCCC's judgement about who it suits —
      // and a model handed them as one sentence will quote the judgement back
      // to the member as though the organisation had said it.
      const fit = entry.fitNote ? `\n     Suits: ${entry.fitNote}` : "";
      return `[${entry.ref}] ${entry.title} — ${scope} ${entry.type}${deadline}. ${entry.description}${fit}`;
    })
    .join("\n");
}

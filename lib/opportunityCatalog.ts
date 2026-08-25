import "server-only";

import { findFederalGrants } from "@/lib/grantsGov";
import { activeWisconsinPrograms, wisconsinLastVerified } from "@/data/wisconsinPrograms";

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
   * Set when the Grants.gov call failed. The catalog may still be usable from
   * verified Wisconsin entries alone, so this is reported rather than fatal —
   * but it must reach the member, because "no federal grants matched you" and
   * "we couldn't ask" are very different statements and only one of them is
   * about them.
   */
  federalError: string | null;
  /** Most recent human verification date among the Wisconsin entries shown. */
  wisconsinLastVerified: string | null;
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

export async function buildCatalog(industry: string): Promise<Catalog> {
  const federalResult = await findFederalGrants(industry);
  const wisconsin = activeWisconsinPrograms();

  const entries: CatalogEntry[] = [];
  let federalError: string | null = null;

  if (federalResult.ok) {
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
        url: grant.url,
        closeDate: grant.closeDate,
        source: "federal",
      });
    });
  } else {
    federalError = federalResult.reason;
  }

  wisconsin.forEach((program, index) => {
    entries.push({
      ref: `W${index + 1}`,
      title: program.name,
      type: program.type,
      description: program.description,
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
    federalError,
    wisconsinLastVerified: wisconsinLastVerified(),
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
      return `[${entry.ref}] ${entry.title} — ${scope} ${entry.type}${deadline}. ${entry.description}`;
    })
    .join("\n");
}

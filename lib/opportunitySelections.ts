/**
 * One match as the model returns it: a reference into the catalog, plus the two
 * sentences it wrote about this member. Every factual field comes from the
 * catalog afterwards — see resolveSelections — so nothing here is trusted as
 * fact, only as a pointer and a rationale.
 */
export type Selection = { ref: string; whyItFits: string; nextStep: string };

function isSelection(item: unknown): item is Selection {
  if (!item || typeof item !== "object") return false;
  const record = item as Record<string, unknown>;
  return (
    typeof record.ref === "string" &&
    record.ref.trim() !== "" &&
    typeof record.whyItFits === "string" &&
    typeof record.nextStep === "string"
  );
}

/**
 * The usable matches from a parsed reply, or null when it was not a list at all.
 *
 * **Per item, not all-or-nothing, and that is the whole point.** This replaced a
 * check that required every element to be well formed and rejected the entire
 * reply otherwise. Five matches with one missing `nextStep` became zero matches
 * and "couldn't generate matches in the right format" — four good answers
 * thrown away over one bad field, intermittently, because which field the model
 * fumbles varies run to run. That is what made the panel feel broken at random.
 *
 * Dropping the bad entry and keeping the rest is the same rule
 * `resolveSelections` already applies to references it cannot find in the
 * catalog: an entry that cannot be trusted does not become an opportunity, and
 * the ones beside it are unaffected. This makes the two halves agree.
 *
 * `null` is reserved for "not a list" — a reply that is prose, an object, or
 * nothing. That genuinely has no matches in it, and is worth a different
 * message from a list that arrived and turned out empty.
 *
 * An empty array is returned as an empty array rather than null. The caller
 * decides what to say about it; conflating "the model returned []" with "the
 * model did not return a list" would hide a prompt that is refusing to choose.
 */
export function validSelections(value: unknown): Selection[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(isSelection);
}

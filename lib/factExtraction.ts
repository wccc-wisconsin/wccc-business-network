import "server-only";

import { factDefinition, isValidFactValue, type FactDefinition } from "@/data/facts";
import type { ChatTurn } from "@/lib/appStore";

/**
 * Turning a conversation into candidate profile facts — proposals only, never
 * writes.
 *
 * The portal reads a rich picture of each member and can barely add to it. The
 * only thing that has ever written a fact is `factWritesFromAnswers` in
 * lib/carryOver.ts, and only from a guided-step form. So a member can spend an
 * hour in the Coach describing their business and the profile learns nothing.
 *
 * This closes that loop without breaking the property the whole profile rests
 * on: **every fact is self-reported, and the member knows it.** `MemberFact`
 * carries `source`, `sourceLabel` and `confirmedAt`; lib/memberContext.ts
 * renders facts as "what they've told the portal"; `isFactStale` treats
 * `confirmedAt` as the moment a person last stood behind the value. Extraction
 * that wrote directly would make all three quietly untrue at once — and nothing
 * on screen would show the difference.
 *
 * So nothing here writes. It proposes, the member taps, and the existing
 * `upsertMemberFacts` does the writing with `confirmedAt` meaning exactly what
 * it always meant.
 *
 * Three checks, and every candidate must pass all of them:
 *
 *   1. It names a fact key that exists in the catalog and is eligible.
 *   2. Its value passes `isValidFactValue` for that fact.
 *   3. Its quote appears verbatim in something the member actually typed.
 *
 * The third is the one that matters, and it is the reason this is safer than a
 * carefully worded prompt. A model asked for a quote it cannot find will
 * produce a plausible one; checking it against the transcript turns that from
 * an invisible fabrication into a dropped candidate. Failing candidates are
 * discarded rather than repaired, for the same reason `resolveSelections` in
 * lib/opportunityCatalog.ts drops an unknown catalog reference: a proposal that
 * cannot be traced to something the member said is indistinguishable from an
 * invention, and there is no safe way to tell them apart.
 */

/**
 * Which facts may be proposed from a conversation.
 *
 * Choices and dates only, deliberately — not because free text matters less but
 * because a wrong one is *invisible*. "Employees: W-2 employees" is either
 * right or obviously wrong to the member confirming it. "Monthly running cost:
 * about $4,000" looks equally plausible whether they said $4,000 or $14,000,
 * and someone skimming a confirmation card will tap Save on a plausible number.
 *
 * A choice has a fixed option list and a date has a fixed shape, so
 * `isValidFactValue` can actually reject a bad one. Free text has no shape for
 * it to check, which leaves the quote as the only defence.
 *
 * Widening this later is one line per fact — but not before the confirmation
 * flow has been watched working on the facts where mistakes are visible.
 */
export function isExtractableFact(def: FactDefinition): boolean {
  return def.type === "choice" || def.type === "date";
}

/** A fact the AI thinks the member stated, pending their confirmation. */
export type FactCandidate = {
  key: string;
  /** Catalog-valid value: an option value for a choice, YYYY-MM-DD for a date. */
  value: string;
  /** The member's own words, verified to appear in the transcript. */
  quote: string;
  /** "Employees" — the catalog label, for the confirmation card. */
  label: string;
  /** "W-2 employees" — the human-readable value, not the stored one. */
  display: string;
};

/** What the model is asked to return, before any of it is believed. */
type RawCandidate = { key?: unknown; value?: unknown; quote?: unknown };

/**
 * Normalises text for quote matching.
 *
 * Models reliably reproduce the words and unreliably reproduce the whitespace,
 * capitalisation and punctuation around them — a quote is often re-typed with a
 * comma dropped or a line break collapsed. Comparing raw strings would reject
 * honest quotes for cosmetic reasons and push toward loosening the check, which
 * is the wrong direction entirely. Comparing lowercased, whitespace-collapsed
 * text keeps the check strict about *content*, which is the part that matters.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Everything the member themselves typed, as one searchable string. */
function memberWords(transcript: ChatTurn[]): string {
  return normalize(
    transcript
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.content)
      .join(" \n "),
  );
}

/**
 * Shortest quote accepted.
 *
 * A two-character quote appears in any transcript, so a check against one
 * proves nothing — it would let a fabricated candidate through wearing evidence
 * that means nothing. Long enough to be a phrase, short enough for "two on
 * payroll".
 */
const MIN_QUOTE_CHARS = 8;

/** The catalog options for a choice, or null for other types. */
function displayValue(def: FactDefinition, value: string): string {
  if (def.type === "choice") {
    return def.options?.find((option) => option.value === value)?.label ?? value;
  }
  return value;
}

/**
 * Validates the model's proposals against the catalog and the transcript.
 *
 * Exported separately from the prompt-building so it can be tested without a
 * model: these rules are the whole safety property, and they should be provable
 * on a fixed list of candidates rather than only observable in an API response.
 */
export function validateCandidates(
  raw: unknown,
  transcript: ChatTurn[],
  now: Date,
): FactCandidate[] {
  if (!Array.isArray(raw)) return [];

  const said = memberWords(transcript);
  const seen = new Set<string>();
  const out: FactCandidate[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { key, value, quote } = item as RawCandidate;

    if (typeof key !== "string" || typeof value !== "string" || typeof quote !== "string") continue;

    // One proposal per fact. A model that offers two values for the same fact
    // has contradicted itself, and picking either would be a guess.
    if (seen.has(key)) continue;

    const def = factDefinition(key);
    if (!def || !isExtractableFact(def)) continue;

    const trimmed = value.trim();
    if (!isValidFactValue(def, trimmed)) continue;

    const cleanQuote = quote.trim();
    if (cleanQuote.length < MIN_QUOTE_CHARS) continue;
    if (!said.includes(normalize(cleanQuote))) continue;

    // A date the member "said" that is years in the future is far more likely a
    // misread than a real answer, and a wrong renewal date is exactly the kind
    // of fact that quietly stops the compliance calendar being useful.
    if (def.type === "date" && !isPlausibleDate(trimmed, now)) continue;

    seen.add(key);
    out.push({
      key,
      value: trimmed,
      quote: cleanQuote,
      label: def.label,
      display: displayValue(def, trimmed),
    });
  }

  return out;
}

/** Within roughly a decade either side of today. */
function isPlausibleDate(value: string, now: Date): boolean {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const years = Math.abs(parsed - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return years <= 10;
}

/**
 * The instruction given to the model.
 *
 * It lists only the eligible facts, with their exact accepted values, so a
 * candidate that would fail validation mostly is not proposed in the first
 * place — validation is the guarantee, but a prompt that fights it wastes the
 * member's attention on cards that get dropped.
 */
export function extractionPrompt(): string {
  const lines: string[] = [];

  for (const key of extractableFactKeys()) {
    const def = factDefinition(key)!;
    const accepted =
      def.type === "choice"
        ? (def.options ?? []).map((option) => `"${option.value}" (${option.label})`).join(", ")
        : "a date as YYYY-MM-DD";
    lines.push(`- ${key} — ${def.question} Accepted values: ${accepted}`);
  }

  return `You are reading a conversation between a Wisconsin small-business owner and their AI business coach, for the Wisconsin Chinese Chamber of Commerce portal. Your only job is to notice facts about their business that THEY stated, so the portal can offer to save them.

Facts you may propose, and the exact values each accepts:
${lines.join("\n")}

Rules, all strict:
- Propose a fact only when the member said it themselves. Not the coach, not an inference, not something implied.
- The "quote" must be copied from the member's own message, word for word. It is checked against the transcript, and a quote that is not found means the whole proposal is discarded.
- Use only the accepted values listed above, exactly as written.
- Propose each fact at most once. If the member said different things at different times, take the most recent.
- Propose nothing rather than guessing. An empty list is a correct answer and a common one.

Return ONLY a strict JSON array, no text around it. Each object has exactly three string keys:
  "key"   — the fact key from the list above
  "value" — one of that fact's accepted values
  "quote" — the member's own words that say it`;
}

/** Eligible fact keys, in catalog order. */
export function extractableFactKeys(): string[] {
  return FACT_KEYS.filter((key) => {
    const def = factDefinition(key);
    return !!def && isExtractableFact(def);
  });
}

/**
 * The catalog's keys.
 *
 * data/facts.ts exposes lookup by key rather than the list itself, so this
 * names them. Kept here rather than exported from there because the ordering
 * matters only to this prompt, and a fact missing from this list simply is not
 * offered — which is a safe failure, not a broken one.
 */
const FACT_KEYS = [
  "entity_structure",
  "formation_date",
  "formation_state",
  "has_employees",
  "seller_permit",
  "industry_license",
  "pays_estimated_tax",
  "bank_account",
  "bookkeeping_system",
  "monthly_costs",
  "insurance_carrier",
  "advisor",
  "target_customer",
  "pricing_basis",
  "core_capabilities",
  "naics_codes",
  "ownership_basis",
  "certifications_held",
  "insurance_limits",
  "insurance_renewal_date",
  "license_renewal_date",
  "certification_renewal_date",
  "sam_registration_date",
  "lease_end_date",
];

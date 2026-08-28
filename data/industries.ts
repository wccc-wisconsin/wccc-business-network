/**
 * The industries a member can pick, and what each one asks Grants.gov for.
 *
 * One list, used by the onboarding form and the profile card, so the two cannot
 * drift into offering different options for the same column.
 *
 * **`value` is stored on `members.industry` and must not change.** It is what a
 * member sees in the picker, what the AI prompts describe them as, and what is
 * already in the database for every member who has signed up. Editing one of
 * these strings would leave those members holding a value the picker no longer
 * offers, which renders as an empty select.
 *
 * `grantsKeyword` exists because that stored value was doing a second job badly.
 * `lib/grantsCache.ts` passes the industry straight to Grants.gov as a search
 * term, so "Finance & Accounting" searched federal grants for a string with an
 * ampersand in it, and "Other" searched for the word *other*. The label a member
 * recognises and the query that finds them money are two different strings, and
 * this is where they part company.
 *
 * Keywords are deliberately broad single words. Grants.gov matches on them
 * loosely and a narrow term returns nothing at all, which reads to a member as
 * "there is no funding for me" rather than "that search was too specific".
 */
export type IndustryOption = {
  /** Stored on members.industry, and the label in the picker. */
  value: string;
  /** What Grants.gov is actually asked for. */
  grantsKeyword: string;
};

export const industryOptions: IndustryOption[] = [
  { value: "Technology", grantsKeyword: "technology" },
  { value: "Food & Beverage", grantsKeyword: "food" },
  { value: "Healthcare", grantsKeyword: "health" },
  { value: "Retail", grantsKeyword: "retail" },
  { value: "Professional Services", grantsKeyword: "professional services" },
  { value: "Education", grantsKeyword: "education" },
  { value: "Real Estate", grantsKeyword: "real estate" },
  { value: "Finance & Accounting", grantsKeyword: "finance" },
  { value: "Construction & Trades", grantsKeyword: "construction" },
  { value: "Arts & Media", grantsKeyword: "arts" },
  { value: "Nonprofit", grantsKeyword: "nonprofit" },
  // The one option with no industry in it. "small business" is also what
  // lib/grantsGov.ts falls back to when a search comes back thin, so a member
  // who picks this shares the most-warmed row in the cache rather than keeping
  // a useless one of their own.
  { value: "Other", grantsKeyword: "small business" },
];

/** Lower-cased, because stored industries reach this from the database in mixed case. */
const keywordByIndustry = new Map(
  industryOptions.map((option) => [option.value.toLowerCase(), option.grantsKeyword]),
);

/**
 * The Grants.gov search term for a stored industry.
 *
 * An industry that is not in the list — a value from an older version of this
 * file, or one typed straight into the database — falls through unchanged,
 * which is exactly what happened before this mapping existed. Guessing on its
 * behalf would be worse than leaving it alone.
 */
export function grantsKeywordFor(industry: string): string {
  const trimmed = industry.trim();
  return keywordByIndustry.get(trimmed.toLowerCase()) ?? trimmed;
}

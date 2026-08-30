import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activeWisconsinPrograms,
  wisconsinCatalogState,
  wisconsinLastVerified,
  wisconsinPrograms,
  wisconsinVerificationExpiry,
  STALE_AFTER_DAYS,
  type WisconsinProgram,
} from "@/data/wisconsinPrograms";

/**
 * The Wisconsin half of the funding catalog is a hand-maintained file, and the
 * only thing standing between it and a member being told a discontinued program
 * is active is `activeWisconsinPrograms()`. These tests exist because that
 * filter is load-bearing in a way that is easy to weaken by accident.
 *
 * Two halves, and the split is deliberate. The filter is tested against a
 * fixture, not against the real entries: it used to be tested against them, and
 * six of these tests asserted — directly or by counting — that the file shipped
 * with nothing verified. That was true until 2026-08-29 and made the filter's
 * own tests hostage to an editorial decision about eight unrelated rows. The
 * shipped rows are now checked separately, as data.
 */

// The fixture and the filter tests both mutate the shared array in place, so
// every test restores it. Splice rather than reassign — the module's exported
// binding is what activeWisconsinPrograms() closes over.
const snapshot = wisconsinPrograms.map((program) => ({ ...program }));

function replaceWith(entries: WisconsinProgram[]) {
  wisconsinPrograms.splice(0, wisconsinPrograms.length, ...entries.map((p) => ({ ...p })));
}

afterEach(() => {
  replaceWith(snapshot);
});

const NOW = new Date("2026-08-23T12:00:00Z");
/** Comfortably inside the window. */
const FRESH = "2026-08-20";
/** Comfortably outside it. */
const EXPIRED = "2026-01-01";

const fixture = (patch: Partial<WisconsinProgram> = {}): WisconsinProgram => ({
  id: "fixture-a",
  name: "A Wisconsin Organisation",
  type: "Advising",
  description: "Does a thing for Wisconsin businesses.",
  fitNote: "Suits a Wisconsin business that wants the thing.",
  url: "https://example.wi.gov/",
  lastVerified: null,
  verified: false,
  ...patch,
});

function set(index: number, patch: Partial<WisconsinProgram>) {
  Object.assign(wisconsinPrograms[index], patch);
}

describe("activeWisconsinPrograms", () => {
  beforeEach(() => {
    replaceWith([fixture(), fixture({ id: "fixture-b", name: "Another Organisation" })]);
  });

  it("shows nothing while nothing is verified", () => {
    // The state a newly written entry is in. A failure here means unreviewed
    // content is reaching members — and reaching the model, which is worse,
    // because it can then paraphrase it.
    expect(activeWisconsinPrograms(NOW)).toHaveLength(0);
    expect(wisconsinLastVerified(NOW)).toBeNull();
  });

  it("shows an entry once it is verified and dated", () => {
    set(0, { verified: true, lastVerified: FRESH });

    expect(activeWisconsinPrograms(NOW).map((p) => p.id)).toEqual(["fixture-a"]);
  });

  it("hides an entry whose verification has expired", () => {
    set(0, { verified: true, lastVerified: EXPIRED });

    expect(activeWisconsinPrograms(NOW)).toHaveLength(0);
  });

  it("hides an entry marked verified but never dated", () => {
    // Guards the obvious way to bypass the freshness rule: flip the flag and
    // leave the date alone.
    set(0, { verified: true, lastVerified: null });

    expect(activeWisconsinPrograms(NOW)).toHaveLength(0);
  });

  it("hides an entry that is dated but not verified", () => {
    set(0, { verified: false, lastVerified: FRESH });

    expect(activeWisconsinPrograms(NOW)).toHaveLength(0);
  });

  it("expires exactly at the STALE_AFTER_DAYS boundary", () => {
    const boundary = new Date(NOW);
    boundary.setDate(boundary.getDate() - STALE_AFTER_DAYS);
    const onBoundary = boundary.toISOString().slice(0, 10);

    const dayBefore = new Date(boundary);
    dayBefore.setDate(dayBefore.getDate() - 1);

    set(0, { verified: true, lastVerified: onBoundary });
    expect(activeWisconsinPrograms(NOW)).toHaveLength(1);

    set(0, { lastVerified: dayBefore.toISOString().slice(0, 10) });
    expect(activeWisconsinPrograms(NOW)).toHaveLength(0);
  });
});

describe("wisconsinLastVerified", () => {
  beforeEach(() => {
    replaceWith([fixture(), fixture({ id: "fixture-b", name: "Another Organisation" })]);
  });

  it("reports the most recent date among active entries", () => {
    set(0, { verified: true, lastVerified: "2026-07-01" });
    set(1, { verified: true, lastVerified: FRESH });

    expect(wisconsinLastVerified(NOW)).toBe(FRESH);
  });

  it("ignores expired entries when reporting the date", () => {
    // Otherwise the panel could show a "last checked" date belonging to an
    // entry it is not displaying.
    set(0, { verified: true, lastVerified: FRESH });
    set(1, { verified: true, lastVerified: EXPIRED });

    expect(wisconsinLastVerified(NOW)).toBe(FRESH);
  });
});

describe("the catalog file itself", () => {
  it("has unique ids", () => {
    // Saved member opportunities reference entries by what the catalog held at
    // generation time, so a reused id silently reattributes history.
    const ids = wisconsinPrograms.map((program) => program.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every entry an https url", () => {
    for (const program of wisconsinPrograms) {
      expect(program.url, program.id).toMatch(/^https:\/\//);
    }
  });

  it("uses only types the panel can style", () => {
    const styled = new Set(["Grant", "Loan", "Certification", "Program", "Advising"]);
    for (const program of wisconsinPrograms) {
      expect(styled.has(program.type), `${program.id} has type ${program.type}`).toBe(true);
    }
  });
});

/**
 * The eight rows as they ship, checked as data rather than as behaviour.
 *
 * These are the only Wisconsin specifics the Coach, the Grill and the funding
 * panel are allowed to state, so a mistake here is a mistake in a member's
 * hands with WCCC's name on it. Each of the three below is a way this file
 * could go wrong that nothing else would catch.
 */
describe("the entries as they ship", () => {
  it("has a non-empty verified list, so the panel is not silently dark", () => {
    // The failure this catches is the whole feature quietly reverting: every
    // consumer degrades politely to "no Wisconsin programs", so an empty list
    // looks exactly like a working portal with nothing to say.
    const active = activeWisconsinPrograms();

    expect(active.length).toBe(wisconsinPrograms.length);
    expect(active.length).toBeGreaterThanOrEqual(8);
  });

  it("dates every verification, and never in the future", () => {
    // A future date is the one typo that defeats STALE_AFTER_DAYS outright: an
    // entry stamped 2027 stays active for a year and a half past the day
    // somebody actually read the page.
    const today = new Date().toISOString().slice(0, 10);

    for (const program of wisconsinPrograms) {
      if (!program.verified) continue;
      expect(program.lastVerified, program.id).not.toBeNull();
      expect(program.lastVerified!, program.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(program.lastVerified!.localeCompare(today), program.id).toBeLessThanOrEqual(0);
    }
  });

  it("states no deadline, date or dollar figure in any description", () => {
    // Rule 3 in data/wisconsinPrograms.ts, enforced rather than trusted. These
    // entries describe standing services; a dated or costed claim in one is
    // true for a season and wrong forever after, and nothing downstream
    // re-checks it. The supplier-diversity entry is the reason this test
    // exists — it used to name a 5% bid preference that state procurement
    // policy has since paused for half the firms it named.
    // Two things this pattern learned the hard way, both worth keeping:
    //
    // No trailing \b on the alternation. "%" is not a word character, so a
    // group-wide \b made the percentage arm unmatchable, and the test passed
    // against "a 5% bid preference" — the exact string it was written to catch.
    // Each arm anchors itself now.
    //
    // And percentages need one exception. "at least 51% owned" is the statutory
    // ownership test: definitional, and the same figure in ten years. "a 5% bid
    // preference" is a program term the state pauses and resumes at will, and
    // is the number this catalog actually got wrong. Only the ownership
    // threshold is let through, and only in that exact construction.
    const dated =
      /\b20\d{2}\b|\$\s?\d|\d+\s?%(?!\s+owned\b)|\bdeadlines?\b|\bcloses? on\b|\bdue by\b|\bapplications? close\b/i;

    for (const program of wisconsinPrograms) {
      expect(dated.test(program.description), `${program.id}: ${program.description}`).toBe(false);
    }
  });
});

/**
 * The expiry itself, and the warning that has to arrive before it.
 *
 * `STALE_AFTER_DAYS` makes the whole Wisconsin half of the funding panel
 * disappear on a date, by design — an entry nobody has re-read in six months is
 * not a checked entry. What the design was missing is any way to find out
 * before it happens. The panel simply empties, and the Coach quietly goes back
 * to refusing to name WEDC or the SBDC; nothing errors and nothing tells
 * anybody, so the first symptom is a member getting a worse answer.
 *
 * The compliance calendar already solved this for its own list — see
 * NEEDS_REFRESH_THRESHOLD in components/ComplianceCalendar.tsx. This is the
 * same idea aimed at whoever is working on the repo instead of at the member,
 * because re-verifying is a maintainer's job and not a member's.
 *
 * A failing test rather than a reminder, deliberately: a calendar entry can be
 * missed and a comment can be scrolled past, but a red test on an unrelated
 * commit cannot, and the only way to silence it is to do the thing it is
 * asking for.
 */
describe("the verification deadline", () => {
  /** How much notice a person gets. Long enough to schedule an hour. */
  const WARN_WITHIN_DAYS = 30;

  const daysBetween = (from: Date, toIso: string) =>
    Math.round(
      (new Date(`${toIso}T00:00:00.000Z`).getTime() -
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) /
        86_400_000,
    );

  it("reports the last day the soonest-lapsing entry is still shown", () => {
    replaceWith([
      fixture({ verified: true, lastVerified: "2026-08-29" }),
      fixture({ id: "fixture-b", verified: true, lastVerified: "2026-09-30" }),
    ]);

    // The earliest verification sets the deadline, not the latest — the panel
    // starts thinning out on the first one.
    expect(wisconsinVerificationExpiry(new Date("2026-10-01T00:00:00Z"))).toBe("2027-02-25");
  });

  it("agrees with the filter about the exact boundary day", () => {
    // Off by one here would put the warning a day out and, worse, would make
    // the date printed for a person wrong.
    replaceWith([fixture({ verified: true, lastVerified: "2026-08-29" })]);

    const lastGoodDay = wisconsinVerificationExpiry(new Date("2026-10-01T00:00:00Z"))!;
    expect(activeWisconsinPrograms(new Date(`${lastGoodDay}T12:00:00Z`))).toHaveLength(1);

    const dayAfter = new Date(`${lastGoodDay}T12:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    expect(activeWisconsinPrograms(dayAfter)).toHaveLength(0);
  });

  it("reports nothing to expire when nothing is active", () => {
    replaceWith([fixture()]);

    expect(wisconsinVerificationExpiry(new Date("2026-10-01T00:00:00Z"))).toBeNull();
  });

  /**
   * The forcing function. This one runs against the real shipped entries and
   * the real clock, so it starts failing on its own — that is the feature.
   */
  it(`still has more than ${WARN_WITHIN_DAYS} days left before it lapses`, () => {
    const now = new Date();
    const expiresOn = wisconsinVerificationExpiry(now);

    expect(
      expiresOn,
      "No Wisconsin entry is currently active. Re-verify the eight entries in " +
        "data/wisconsinPrograms.ts — until then the funding panel shows no " +
        "Wisconsin programs and the Coach will not name one.",
    ).not.toBeNull();

    const daysLeft = daysBetween(now, expiresOn!);

    expect(
      daysLeft,
      `The Wisconsin verifications stop being shown after ${expiresOn} — ${daysLeft} day(s) away.\n\n` +
        "When they lapse, the Wisconsin half of the funding panel empties and the Coach and Grill\n" +
        "go back to refusing to name any Wisconsin program. Nothing errors; the answers just get worse.\n\n" +
        "To clear this: re-read the eight URLs in data/wisconsinPrograms.ts, confirm each description\n" +
        "still matches, then set lastVerified to today's date on each. About two minutes.\n" +
        "WISCONSIN-PROGRAMS-REVIEW.md has the checklist and the evidence from last time.",
    ).toBeGreaterThan(WARN_WITHIN_DAYS);
  });
});

describe("why the Wisconsin list is empty, when it is", () => {
  /**
   * Three states that used to share one message on screen. "Awaiting review by
   * WCCC" is true before anyone has signed anything off and false — and
   * misleading — once a signed-off list has simply gone stale, because it sends
   * the reader to the wrong person for the wrong task.
   */
  const NOW = new Date("2026-09-01T00:00:00Z");

  it("says ok while entries are showing", () => {
    replaceWith([fixture({ verified: true, lastVerified: "2026-08-29" })]);

    expect(wisconsinCatalogState(NOW)).toBe("ok");
  });

  it("says unreviewed when nothing has ever been signed off", () => {
    replaceWith([fixture(), fixture({ id: "fixture-b" })]);

    expect(wisconsinCatalogState(NOW)).toBe("unreviewed");
  });

  it("says expired when a signed-off list has gone stale", () => {
    replaceWith([fixture({ verified: true, lastVerified: "2026-01-01" })]);

    expect(wisconsinCatalogState(NOW)).toBe("expired");
  });

  it("treats verified-but-undated as unreviewed, not as a lapse", () => {
    // A missing date is not evidence that a check happened and aged out.
    replaceWith([fixture({ verified: true, lastVerified: null })]);

    expect(wisconsinCatalogState(NOW)).toBe("unreviewed");
  });

  it("says ok as it ships, which is the state that matters today", () => {
    expect(wisconsinCatalogState()).toBe("ok");
  });
});

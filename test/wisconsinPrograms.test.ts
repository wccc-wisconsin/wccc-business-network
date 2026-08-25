import { afterEach, describe, expect, it } from "vitest";
import {
  activeWisconsinPrograms,
  wisconsinLastVerified,
  wisconsinPrograms,
  STALE_AFTER_DAYS,
  type WisconsinProgram,
} from "@/data/wisconsinPrograms";

/**
 * The Wisconsin half of the funding catalog is a hand-maintained file, and the
 * only thing standing between it and a member being told a discontinued program
 * is active is `activeWisconsinPrograms()`. These tests exist because that
 * filter is load-bearing in a way that is easy to weaken by accident.
 */

// The filter tests mutate the shared array in place, so each restores it.
const snapshot = wisconsinPrograms.map((program) => ({ ...program }));
afterEach(() => {
  wisconsinPrograms.splice(0, wisconsinPrograms.length, ...snapshot.map((p) => ({ ...p })));
});

function set(index: number, patch: Partial<WisconsinProgram>) {
  Object.assign(wisconsinPrograms[index], patch);
}

const NOW = new Date("2026-08-23T12:00:00Z");
/** Comfortably inside the window. */
const FRESH = "2026-08-20";
/** Comfortably outside it. */
const EXPIRED = "2026-01-01";

describe("activeWisconsinPrograms", () => {
  it("shows nothing as the file ships", () => {
    // Every entry is drafted, none verified. Until a person at WCCC reviews
    // them, the Wisconsin half of the panel must be empty — a failure here
    // means unreviewed content is reaching members.
    expect(activeWisconsinPrograms()).toHaveLength(0);
    expect(wisconsinLastVerified()).toBeNull();
  });

  it("shows an entry once it is verified and dated", () => {
    set(0, { verified: true, lastVerified: FRESH });

    expect(activeWisconsinPrograms(NOW).map((p) => p.id)).toEqual([wisconsinPrograms[0].id]);
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

# Next session — WCCC Business Network

Written 2026-08-27, end of session. Replaces the memory-loop design brief that
was here; that work is built (see below).

`ROADMAP.md` is the standing plan. This file is what a fresh session needs to
pick up tomorrow.

---

## Read this first: three commits are unmerged

`origin/master` is at `2b91008`. Three commits sit ahead of it on
**`feature/memory-loop`**, stacked linearly:

| Commit | What |
| --- | --- |
| `865d56e` | Token counts persisted on `ai_usage`; the rate limiter's three round trips cut to two. |
| `156b0a3` | Coach replies stream as they are written. |
| `5e3f019` | Conversations stored; a conversation can propose profile facts for the member to confirm. |

They are a straight line, so one local merge moves master past all three:

```
git checkout master
git pull
git merge feature/memory-loop     # expect "Fast-forward"
git push
```

If that merge does *not* say Fast-forward, stop — something diverged, and
pushing would make it worse.

**Then, and this matters more than usual:** re-run `supabase-schema.sql`
followed by `supabase-verify.sql`. This release adds a whole table
(`conversations`) and four columns on `ai_usage`. Until the schema is applied,
saving a conversation and recording spend both **fail silently** — the member
chats normally, the Coach works, and nothing is kept. `supabase-verify.sql`
should report 101 columns and every row `ok`.

The uncommitted doc changes (`README.md`, `ROADMAP.md`, `VERIFY-DEPLOY.md`,
`DIRECTORY-DESIGN.md`, and this file) can go in their own commit whenever.

---

## What the AI layer looks like now

Seven surfaces, one shared member context, 142 tests.

Four properties hold across all of them, and each was built deliberately. A
change that breaks one is the wrong change, however convenient:

**1. Facts are retrieved, never recalled.** `lib/opportunityCatalog.ts` gives
the model a catalog and takes back references; the server reads every fact back
out, so an invented funding program cannot reach a member.
`lib/adviceCatalog.ts` applies the same idea to Wisconsin filing dates and fees
in the Coach and Grill — a weaker guarantee, and the file says why: chat is free
prose, so what this removes is the *reason* to guess rather than the ability.

**2. Every fact is self-reported, and the member knows it.** `confirmedAt` means
a person confirmed it. `lib/factExtraction.ts` proposes; only a tap writes. Read
its header before touching anything in that area.

**3. Nothing unverified reaches a member.** Wisconsin programs stay hidden until
someone at WCCC ticks them off, and verification expires after 180 days.

**4. Spend is capped, visible, and cheap.** Per-route and total daily caps that
fail open; prompt caching on the multi-turn surfaces; token counts now persisted
per call, split four ways because they are billed at three different rates.

---

## Still open, in the order I would take them

**1. Conversation history has no screen.** The table exists, saves work, and
`DELETE /api/conversations?id=` is built and tested — but there is nowhere for a
member to browse or remove their own conversations. That was answered "yes,
build it in now" and is the one piece of it that did not land. It is also the
half that makes the storage defensible: the portal now keeps transcripts that
members cannot see.

`listConversations` already returns exactly what a list needs (opening line,
message count, date, no transcript bodies).

**2. The Coach does not yet use what it stored.** Conversations are saved but
nothing reads them back, so the assistant still opens cold. The intended payoff —
*"last time we were working on your DBE certification"* — is one read away and
was never wired up. Do this after (1), since both touch the same data.

**3. Bilingual advice.** `ROADMAP.md` §2.1. A `preferred_language` fact and one
line in each system prompt. Small in code; probably the widest-reaching thing
left for this membership. Keep agency names, form numbers and URLs in English —
that is what a member has to type into a government site.

**4. Free-text fact extraction.** Deliberately excluded for now: a wrong
`monthly_costs` looks exactly as plausible as a right one on a confirmation
card. Worth revisiting only after watching the confirmation flow work on real
conversations. One line per fact in `isExtractableFact`.

**5. `npm audit` — 5 high severity.** Build-chain, not request-path. Its own PR:
`npm audit fix`, then test, lint and build, commit only if all three stay green.

**6. `VERIFY-DEPLOY.md` — four checks, none run.** Two have been open since PR
#16. The other two cover the Grants.gov cache and the cron. All four exist
because the mechanism they test fails silently.

---

## Still needs a person, not a session

**The nine Wisconsin entries.** `WISCONSIN-PROGRAMS-REVIEW.md`, ~15 minutes.
Every entry ships `verified: false`, so the curated half of the funding catalog
is empty *and* the Coach refuses to name any Wisconsin program. Verifying even
three lights them up in both places. Row 9 needs a decision rather than a check.

---

## Environment notes

- **The user runs all git commands.** The sandbox with folder access cannot
  push and cannot delete; read-only git commands leave `.git/index.lock`
  behind, so `mv` it aside afterwards.
- The user's `node_modules` is a Windows install, so a Linux sandbox cannot run
  vitest against it (`@rollup/rollup-linux-x64-gnu` missing). Verification was
  done by copying the source into a clean Linux container and installing there;
  that works well and is worth repeating.
- Building in a container fails on Google Fonts. Stub the two
  `next/font/google` calls in `app/layout.tsx`, build, restore. Never commit the
  stub.
- `.gitattributes` normalises line endings, but files on disk are CRLF — a
  script that edits by exact string match must match `\r\n`.

---

## House rules

- Comments explain *why*, including why the alternative was rejected. Several
  apparent bugs are deliberate and documented — read the comment before
  "fixing" one. Match that standard.
- Never invent WCCC programs, events, partners or perks. If something is not
  verified, say so on screen rather than filling the gap.
- Schema changes ship with their `alter table ... add column if not exists`
  migration and a regenerated `supabase-verify.sql`, in the same PR.
- Verify before claiming: typecheck, lint, test and build. Then mutation-test —
  break each new rule one at a time and confirm the test meant to catch it
  fails. It has caught two tests this session that were passing for the wrong
  reason.
- The site is standalone. `contacts`, `public_registrations` and `subscribers`
  in the shared Supabase project belong to the sibling `wccc-platform` site.
  Leave them alone.

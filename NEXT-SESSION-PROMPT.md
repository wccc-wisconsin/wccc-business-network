# Next session — WCCC Business Network

Written 2026-08-30, end of session. `ROADMAP.md` is the standing plan; this file
is what a fresh session needs to pick up tomorrow.

**Status in one line: it is deployed and a member can use it, one feature is
broken with the fix written but not yet pushed, and one is unverified.**

---

## Do this first

### 1. Push the fix sitting uncommitted

```
git add -A
git commit -m "Report a truncated reply as truncated, and give the funding matcher room to finish"
git push
```

Verified in a clean Linux container — typecheck, lint, 244 tests (8 skipped),
`next build`, then four mutations. **No schema step.** Details under "The
funding bug" below.

### 2. Answer two open questions from the live walkthrough

Both need the user or the deployed site; neither can be settled from the repo.

**a. Was the funding failure truncation?** Vercel → Logs → filter
`callClaude usage` → find `route: "opportunities"`. If `outputTokens` reads
**700** — exactly the old cap — truncation is confirmed and the pushed fix
lands it. If it reads well under 700, the reply was malformed for some other
reason and the salvage path in `parseClaudeJson` is the thing to look at
instead.

**b. Does the AI Coach reply at all?** On 2026-08-30 a screenshot showed a
member message with nothing under it. That is a different code path from
funding — `streamClaude`, no JSON parsing — so it is either a screenshot taken
mid-stream or a second, unrelated failure. **Ask the user to retry one Coach
message before assuming anything.** If it genuinely returns nothing, start at
`lib/ai.ts` `streamClaude` and the SSE parsing, and check Vercel logs for
`callClaude` errors on `route: "coach"`.

---

## Where it actually stands, as of 2026-08-30

**Live.** `7399204` is on `origin/master` and deployed to
`wccc-business-network.vercel.app`. All six environment variables are set in
Vercel including `CRON_SECRET`, which had been outstanding for weeks.

**Schema applied.** `supabase-schema.sql` and `supabase-verify.sql` were both
run against the live database. 17 tables, every row `ok`, RLS `ok — protected`
on all of them, and `ai_feedback` confirmed at 9 of 9 columns. Nothing is
half-applied.

**Seeded.** `seed-demo-member.sql` was run against the user's own account, which
is now Golden Lotus Catering. Note for tomorrow: **that account holds demo data,
not real data** — the teardown at the bottom of that file removes it.

### What was verified working on the live site

**The deadline filter, exactly as predicted.** Golden Lotus sees one row —
*Wisconsin annual report, LLCs and corporations formed April–June, June 30
2027* — and the line *"9 filings hidden because your profile says they don't
apply to you."* Predicted 1 shown / 9 removed before looking; got 1 / 9. The
whole fact → filter → screen path is real and works.

### What is broken or unknown

| | |
| --- | --- |
| **Funding & Programs** | Was returning *"Couldn't generate matches in the right format."* Fix written and tested, **not yet pushed**. See below. |
| **AI Coach** | Unknown — no reply visible in one screenshot. Retry before investigating. |
| **Decision Grill** | Never exercised on the live site. |
| **Module Toolkit** | Never exercised on the live site. |
| **Rating buttons** | Never clicked on the live site. `VERIFY-DEPLOY.md` check 7. |

---

## The funding bug, and what it should teach the next session

Worth reading even though the fix is written, because the *shape* of it will
recur.

**What happened.** Giving the matcher the full member context (§0.12) came with
a prompt telling it to write more specific sentences — and `max_tokens` stayed
at **700**, a budget sized when the profile was four lines and the instruction
was "one sentence on why this fits". Five results stopped fitting. The JSON was
cut off mid-string, did not parse, and the panel reported a **formatting**
error.

**The part that made it worse.** `callClaude` only checked `stop_reason ===
"max_tokens"` when there was *no text at all*. A reply that started fine and ran
out came back `ok: true` with unparseable text, so the member was told to try
again — and trying again truncated identically. The error message sent everyone
to look at the schema, which was never wrong.

**Three fixes, all pushed together:**

- `max_tokens` on `opportunities` raised 700 → 1200, sized to roughly double
  what five full results need.
- `ClaudeResult` now carries `truncated`, so a JSON route can say *"the list ran
  long and got cut off"* rather than blaming the format. Prose routes still get
  the partial text, because a cut-off answer beats nothing there.
- `parseClaudeJson` walks the text for the first *balanced* JSON value, so a
  model that prefaces its JSON with a sentence no longer loses everything. A
  **truncated** reply still returns null deliberately — half an array is not a
  shorter answer, it is three matches presented as though they were all of them.

**The lesson, stated plainly:** changing a prompt to ask for more output is a
change to the token budget. They are the same decision and were treated as two.

**And mutation testing earned itself a third time this session.** The first
version of the "bracket inside a quoted value" test passed against a greedy
regex as well as against the balanced scan — it did not actually test what it
claimed. The case that separates them is *trailing prose containing a bracket*.
Two other tests this session were also found passing for the wrong reason. Keep
doing this.

## Done since: the Wisconsin entries went live

2026-08-29, pushed as part of `7399204`. Eight signed off with
`lastVerified: "2026-08-29"`, the ninth (`county-revolving-loan-funds`) dropped
as a category rather than an organisation. `ROADMAP.md` §0.11 has the full
account. Three things a fresh session should carry forward:

**The re-read before sign-off found a wrong claim that two previous passes had
confirmed.** Supplier diversity's 5% bid preference is not DVB-only — PRO-606
makes it a permissive MBE/DVB preference with the MBE half paused. The entry now
points at the policy rather than quoting a figure. The lesson is the cheap one:
re-read before writing a date in, even when the previous note says it matched.

**A real bug came with it.** `programLines()` in `lib/adviceCatalog.ts` filtered
programs against wall-clock time while the deadlines in the same block honoured
the `now` they were given. Invisible while nothing was verified. Fixed by
threading `now`; there is a test named for it.

**2027-02-25 is the last day the eight are shown**, and the repo now warns
before that rather than after. `test/wisconsinPrograms.test.ts` fails 30 days
out — so the next `npm test` after **2027-01-26** says so, with the date and the
fix in the failure message. If you are reading this because that test is red:
re-read the eight URLs, confirm each description, set `lastVerified` to today.
Two minutes. `WISCONSIN-PROGRAMS-REVIEW.md` has the checklist and last time's
evidence.

### While you are in there: why this half is not automated

Asked whether the Wisconsin list could refresh nightly like the federal half
does, the answer is no, and it is worth not relitigating:

- **Federal is a real feed.** Grants.gov has an API returning postings with
  close dates. They expire, so they need refreshing — hence `grants_cache` and
  the cron.
- **These eight are organisations, not postings.** There is no Wisconsin API.
  SCORE's free mentoring does not close on a date. There is nothing to poll.
- Automating it would mean scraping state agency HTML and inferring which
  programs are "active" from page layout. That fails silently — the scrape
  returns *something*, the panel fills with plausible entries, nobody notices.
  The 180-day expiry is the deliberate manual equivalent of the nightly refresh.

One exception if it is ever wanted: WEDC's "Programs & Resource Center" does
list individual programs with open/closed states, and is the only one of the
eight shaped like a feed. Note that its directory renders client-side, so it is
not fetchable as plain HTML — that is what stopped this pass confirming WEDC
"publishes which are currently open". Its own project, with its own failure
handling, not folded into this list.

---

## What was built, and where to read about it

All of the below is on `master` in `7399204`. `ROADMAP.md` is the long-form
account — the section numbers point there.

| | What | Where |
| --- | --- | --- |
| §0.10 | Bilingual answers switched off behind `BILINGUAL_ENABLED`, tests skipped rather than deleted | `data/facts.ts` |
| §0.11 | Eight Wisconsin entries live, ninth dropped, expiry now warns 30 days out | `data/wisconsinPrograms.ts` |
| §0.12 | Funding matched to the member — fit notes, a code-side filter, the full member context | `lib/wisconsinFit.ts` |
| §0.13 | `ai_feedback` — a rating under Coach replies, Grill briefs and step reviews | `app/api/ai/feedback/` |

Two reference pages were also written for the user and live outside the repo, as
Claude artifacts. They are worth asking the user for if the architecture is
unclear: one traces the write paths, the shared member context and the
difference between the two caches and the memory loop; the other maps what a
member gets back for each answer they give, with the filter counts measured
rather than estimated.

## Still open, in the order I would take them

Everything above "Do this first" comes before any of these.

**1. Walk the rest of the live site.** Deadlines passed; the Decision Grill, the
Module Toolkit and the rating buttons have never been exercised against the
deployment at all, and the Coach is unknown. This is the cheapest way left to
find real problems, and today it found two in one sitting. The demo account is
already seeded, so it costs ten minutes.

**2. `VERIFY-DEPLOY.md` — seven checks, none run.** Two have been open since PR
#16. Every one exists because the mechanism it tests fails silently. Check 7
(a rating actually lands) is the newest and takes a minute.

**3. `npm audit` — 5 high severity.** Build-chain, not request-path. **The fix
is already known-good:** `npm audit fix` is lockfile-only, changes no
`package.json`, takes it to 0 vulnerabilities, and the full suite plus
`next build` were run against the patched lockfile on 2026-08-30. Its own
commit — never folded into a feature.

**3. Read the feedback back.** The `ai_feedback` table is live (§0.13) and
nothing looks at it. Deliberately — a dashboard built before there is a month of
real ratings would be designed against imagined data. Once there is a month:
counts by route and by model, and the notes if the note box ever gets built.

**4. Free-text fact extraction.** Still deliberately excluded; the reasoning
moved to `ROADMAP.md` §4.

**5. Per-county revolving loan funds.** The replacement for the ninth entry that
was dropped. Needs someone to say which counties WCCC members are actually in;
then one entry per county, linking to that county's own economic development
office, each verified separately. Not blocked on anything.

**6. Watch what the fit filter actually removes.** `wisconsinFilteredOut` is
computed and shown but nothing records it. Two entries carry requirements today
and the filter is deliberately timid; whether it is *too* timid — or whether
members are being filtered on facts they filled in wrongly a year ago — is a
question only real usage answers. Worth folding into the `ai_feedback` work
(§2.1) rather than building its own thing.

---

## Setting up an account to look at this with

`seed-demo-member.sql` turns one account into Golden Lotus Catering, the demo
persona: profile, Business Snapshot, fourteen facts, eight completed guided
steps. Edit the email at the top, run it in the Supabase SQL editor after the
account has been through onboarding. It seeds no conversations, briefs or
documents — those are what a reviewer is there to judge, and seeding them would
mean reviewing text that never came from the deployment.

`test/demoSeed.test.ts` checks every key in that file against the real catalogs,
because Postgres will happily store a fact key or step key that no longer
exists, and the only symptom is a dashboard that shows nothing.

---

## Still needs a person, not a session

**Ten minutes on the live site.** Everything the tests cannot answer is here:
whether the Coach's answers are any good, whether the Grill asks sharp
questions, whether a generated document is worth having. 244 automated tests say
the mechanisms work; not one of them says the portal is useful.
`GOLDEN-LOTUS-PERSONA.md` ends with a "judging the output" section — good signs
versus red flags — so this is an evaluation rather than a vibe check.

**Which counties WCCC members are actually in** — the only input needed to
rebuild the dropped ninth entry as something useful. See "Still open" above.

**Someone who reads Chinese.** Bilingual advice is built and tested but
**switched off** — what is tested is the plumbing: that the preference is
stored, that it reaches all seven AI surfaces, that agency names survive
untranslated. Whether the Chinese reads naturally is not something this repo can
answer, so the feature waits behind `BILINGUAL_ENABLED` rather than sitting live
and unread. `VERIFY-DEPLOY.md` check 6 is that job, on a preview deploy with the
flag flipped, and a pass is the approval to merge the flip. For this membership
it is probably worth more than anything else outstanding, and it is a phone
call.

---

## Environment notes

- **The user runs all git commands.** The sandbox with folder access cannot
  push and cannot delete; read-only git commands leave `.git/index.lock`
  behind. It cannot be deleted, but it *can* be renamed within the mount —
  `mv .git/index.lock .git/_stale_locks/index.lock.<date>` is what this session
  did, and that directory is where earlier ones went.
- The user's `node_modules` is a Windows install, so a Linux sandbox cannot run
  vitest against it. **The recipe that works, and worked again this session:**
  copy `app/ components/ lib/ data/ test/` plus the root config files into a
  clean Linux container, `npm ci`, then `npx tsc --noEmit`, `npm test`,
  `npx eslint`, `npx next build`. About four minutes end to end.
- Building in a container fails on Google Fonts. Stub the two
  `next/font/google` calls in `app/layout.tsx`, build, restore — in the
  container's copy only. Never commit the stub.
- `next build` also needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
  `CLERK_SECRET_KEY` set to anything non-empty; `pk_test_stub` / `sk_test_stub`
  are enough.
- `.gitattributes` normalises line endings. The files this session touched are
  all LF on disk — check before assuming CRLF, a script that edits by exact
  string match has to match whichever it finds.

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
  fails. It caught two tests last session that were passing for the wrong
  reason, and confirmed all six new rules this one.
- The site is standalone. `contacts`, `public_registrations` and `subscribers`
  in the shared Supabase project belong to the sibling `wccc-platform` site.
  Leave them alone.

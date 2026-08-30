# Next session — WCCC Business Network

Written 2026-08-28, updated 2026-08-29. The previous version of this file was
about merging `feature/memory-loop`; that is done and its contents have moved
into `ROADMAP.md` §0.4.

`ROADMAP.md` is the standing plan. This file is what a fresh session needs to
pick up tomorrow.

---

## Read this first: everything shipped, one thing then switched off

`fa36515` is on `origin/master` and deployed. `supabase-schema.sql` and
`supabase-verify.sql` were both run on 2026-08-28 — 103 columns, every row `ok`,
`conversations` at 9/9, so the two new columns are live. Nothing is half-applied
and there is no schema step waiting.

The demo seed landed after it as `d239f3c`.

**Uncommitted, from the 2026-08-29 session — bilingual answers switched off
behind a flag:**

**Two separable pieces. They do not depend on each other — commit them
separately if you would rather review them apart.**

*Bilingual answers switched off behind a flag:*

```
A test/bilingualFlag.test.ts   what "off" means, from both sides
M data/facts.ts                BILINGUAL_ENABLED, and why
M data/assessment.ts           the Snapshot stops asking while it is off
M lib/memberContext.ts         the directive and the read it feeds on
M test/memberContext.test.ts   content rules skipped, not deleted
M VERIFY-DEPLOY.md             check 6 is now the gate on the flag
```

*The Wisconsin entries live:*

```
M data/wisconsinPrograms.ts    eight verified, ninth dropped, two descriptions corrected
                               + wisconsinVerificationExpiry / wisconsinCatalogState
M lib/adviceCatalog.ts         programs filtered against `now`, not wall-clock time
M test/wisconsinPrograms.test.ts   filter on a fixture; shipped rows checked as data;
                               fails 30 days before the verifications lapse
M test/adviceCatalog.test.ts   the two states driven, not guessed from shipped data
M WISCONSIN-PROGRAMS-REVIEW.md signed off, with the evidence quoted
```

*The matcher stopped guessing who a program suits (ROADMAP §0.12):*

```
A lib/wisconsinFit.ts              applies/unknown/no per entry, erring toward showing
A test/wisconsinFit.test.ts        which way the filter errs, which is the whole design
A test/opportunityCatalog.test.ts  the catalog's first tests — fit notes reach the prompt
M data/wisconsinPrograms.ts        fitNote on all eight; requirements on exactly two
M lib/opportunityCatalog.ts        buildCatalog takes the member's facts and an instant
M app/api/ai/opportunities/route.ts  buildMemberContext, one query fewer
M components/OpportunitiesPanel.tsx  says what it filtered out and why, and tells a
                               lapsed list apart from one never reviewed
```

*Both:* `M ROADMAP.md` (§0.10, §0.11, §1.2)  `M WEEK-REVIEW.md`  `M NEXT-SESSION-PROMPT.md`

*A feedback loop on answer quality (ROADMAP §0.13) — **this one has a schema
step**:*

```
A app/api/ai/feedback/route.ts   records a rating; no model call, no rate limit
A components/AnswerFeedback.tsx  the two buttons, optimistic and quiet
A test/aiFeedback.test.ts        one row per opinion; never breaks what it rates
M supabase-schema.sql            ai_feedback + unique index + rating constraint
M supabase-verify.sql            112 columns across 17 tables, was 103 across 16
M lib/appStore.ts                saveAiFeedback, upserting on (member, target)
M lib/ai.ts                      MODEL exported so a rating records what answered
M components/AICoach.tsx  M components/DecisionGrillPanel.tsx  M components/StepCard.tsx
M VERIFY-DEPLOY.md               check 7
```

> **Run `supabase-schema.sql` then `supabase-verify.sql` after deploying.**
> Until you do, every rating is silently discarded — the buttons still say
> "Thanks — noted", because they are optimistic by design. `supabase-verify.sql`
> should report **17 tables, every row `ok`**. Both scripts were applied twice
> against a real Postgres 16 in a container, so the re-run is known safe.

```
git add -A
git commit -m "Switch bilingual answers off behind a flag; put the Wisconsin entries live"
git push
```

Verified in a clean Linux container: typecheck, lint, 232 tests (8 skipped) and
`next build`, all green — plus, for the schema, a real Postgres 16: applied
twice, verify script clean on all 17 tables, and the upsert, the rating
constraint and the member cascade each exercised against actual rows. Then
mutation-tested, twenty-nine rules broken one at a time. The first ten:
both flag checks, the Snapshot question, the fact definition, `programLines`
ignoring `now`, a future `lastVerified`, a silently unverified entry, and three
shapes of dated claim in a description. Every one caught by the test written for
it — **except the first attempt at the "no dated figures" rule, which passed
against `5%` because a group-wide `\b` after an alternation ending in `%` can
never match.** That is the second time mutation testing has caught a test
passing for the wrong reason. The flag was also flipped to `true` to confirm the
bilingual reversal needs no test edits (183 pass, 4 skip, nothing touched).

The other ten covered the matcher: a declined ownership answer read as a no, an
unanswered question read as a no, unknown treated as disqualifying, fit judged
before freshness, the filtered-out count zeroed, a fit note emptied, a third
requirement added, the fit note dropped on the way into the catalog, the fit
note merged into the description, and the filter removed entirely. **Two of
those found nothing the first time** — dropping `fitNote` changed no test at
all, which is what `test/opportunityCatalog.test.ts` was written for.

The last five covered the feedback write: the conflict target dropped (which
turns every change of mind into a second vote), an empty note stored as `""`,
the note cap removed, the write throwing instead of reporting failure, and
`created_at` written by hand over the moment the member first said something.

The last four covered the expiry warning: an already-lapsed list, a lapsed list
reported as never-reviewed, the model told the old story unconditionally, and
the reason dropped on the way into the catalog. The warning was also proved by
winding the dates forward until it fired, and its message read back.

> **Sandbox git is unreliable in this repo.** `git show HEAD:<file>` returns
> empty and `git diff` under-reports, because git cannot get write access to its
> own index through the folder mount. Read-only git commands also leave
> `.git/index.lock` behind; it cannot be deleted but it *can* be renamed within
> the mount — `mv .git/index.lock .git/_stale_locks/index.lock.<date>` is what
> this session did, and that directory is where earlier ones went. Trust
> `git status` run on the user's own machine, never the sandbox's.

---

## Done since: the Wisconsin entries went live

2026-08-29. Eight signed off with `lastVerified: "2026-08-29"`, the ninth
(`county-revolving-loan-funds`) dropped as a category rather than an
organisation. `ROADMAP.md` §0.11 has the full account. Three things a fresh
session should carry forward:

**The re-read before sign-off found a wrong claim that two previous passes had
confirmed.** Supplier diversity's 5% bid preference is not DVB-only — PRO-606
makes it a permissive MBE/DVB preference with the MBE half paused. The entry now
points at the policy rather than quoting a figure. The lesson is the cheap one:
re-read before writing a date in, even when the previous note says it matched.

**A real bug came with it.** `programLines()` in `lib/adviceCatalog.ts` filtered
programs against wall-clock time while the deadlines in the same block honoured
the `now` they were given. Invisible while nothing was verified. Fixed by
threading `now`; there is a test named for it.

**2027-02-25 is the last day the eight are shown**, and the repo now tells you
before that rather than after. A test fails 30 days out naming the date and the
fix; `wisconsinVerificationExpiry` holds the arithmetic. If you are reading this
because that test is red, the answer is: re-read the eight URLs, confirm each
description, set `lastVerified` to today. Two minutes.
`WISCONSIN-PROGRAMS-REVIEW.md` has the checklist and last time's evidence.

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

## What was built

**Committed already (`35e2745`):** the Coach's history drawer and conversation
recall — items 1 and 2 of the previous handoff, which were the two halves of the
same thing: the portal had started keeping transcripts that members could not
see, and was not reading them back either.

**1. A history drawer in the Coach.** "Past chats" beside the heading. Lists
what is stored — opening line, module, message count, date — and reopens or
deletes any of it. It lives inside `AICoach.tsx` rather than in its own panel or
page because that component already owns the transcript, so reopening is a
`setMessages`, and it comes along free on module pages as well as the dashboard.

Three details in there are load-bearing and are commented as such:

- **Deleting the open chat detaches its id.** `saveConversation` upserts on
  whatever id it is handed, so a Coach still holding a deleted row's id would
  recreate that row on the next message.
- **A delete waits for any save in flight.** Same failure by a different route:
  a save that started before the delete would land after it.
- **The conversation id is read from a ref, not from state,** because `persist`
  runs from a closure created before the reply streamed.

**2. The Coach opens warm.** `conversationLines` in `lib/memberContext.ts` puts
the openings of up to three earlier conversations into the shared context, and
tells the model plainly that openings are all it has — it may pick a thread back
up, never claim to remember how the exchange went. The chat in progress is
excluded by id (the client sends `conversationId`; the route passes it through),
which stops the coach reminding a member of the sentence they just typed *and*
keeps the cached prompt prefix identical across the turns of one chat.

**Uncommitted, built after that:**

**3. Onboarding cut to four questions, and tier gating switched off** (ROADMAP
§0.8), on WCCC's direction to give every member everything.

The journey question had one possible answer and was already hiding itself. The
membership picker decided which stages opened, on the honour system, with no
payment anywhere in the flow — it asked someone to price themselves before they
had seen anything. Both are gone; `completeProfileAction` sets the business
track and the network tier itself and reads neither from the form.

`TIER_GATING_ENABLED` in `data/modules.ts` is a flag, not a deletion: every
module keeps its `minTier`, `tierMeetsMinimum` still answers honestly, and paid
stages return with one line. The public site still sells memberships and the
tier column is still stored — it now records what WCCC has actually been paid
rather than what someone claimed, and the dashboard badges it only for members
who hold one.

The knock-on worth knowing about: the Business Snapshot's priority answer
existed only to unlock a module free, so it would have become a stored value
nothing read, behind a card still promising an unlock. It goes into the member
context instead — *"asked which part of their business matters most right now,
they chose Revenue"* — which is the use it was always better at. In code it is
`priorityModuleKey`; the column stays `free_module_key`, because renaming it
would need an `alter table ... rename`, and that is not safe in a script re-run
on every deploy.

**4. A member can change their own answers** (ROADMAP §0.9), which cutting
onboarding down made urgent: those four answers were frozen for the life of an
account, and `/onboarding` cannot be reopened even by typing the URL.

A Profile card on the dashboard, above the Business Snapshot and shaped like it.
Its write path is a new `updateMemberProfile` rather than `upsertMember`, which
is wrong for an edit in three silent ways — it rewrites `journey` and
`membership_tier` from its input (so an edit would reset a paying member to the
free tier), it treats blank as "keep what is there" (so a business name could
never be cleared), and it ignores the error it gets back. Each is a test now.

`data/industries.ts` is the one list both forms render, and each option carries
a `grantsKeyword`, because the industry was doing two jobs badly: it is handed
to Grants.gov as the funding search term, so "Finance & Accounting" searched for
a string with an ampersand in it and "Other" searched for the word *other*. The
mapping lives in `normalizeKeyword`, which the nightly refresh now goes through
as well — if those two ever disagree, every search misses the cache, falls back
to a live call, and returns good results while quietly undoing the reason the
cache exists.

**5. Bilingual advice** (was ROADMAP 2.1), **now switched off behind
`BILINGUAL_ENABLED` — see ROADMAP §0.10.** What follows is what is built and
what comes back the day the flag flips; none of it was removed. A
`preferred_language` fact —
English, Simplified Chinese, Traditional Chinese, Spanish, Hmong — on the
Business Snapshot, which is the one form a member can reopen and change. One
directive built in `lib/memberContext.ts` reaches all seven surfaces: three take
it off the member context, three fetch it beside the member read they already
do, so nothing is left answering in English to a member who asked otherwise.

Three rules in that directive are load-bearing, and each protects against a
failure you would not see in a test run:

- **Agency names, form numbers and URLs stay in English** inside the translated
  text. A translated agency name is a search that finds nothing, for a member
  standing at a government form.
- **JSON keys stay in English.** Three surfaces parse the reply; a translated
  key fails as a blank panel, not as an error.
- **The Grill's `confidence` stays one of its three English words.** The route
  matches on that value and falls back to "Medium" when it does not recognise
  it — a translated one shows a confidence level nobody chose.

**It is not verified in the way that matters, which is why it is now off.** The
plumbing is tested; whether the Chinese reads well to a Chinese speaker is not
something this repo can answer, and nobody had read a line of it.
`VERIFY-DEPLOY.md` check 6 is that job, and it is now the gate on the flag
rather than a report on live behaviour: run it on a preview with the flag set
true, and merge the flip only on a pass.

**6. An `opening` column on `conversations`** (was ROADMAP §3), with
`message_count` beside it, both written by `saveConversation` on the same upsert
as the transcript. The drawer and the recall now read five short columns instead
of whole stored chats — twenty of them to draw a list, three more on every AI
request. Safe to denormalise because there is exactly one writer and it replaces
the whole row; if anything ever starts appending turns to an existing row, these
two go stale first.

**Verified:** typecheck, lint, 176 tests and `next build`, all in a clean Linux
container. Then mutation-tested at each stage — twenty-five rules broken one at
a time, every one caught by the test written for it, named in the run. Two things
have no automated test and are `VERIFY-DEPLOY.md` checks 5 and 6 instead: the
drawer, because this repo has no browser harness, and whether the translated
writing is any good, because that needs a person who reads the language.

---

## Still open, in the order I would take them

The Wisconsin entries are done. What is left, in the order I would take it:

**1. `npm audit` — 5 high severity.** Build-chain, not request-path. Its own PR:
`npm audit fix`, then test, lint and build, commit only if all three stay green.

**2. `VERIFY-DEPLOY.md` — seven checks, none run.** Two have been open since PR
#16. All six exist because the mechanism they test fails silently. Checks 5 and
6 cover this session's work and are the only parts of it with nothing automated
behind them — and 6 needs someone who reads the language, not a session.

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

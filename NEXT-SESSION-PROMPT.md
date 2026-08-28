# Next session — WCCC Business Network

Written 2026-08-28, end of session. The previous version of this file was about
merging `feature/memory-loop`; that is done and its contents have moved into
`ROADMAP.md` §0.4.

`ROADMAP.md` is the standing plan. This file is what a fresh session needs to
pick up tomorrow.

---

## Read this first: the schema step is not optional this time

The conversation-history work is committed and pushed — `35e2745`, on `master`.
What sits uncommitted after it is bilingual advice and the `opening` column,
both verified (below), neither committed. **You run the git commands, so nothing
was committed for you.**

```
M data/facts.ts                      preferred_language, five options
M data/assessment.ts                 it appears on the Business Snapshot form
M lib/memberContext.ts               language directive, and the stated priority
M lib/appStore.ts                    opening/message_count written; list reads no transcripts
M app/api/ai/*/route.ts              all six prompts carry the language directive
M app/onboarding/page.tsx            journey and tier questions removed
M app/actions.ts                     journey/tier set server-side, not read from the form
M data/modules.ts                    TIER_GATING_ENABLED = false
M app/dashboard/**  M components/**  no lock badges, no tier counting, priority badge
A data/industries.ts                 one industry list, each with a Grants.gov keyword
A components/MemberProfileCard.tsx   the profile card, and the only way to change those answers
M lib/grantsCache.ts                 one keyword path for both the read and the refresh
M test/appStore.writes.test.ts       +5 tests
M test/grantsCache.test.ts           +3 tests
M supabase-schema.sql                two columns on conversations, plus a backfill
M supabase-verify.sql                103 expected columns, was 101
M test/conversations.test.ts         +4 tests
M test/memberContext.test.ts         +13 tests (176 total, was 151)
M README.md  M ROADMAP.md  M VERIFY-DEPLOY.md  M DEMO-SCRIPT.md
M GOLDEN-LOTUS-PERSONA.md  (and this file)
```

Four commits rather than one — they are independent, and each is worth being
able to revert on its own:

```
git add data/facts.ts data/assessment.ts app/api/ai
git commit -m "Answer members in the language they asked for"
git add supabase-schema.sql supabase-verify.sql
git commit -m "Store a conversation's opening line instead of deriving it"
git add -A
git commit -m "Open every stage to every member, and cut onboarding to four questions"
git add -A
git commit -m "Let a member change their own profile, and fix what industry searches for"
git push
```

`lib/memberContext.ts` and `lib/appStore.ts` carry changes belonging to more than
one of those, so they land wherever `git add -A` picks them up. If you would
rather not think about it, commit everything as one — the three messages above
still describe what changed.

**Then re-run `supabase-schema.sql`, followed by `supabase-verify.sql`.** This
release adds `opening` and `message_count` to `conversations` and backfills the
rows already stored. Until it is applied, the list read asks for two columns
that do not exist and fails — so the Coach's history drawer goes *empty*, on a
member whose transcripts are all safely stored. `supabase-verify.sql` should
report 103 columns and every row `ok`.

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

**5. Bilingual advice** (was ROADMAP 2.1). A `preferred_language` fact —
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

**It is not verified in the way that matters.** The plumbing is tested; whether
the Chinese reads well to a Chinese speaker is not something this repo can
answer. `VERIFY-DEPLOY.md` check 6 is that job. Don't announce the feature until
someone has read real output.

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

**1. `npm audit` — 5 high severity.** Build-chain, not request-path. Its own PR:
`npm audit fix`, then test, lint and build, commit only if all three stay green.

**2. `VERIFY-DEPLOY.md` — six checks, none run.** Two have been open since PR
#16. All six exist because the mechanism they test fails silently. Checks 5 and
6 cover this session's work and are the only parts of it with nothing automated
behind them — and 6 needs someone who reads the language, not a session.

**3. A feedback loop on answer quality.** `ROADMAP.md` §2.1. An `ai_feedback`
table and two buttons under Coach replies, Grill briefs and step reviews.
Nothing currently records whether any answer was useful, which means every
prompt change — including this session's language directive — is being made on
taste.

**4. Free-text fact extraction.** Still deliberately excluded; the reasoning
moved to `ROADMAP.md` §4.

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

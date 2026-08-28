# Next session — WCCC Business Network

Written 2026-08-28, end of session. The previous version of this file was about
merging `feature/memory-loop`; that is done and its contents have moved into
`ROADMAP.md` §0.4.

`ROADMAP.md` is the standing plan. This file is what a fresh session needs to
pick up tomorrow.

---

## Read this first: the work is uncommitted, and master is clean

`master` and `origin/master` are both at `e39cdf1`. Nothing is unmerged and no
branch is outstanding. What is outstanding is eight modified files in the
working tree, all from this session, all verified (below) and none committed —
**you run the git commands, so nothing was committed for you.**

```
M app/api/conversations/route.ts     GET: list, and one transcript to reopen
M app/api/ai/coach/route.ts          accepts conversationId, passes it to the context
M components/AICoach.tsx             the "Past chats" drawer
M lib/memberContext.ts               earlier conversations in the shared context
M test/memberContext.test.ts         +9 tests (151 total, was 142)
M README.md  M ROADMAP.md  M VERIFY-DEPLOY.md  (and this file)
```

It is one coherent change and reads well as one commit. Something like:

```
git checkout -b feature/conversation-history
git add -A
git commit -m "Let members see and delete their stored conversations"
git push -u origin feature/conversation-history
```

**No schema change this time.** Nothing new to run in Supabase — but if
`supabase-schema.sql` has not been re-run since the memory-loop merge, do that
first, or none of this has anything to show. `supabase-verify.sql` should report
101 columns and every row `ok`. Until then a member chats, the Coach answers,
"Past chats" stays empty, and nothing anywhere says why.

---

## What was built

Items 1 and 2 of the previous handoff, which were the two halves of the same
thing: the portal had started keeping transcripts that members could not see,
and was not reading them back either.

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

**Verified:** typecheck, lint, 151 tests and `next build`, all in a clean Linux
container. Then mutation-tested — six rules broken one at a time, each caught by
the one test written for it, named in the run. The drawer itself has no test:
this repo has no browser harness, so it is `VERIFY-DEPLOY.md` check 5 instead.

---

## Still open, in the order I would take them

**1. Bilingual advice.** `ROADMAP.md` §2.1. A `preferred_language` fact and one
line in each system prompt. Small in code; probably the widest-reaching thing
left for this membership. Keep agency names, form numbers and URLs in English —
that is what a member has to type into a government site.

**2. An `opening` column on `conversations`.** `ROADMAP.md` §3. Written at save
time from the first member turn, with a `message_count` beside it. Both the
drawer and the coach's recall currently read whole transcripts to derive two
values from them, which is why the recall is capped at three conversations.
Schema change, so: `alter table ... add column if not exists`, a backfill for
rows already stored, and a regenerated `supabase-verify.sql`, in the one PR.

**3. `npm audit` — 5 high severity.** Build-chain, not request-path. Its own PR:
`npm audit fix`, then test, lint and build, commit only if all three stay green.

**4. `VERIFY-DEPLOY.md` — five checks, none run.** Two have been open since PR
#16. All five exist because the mechanism they test fails silently. Check 5 is
the new drawer, and is the only part of this session's work with nothing
automated behind it.

**5. Free-text fact extraction.** Still deliberately excluded; the reasoning
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

# Roadmap — making the AI advice better, cheaper and more trustworthy

Written 2026-08-25. Companion to `NEXT-SESSION-PROMPT.md`, not a replacement:
that file is the handoff for the work in flight, this one is the standing plan
for where the AI features go next. When an item here is built, delete it from
here and let the commit history carry it.

---

## 0. Where the AI stands today

Seven surfaces, all fed from one shared description of the member
(`lib/memberContext.ts`):

| Surface | Route | Output |
| --- | --- | --- |
| AI Coach | `app/api/ai/coach` | Freeform chat, module-aware when mounted on a module page |
| Decision Grill | `app/api/ai/grill` | One question at a time, then a JSON-validated decision brief |
| Review Step | `app/api/ai/review-step` | Strongest point / gap / Wisconsin tip |
| Module Summary | `app/api/ai/summarize-module` | Saved prose artifact per module |
| Toolkit Documents | `app/api/ai/document` | A real document built from the member's own answers |
| Funding & Programs | `app/api/ai/opportunities` | Selection from a retrieved catalog, never recall |
| Fact extraction | `app/api/ai/extract-facts` | Proposals drawn from a chat, each quoting the member, none saved without a tap |

Three decisions already made that the rest of this file builds on:

1. **One member context, not six.** Adding a fact lights it up on every surface
   at once. Written as "they told us X", with staleness marked, because all of
   it is self-reported.
2. **Select, don't recall.** `lib/opportunityCatalog.ts` hands the model a
   numbered catalog and takes back references. A program that isn't in the
   catalog has nothing to resolve to, so it cannot reach a member. The guarantee
   is structural, not a line in a prompt.
3. **Spend is capped and visible.** `lib/aiRateLimit.ts` enforces per-route and
   total daily caps and fails open; `logUsage` in `lib/ai.ts` prints what every
   call actually cost, including whether prompt caching hit.

Everything below is an extension of one of those three, not a new direction.

---

## 0.4 The memory loop, merged

`feature/memory-loop` fast-forwarded into master on 2026-08-28. Three commits:

| Commit | What |
| --- | --- |
| `865d56e` | Token counts persisted on `ai_usage`; the rate limiter's three round trips cut to two. |
| `156b0a3` | Coach replies stream as they are written. |
| `5e3f019` | Conversations stored; a conversation can propose profile facts for the member to confirm. |

It needs `supabase-schema.sql` re-run — a whole table (`conversations`) and four
columns on `ai_usage`. Until it is, saving a conversation and recording spend
both fail silently: the member chats, the Coach works, and nothing is kept.
`supabase-verify.sql` should report 101 columns and every row `ok`.

Item 2.3 was built by this and has been deleted from below. Item 2.2 was not:
there is still no `ai_feedback` table and no rating on any answer.

---

## 0.5 Shipped, and what it still needs from a person

Three changes merged into master as `4509af1` (fast-forwarded, no merge commit):

| Commit | What |
| --- | --- |
| `3d4acd4` | Every AI surface sees the member's saved decision briefs, module summaries and generated documents. |
| `517d425` | Grants.gov read from a daily-warmed `grants_cache` table instead of live on every search; an outage now shows stale-but-labelled listings instead of an empty panel. |
| `4509af1` | The Coach, Grill and document generator answer Wisconsin specifics from verified material or decline, instead of from the model's memory. |

**Two configuration steps, both outside the repo, and nothing depends on them
being done in the same sitting:**

1. `CRON_SECRET` in Vercel → Settings → Environment Variables, then redeploy.
   Until it is set `/api/cron/refresh-grants` answers 503 and refuses to run —
   deliberately, because the alternative is a public endpoint that fires
   outbound requests at a free API for anyone who guesses the path. Nothing
   else breaks meanwhile; searches simply keep hitting Grants.gov live, which
   is what they did before.
2. Re-run `supabase-schema.sql`, then `supabase-verify.sql`. The three
   `grants_cache` rows should read `ok`. Same degradation until then: the cache
   reads return null and every search falls through to a live call.

Then `VERIFY-DEPLOY.md`, whose two oldest checks have been open since PR #16 and
are now running on a deploy that has changed considerably.

---

## 0.6 The other half of the memory loop

Storing a member's chats without showing them to that member was the one part of
the loop that did not land with the rest, and it was the half that made the
storage defensible. Built on 2026-08-28, no schema change:

- **The Coach has a history drawer.** "Past chats" beside the heading lists what
  is stored — opening line, module, message count, date — and reopens or deletes
  any of it. Deleting detaches the id from the chat on screen, because
  `saveConversation` upserts on whatever id it is handed and would otherwise
  recreate the row on the member's next message.
- **The Coach reads what it stored.** `lib/memberContext.ts` puts the openings
  of up to three earlier conversations into the shared context and tells the
  model plainly that openings are all it has. The chat in progress is excluded
  by id, which is what keeps the cached prompt prefix stable across a
  conversation.

That last cost was paid off the same day — see 0.7.

---

## 0.7 Bilingual advice, and the read that paid for it

Both built on 2026-08-28, after 0.6. **This pair needs `supabase-schema.sql`
re-run** — two columns on `conversations`, and `supabase-verify.sql` now expects
103 columns rather than 101.

**Bilingual advice (was 2.1).** A `preferred_language` fact — English,
Simplified Chinese, Traditional Chinese, Spanish, Hmong — set in the Business
Snapshot, which is the one form a member can reopen and change. One directive,
built once in `lib/memberContext.ts`, reaches all seven AI surfaces: the three
that build a member context get it on the context, and the three that read only
the member row fetch it alongside that read, so it costs no latency and no
surface is left answering in English to a member who asked otherwise.

What the directive spends its words on is the part that matters. Agency names,
program names, form numbers and URLs stay in English inside the translated text,
because a translated agency name is a search that returns nothing for a member
standing at a government form. JSON keys stay in English, because three surfaces
parse the reply and a translated key fails as a blank panel rather than as an
error. And the Grill's `confidence` is pinned to its three English words: the
route matches on that value and silently falls back to "Medium", so a translated
one would have shown a member a confidence level nobody chose.

**Still unverified in the way that matters.** The plumbing is tested and
mutation-tested; whether the Chinese reads naturally to a Chinese speaker is not
something this repo can answer. House rule stands — do not claim the feature
works until a speaker has read real output.

**An `opening` column on `conversations` (was in section 3).** `opening` and
`message_count`, written by `saveConversation` on the same upsert as the
transcript. The history drawer and the coach's recall now read five short
columns instead of whole stored chats — twenty of them to draw a list, three
more on every AI request. Existing rows are backfilled by the migration; a row
that escapes it reads as an untitled conversation rather than breaking.

---

## 0.8 Onboarding cut down, and tier gating switched off

Built 2026-08-28, on WCCC's direction: give every member everything. No schema
change.

**Two questions left the onboarding form.** "Which journey interests you most?"
had one possible answer and was already hiding itself — the personal track has
no guided steps and is off. "Choose your membership" decided which roadmap
stages opened, on the honour system, with no payment anywhere in the flow; it
asked someone to price themselves before they had seen anything. What is left is
name, business, industry and city — only what the portal cannot start without.
`completeProfileAction` sets the business track and the network tier itself, and
reads neither from the form.

**Tier gating is off.** `TIER_GATING_ENABLED` in `data/modules.ts`, a flag in
the same shape as `PERSONAL_TRACK_ENABLED`, not a deletion: every module keeps
its `minTier`, `tierMeetsMinimum` still answers honestly, and paid stages come
back with a one-line change if anyone ever wants them. The public site still
sells memberships and `members.membership_tier` is still stored — it is now a
record of what WCCC has been paid rather than a self-declared access level, and
the dashboard badges it only for members who actually hold one.

**The Business Snapshot's priority answer found a better job.** Unlocking one
module free was all it did, so switching gating off would have left it stored
and unread, with the card still promising an unlock. It now goes into the shared
member context — *"asked which part of their business matters most right now,
they chose Revenue"* — so every AI surface leads with what the member said they
are working on. The field is `priorityModuleKey` in code; the column is still
`free_module_key`, because renaming it would need an `alter table ... rename`,
which is not safe in a script re-run on every deploy.

---

## 0.9 A member can change their own answers

Built 2026-08-28, straight after 0.8, because cutting onboarding down made the
gap it exposed worse: those four answers were frozen for the life of an account.
`/onboarding` redirects to the dashboard the moment `industry` is set, so it
could not be reopened even by typing the URL, and nothing else wrote those
columns. No schema change.

**A Profile card on the dashboard**, shaped like the Business Snapshot card and
sitting above it. Name, business, industry, city; email shown read-only because
Clerk owns it.

**Its own write path, `updateMemberProfile`.** `upsertMember` was the obvious
thing to reuse and is wrong for an edit in three ways, each of them silent:
it writes `journey` and `membership_tier` from its input every time, so an edit
would have reset a paying member to the free tier whenever they fixed a typo;
it treats blank as "keep what is there", so a member could never clear their
business name once set; and it ignores the error it gets back, which is
survivable behind a redirect and a lie behind a form that says "Saved". Each of
those is now a test.

**Industry stopped doing two jobs badly.** `data/industries.ts` holds the one
list both forms render, and gives each option a `grantsKeyword` — the label a
member recognises and the query that finds them federal money are different
strings. "Finance & Accounting" was being searched for verbatim, ampersand and
all; "Other" searched Grants.gov for the word *other*. The mapping lives in
`normalizeKeyword`, which both the read path and the nightly refresh now go
through, because if those two disagree the cache misses every time, falls back
to a live call, returns perfectly good results, and silently undoes the reason
`lib/grantsCache.ts` exists.

---

## 1. Blockers to clear before new AI work

None of these is a hard stop any more — the lockfile one was, and it landed
in `c75f76c`, so PR #17 merged and master builds.

**1.2 — Verify some Wisconsin entries.** All nine are `verified: false`, so the
Wisconsin half of the funding panel is empty and Grants.gov is the feature's
only source — if it is unreachable the panel goes dark. This is human
confirmation, not research: `WISCONSIN-PROGRAMS-REVIEW.md` has the table, and
every description was already machine-checked against its URL on 2026-08-23.
Verifying two or three before launch is enough to remove the single-source risk.
Row 9 needs a decision rather than a check.

**1.3 — `npm audit`: 5 high-severity.** postcss and sharp via Next, plus
js-yaml and nanoid. Build-chain, not request-path, so it is not urgent. Its own
PR: `npm audit fix`, then `npm test`, `npm run lint`, `npm run build`, commit
only if all three stay green. Never folded into a feature PR.

**1.4 — `maxDuration` on the remaining AI routes.** `opportunities` sets 60;
`coach`, `grill` and `document` run on the platform default. They work today.
`document` is the slowest generation in the app and is the first place to look
if a member reports it hanging.

---

## 2. The AI roadmap, in priority order

Each item states the problem before the fix, because in six months the fix will
be obvious and the reason for it will not.

### 2.1 — A feedback loop on answer quality

**Problem.** Nothing records whether any AI answer was useful. Prompt changes
are therefore made on taste, and a hallucination that slips past the structural
defences is invisible unless a member happens to mention it.

**Fix.** One `ai_feedback` table — member, route, rating, optional note,
timestamp — and a two-button row under Coach replies, Grill briefs and step
reviews. No runtime cost beyond one insert, and the insert is fire-and-forget.

**Watch for.** Add the `create table` and the matching `alter table ... add
column if not exists` guards in `supabase-schema.sql` in the same PR, and
regenerate `supabase-verify.sql`, or this joins the list of features that fail
silently when the table is missing. Store the route and the model, so a rating
can be read against what actually produced it. Do not store the full prompt.

**Size.** Small, but it touches the schema, so it follows the schema rules in
`README.md` exactly.

### 2.2 — Tell the member what to do next, unprompted

**Problem.** Every surface waits to be asked. A member who does not know what to
ask gets nothing, and those are the members the portal is most for.

**Fix.** Compute the next actions deterministically from what is already known —
a compliance deadline approaching in `lib/deadlines.ts`, a module stalled
part-way, a fact past its confirm-by age, a funding match never followed up —
and let the model only write the phrasing. Select, don't recall, applied to the
member's own situation instead of to a catalog.

**Watch for.** The selection must be code, not the model, or this becomes a
generic nag. Cap it at two or three items. Never invent a WCCC program, event
or perk to fill space — house rule, and this is the surface most tempted to
break it.

**Size.** Medium. The deadline maths already exists.

---

## 3. Efficiency work, worth doing but not urgent

The first item that lived here — "Grants.gov is called on nearly every click" —
has been built; see section 0.5. What is left is genuinely minor, and none of it
is worth a release on its own.

- **A cheaper model for the short routes.** `review-step` returns three
  sentences. An `ANTHROPIC_MODEL_FAST` env var, read per route with the current
  default unchanged, keeps the existing behaviour when unset and makes the
  swap a dashboard change rather than a deploy. `summarize-module` is a
  candidate too; `document` and `grill` are not.
- **The rate limiter costs two round trips.** It was three; `865d56e` folded the
  two counts into one, leaving a count and an insert before the model is called
  at all. A single Postgres function returning the counts *and* recording the
  attempt would make it one. Keep the fail-open behaviour exactly as it is.
- **Six `select("*")` calls in `lib/appStore.ts`.** Considered and skipped
  twice now: naming columns by hand without a live database to test against
  risks a runtime break on the dashboard for a small win. Worth doing with a
  database in front of you, not before.

---

## 4. Deliberately not started

**The member directory — shelved, and probably for good.** `DIRECTORY-DESIGN.md`
is a complete proposal and no code was ever written against it. It is parked
because of what this site is for, not because the design is unfinished.

Asked to decide how members would contact each other, the answer was that they
largely don't — and where they do, it happens in the WCCC hub. This site is a
technical assistant for owners who need answers to their own problems, not a
networking directory. A feature that exists to connect members to each other is
solving a problem this portal does not have, and it would carry the heaviest
privacy burden in the repo to do it: consent handling, a server-side read path
that structurally cannot return non-consented data, and a standing obligation to
keep both correct.

The document stays for the reasoning in §0 and §1, both of which are worth
reading before publishing member data anywhere for any reason. Revisit only if
someone asks for member-to-member search *on this site* specifically.

**Free-text fact extraction.** `lib/factExtraction.ts` proposes facts only from
the answers a member picked, never from prose they typed. A wrong
`monthly_costs` lifted out of a sentence looks exactly as plausible on a
confirmation card as a right one, and that card is the only thing standing
between a guess and the member's profile. Worth revisiting after watching the
confirmation flow work on real conversations, not before — one line per fact in
`isExtractableFact` when it is.

> An earlier version of this section listed "persisting Coach chat history
> across visits" as deliberately not started, reasoning that a member's saved
> artifacts are the durable part of a conversation and the transcript is not.
> That was reversed and built — see 0.4 and 0.6. The reasoning turned out to be
> half right: the transcript is still not what the assistant reads back, only
> the opening lines are.

---

## House rules these all inherit

- Comments explain *why*, including why the alternative was rejected. Several
  apparent bugs are deliberate and documented — read the comment first.
- Never invent WCCC programs, events, partners or perks. If something is not
  verified, say so on screen rather than filling the gap.
- Schema changes ship with their `alter table ... add column if not exists`
  migration and a regenerated `supabase-verify.sql`, in the same PR.
- Verify before claiming: typecheck, lint, test and build before saying
  anything works.
- The user runs all git commands.

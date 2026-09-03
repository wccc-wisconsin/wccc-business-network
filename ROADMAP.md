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

**Still unverified in the way that matters, and therefore switched off.** The
plumbing is tested and mutation-tested; whether the Chinese reads naturally to a
Chinese speaker is not something this repo can answer, and nobody had read a
line of real output. `BILINGUAL_ENABLED` in `data/facts.ts` — see 0.10.

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

## 0.10 Bilingual answers switched off behind a flag

Built 2026-08-29. No schema change, and nothing about 0.7 was removed.

`BILINGUAL_ENABLED` in `data/facts.ts`, third in the same family as
`TIER_GATING_ENABLED` and `PERSONAL_TRACK_ENABLED`. Off, because the one check
that matters had never been run: the plumbing was tested but no person who reads
Chinese had read a line of the output, and this is a Chinese chamber of
commerce — the members most able to notice awkward Chinese are exactly the ones
who would be reading it, about tax filings and legal deadlines. Empty is
recoverable; wrong is not.

**Off means four specific things,** each of them a test in
`test/bilingualFlag.test.ts`:

- `buildLanguageDirective` returns `""` for every language the catalog offers.
  The check sits in that function rather than in its two callers, so an eighth
  AI surface written next year cannot switch the feature back on by accident.
- The Business Snapshot does not ask the question. `profileQuestions` in
  `data/assessment.ts` is both the rendered form and the set of keys
  `saveBusinessAssessmentAction` will store, so dropping the key closes the
  question and the write path together — hiding the field in the card alone
  would have left a hand-made POST able to store a language nobody can see.
- `memberLanguageDirective` answers without reading. It costs no latency where
  it is used, but three routes issuing a query per request for a value they
  cannot act on is exactly the kind of cost nobody finds later.
- The fact definition stays. A value stored before the flag went off still
  resolves to a label rather than rendering as a raw `zh-Hant`, and it is left
  in the database untouched, so flipping the flag restores that member's choice
  instead of asking them again.

**Why a flag and not a deletion.** Removal was a diff across seven routes, the
fact catalog, the assessment and their tests, to be written again from scratch
the week someone spends twenty minutes reading output — and for this membership
that review is a phone call. The tests for what the directive *says* are
`describe.skip`ped rather than deleted, so vitest reports them in every run and
they re-arm unedited when the flag flips. Verified by flipping it: 183 pass, 4
skip, no test file touched.

**To turn it on:** `VERIFY-DEPLOY.md` check 6, run on a preview deploy with the
flag set true. A pass is the approval to merge the flip.

---

## 0.11 The Wisconsin entries went live

2026-08-29. Eight of the nine signed off, the ninth dropped, no schema change.

The catalog file's whole design is that a person decides, so the interesting
part is what deciding turned up. Re-reading the eight against their own sites
before writing the date in changed two of them:

- **Supplier diversity had a wrong claim, twice confirmed.** The entry said the
  5% bid preference is for DVB firms only — which is what the program's home
  page says, and why two previous passes recorded it as correct. The State
  Procurement Manual (PRO-606) has it as a *permissive* MBE/DVB preference with
  the MBE half currently paused. The entry now points at the policy instead of
  quoting a figure, because a number with a moving part in it is exactly what
  rule 3 in `data/wisconsinPrograms.ts` exists to keep out.
- **WEDC claimed something unverifiable.** "publishes which are currently open"
  could not be checked — the programs directory renders client-side. Softened.

**The ninth was dropped rather than verified.** "County and municipal revolving
loan funds" is a category, not an organisation: no single page describes it, and
it pointed at WEDC as a stand-in, so a member clicking it arrived at somewhere
that does not run the thing they clicked. Per-county entries for the counties
WCCC members are actually in are the useful replacement, and each needs its own
confirmation.

**One real bug fell out of it.** `programLines()` in `lib/adviceCatalog.ts`
called `activeWisconsinPrograms()` with no argument, so it filtered against
wall-clock time while the deadline half of the same reference block honoured the
`now` it was passed. Invisible while every entry was unverified — the list was
empty either way — and live the moment they were not. `now` is threaded through
now, which is the guarantee `lib/memberContext.ts` already documents for
deadlines: one instant per block, never two.

**The tests moved with it.** Six in `test/wisconsinPrograms.test.ts` asserted,
directly or by counting, that the file shipped with nothing verified, and one in
`test/adviceCatalog.test.ts` was written as `if (!anyVerified)` — which passed
by doing nothing the moment entries were verified. The filter is tested against
a fixture now and the shipped rows are checked separately as data, including
that no description contains a date, a dollar figure or a percentage that is not
the statutory ownership test.

**The expiry now warns before it happens.** `2027-02-25` is the last day the
eight entries are shown; from the 26th the Wisconsin panel empties and the Coach
goes back to refusing to name any Wisconsin program, silently, because that is
what the filter is for. A diary entry was the only defence and diary entries get
missed, so `test/wisconsinPrograms.test.ts` now fails **30 days out** with the
date, what breaks, and the two-minute fix. A red test on an unrelated commit
cannot be scrolled past, and the only way to silence it is to re-verify.

`wisconsinVerificationExpiry` keeps the 180-day arithmetic in one place beside
`STALE_AFTER_DAYS`, and its boundary is asserted against the filter's own
boundary so the date printed for a person cannot drift a day from the date the
entries actually vanish.

**And an empty list now says which kind of empty it is.** `wisconsinCatalogState`
answers `ok` / `expired` / `unreviewed`. The panel and the model's reference
block used to say "awaiting review by WCCC" in both empty cases — true before
anyone signed the list off, and misleading afterwards, because it reads as
unfinished rather than out of date and sends the reader to the wrong person for
the wrong task. Three states, three messages: filtered out is the member's own
profile, lapsed is a re-check, unreviewed is a decision nobody has made yet.

---

## 0.12 The funding matcher stopped guessing who a program suits

2026-08-29, straight after 0.11. No schema change.

**The problem, stated plainly.** With the eight entries live, the matcher was
handed all of them for every member and asked to judge fit from four columns —
business name, industry, city, tier. Everything else the portal knows about that
member (entity structure, Business Snapshot stage, employees, bank account,
ownership basis, what they said they were working on, eleven more facts) existed
in `lib/memberContext.ts` and reached the Coach, the Grill and the document
generator, but not this route, which read the `members` row and stopped. It then
wrote a confident *"why this fits you"* from the four — and a sentence written
from four facts reads exactly like one written from sixteen. That is the failure
mode this repo keeps finding: not a wrong answer, a *fluent* one.

**Three changes, and the order matters.**

**1. Entries say who they suit.** Two new fields in
`data/wisconsinPrograms.ts`. `fitNote` is a sentence a person writes about who
an organisation actually helps and who it wastes time for — that WHEDA is no use
before you have a lender, that certification opens nothing on its own, that the
SBDC is rarely a wrong referral. It is the part a chamber knows and a search
result does not. It reaches the model on its own labelled `Suits:` line, never
the member, because it is WCCC's judgement rather than something the
organisation said, and the two must not arrive looking alike.

`requirements` is the machine-checkable half, in the same shape as
`ComplianceAudience` in `data/compliance.ts`. **Only two of the eight carry
one** — WHEDA needs a lender relationship, Supplier Diversity needs qualifying
ownership — and that restraint is deliberate, not unfinished. A requirement
removes a member from help on the strength of one self-reported field. Anything
softer than "this cannot work for you" belongs in `fitNote`, where the model
weighs it, rather than in code, where it disqualifies. There is a test that
fails if a third requirement appears without someone reading that reasoning.

**2. The filter errs toward showing.** `lib/wisconsinFit.ts`, modelled directly
on `audienceVerdict` in `lib/deadlines.ts`, down to the three-way
applies/unknown/no. The interesting part is which way an unknown leans, and both
files lean the same way for the same reason: a deadline hidden from someone it
applies to costs a missed filing; a funding entry hidden from someone who
qualifies costs them the money. So only an answer that *positively* rules a
member out removes anything. An unanswered question, a blank, an unrecognised
value and — specifically — "prefer not to say" all keep the entry. That last one
has its own test: reading a declined answer as "none" would quietly withhold a
certification from exactly the members most likely to decline the question.

**3. The matcher gets the real member context.** `buildMemberContext` replaces
`getMemberById` + `memberLanguageDirective` in the route. This *removes* a query
rather than adding one — the language directive arrives on the context instead
of being fetched beside it — and it is one `Promise.all` either way, so one round
trip. The summary is larger than the five lines it replaced, but it goes in the
user message, which was never the cached half, so prompt caching is untouched.

**Filtering is stated, never silent.** `wisconsinFilteredOut` rides the catalog
out to the panel, which now says "2 Wisconsin programs were left out because
your Business Snapshot says they don't apply to you. Update it if that's
changed." Same principle as `filteredOut` on `MemberDeadlineView`: this runs on
self-reported facts that go stale, and the member is the only person who can fix
it. It also separates two states the old provenance line could not tell apart —
*nothing has been verified yet* (a job for WCCC) and *nothing verified suits you*
(a job for the member's own profile). Telling someone the wrong one sends them
to the wrong place.

**A gap the mutation testing found.** Dropping `fitNote` on the way into the
catalog changed nothing in the whole suite — the notes are the point of the
feature and nothing checked they arrived. `test/opportunityCatalog.test.ts` is
new and covers it, along with the catalog's other untested guarantees: that
Wisconsin refs renumber contiguously after a filter (a gap would resolve `W2` to
the wrong organisation), and that filtering still runs when Grants.gov is down —
the state where the Wisconsin half *is* the whole catalog.

**What this does not do.** It does not rank. For eight entries, ranking in code
would be over-engineering, and the model is genuinely good at ordering once it
can see who the member is. Selection is structural; ordering is judgement.

---

## 0.13 Something finally records whether an answer was any good

2026-08-29. **Schema change — `supabase-schema.sql` must be re-run**, and
`supabase-verify.sql` now expects 112 columns across 17 tables rather than 103.

Was ROADMAP §2.1, and it was the item everything else was waiting on. Nothing in
this portal recorded whether an AI answer helped anyone. Every prompt change,
including all of this week's, was made on taste; a hallucination that slipped
past the structural defences was invisible unless a member happened to mention
it. There is now an `ai_feedback` table and a two-button row under Coach
replies, decision briefs and step reviews.

**`target_key` is the whole design.** A member who taps "yes" and then changes
their mind must leave *one* row saying no, not two that cancel out in every
count anyone ever runs. The client builds the key — `coach:<conversationId>:<i>`,
`grill:<decisionId>`, `review-step:<moduleKey>:<stepKey>` — and a unique index
on `(member_id, target_key)` turns the second opinion into an update. Dropping
that index raises no error anywhere; it silently converts every change of mind
into a second vote, which is why there is a test naming the conflict target.

**It cannot break what it observes.** `saveAiFeedback` returns a boolean and
never throws, the route answers 200 whether or not the row landed, and the
buttons are optimistic and never roll back. A rating is a favour the member is
doing us — the worst outcome is not a lost row, it is a member interrupted by an
error message for having tried to help. Same posture as `logUsage`.

**The route is under `/api/ai` but is not an AI route.** It calls no model and
costs nothing, so it is deliberately exempt from `enforceAiRateLimit`: tapping
thumbs-down twice must not spend a unit of the budget that lets a member ask
another question.

**The model is stamped server-side**, from the same constant `lib/ai.ts` calls
with. A score that fell cannot otherwise be told apart from a prompt that got
worse and a model that changed underneath it. The client neither knows it nor
should — it is a fact about what answered, not about what the member thought.

**What is deliberately not stored:** the prompt, and the answer. Both already
live where the member can see and delete them (`conversations`,
`member_decisions`); a second copy here would be one they did not know about and
could not reach.

**No note box.** The column exists and the route accepts one, but a second step
in front of a one-tap action costs more ratings than the notes are worth.
Revisit once there is a month of counts, not before.

**Verified against a real Postgres 16, not just the mock.** The schema applied
twice in a row (a redeploy is a re-run, and a bare `add constraint` would have
failed the second time — hence the `do $$ ... $$` guard around the rating
check), `supabase-verify.sql` reported ok on all 17 tables, a change of mind
left one row with `created_at` preserved and `rating` updated, an unrecognised
rating was refused by the constraint, and deleting a member took their ratings
with them.

**What it does not do yet: read the data back.** There is no dashboard, no
weekly digest, nothing. That is deliberate — a reporting surface built before
there is a month of real ratings would be designed against imagined data. The
rows are there when someone wants to ask.

---

## 0.14 It went live, and the walkthrough found two bugs

2026-08-30. Deployed as `7399204`; schema applied and verified against the live
database (17 tables, `ai_feedback` at 9 of 9); demo account seeded.

**The deadline filter was confirmed end to end on the live site.** Golden Lotus
sees one filing and the line "9 filings hidden because your profile says they
don't apply to you". Predicted 1-of-9 from the code before looking; got 1 of 9.
That is the first time any of this has been checked against a deployment rather
than a test.

**The funding matcher was broken by §0.12, and the error message lied about
it.** `max_tokens` on `opportunities` stayed at 700 while the same change told
the model to write longer, more specific sentences — so replies truncated, the
JSON did not parse, and the panel reported a *formatting* error. Worse,
`callClaude` only recognised truncation when there was no text at all, so a
reply that started fine and ran out reached the caller as a successful one. The
member was told to try again; trying again truncated identically.

Fixed three ways: the budget raised to 1200, `truncated` added to
`ClaudeResult` so a JSON route can say what actually happened, and
`parseClaudeJson` given a balanced-scan salvage so a model that prefaces its
JSON with a sentence no longer loses everything. A truncated reply still
refuses to parse, deliberately — half an array is three matches presented as
though they were all of them.

**Two rules worth carrying forward:**

- **Changing a prompt to ask for more output is a change to the token budget.**
  They are one decision. §0.12 treated them as two and shipped a dead feature.
- **A failure message that names the wrong cause is worse than a vague one.**
  "Wrong format" sent everyone to inspect a schema that was never wrong. Where
  two causes produce identical wreckage, carry the signal that distinguishes
  them rather than guessing from the debris — the same move as
  `wisconsinCatalogState` in §0.11.

**And mutation testing caught a bad test for the third time in two days.** The
first "bracket inside a quoted value" test passed against a greedy regex as well
as against the balanced scan, so it was not testing what it claimed. Trailing
prose containing a bracket is the case that separates them.

---

## 0.15 The Coach could fail without saying anything

2026-09-02. Reported from the live site: a question is asked, and nothing comes
back. No reply, no error, no clue. Funding & Programs was failing at the same
time with the §0.14 message, which is a separate bug whose fix was written then
and is only now deployed.

**The Coach is the one streamed surface, and streaming has a failure mode the
whole-response routes do not have.** Every path in `streamClaude` yields either
text or an error, so the panel is covered for anything that goes wrong *inside*
the generator. What was not covered is the stream that ends having yielded
neither: a generation cut off before its first token, or frames carrying no
content. `consumeStream` returned "", the caller stored nothing because there
was nothing to store, and no branch anywhere said a word. The member sees the
question they asked and blank space under it.

**Why this one is worse than an error.** An error names a cause and can be put
in a bug report. Blank space is indistinguishable from a message that was never
sent — a member cannot tell it apart from their own mis-click, and neither can
anyone they report it to. It is the failure that destroys the evidence of
itself, which is why it went a week without being diagnosed.

**The fix is one rule:** a stream that produced no text and reported no error
now says so. Guarded on both halves, because a stream that errored before
producing text has already told the member something specific, and replacing
that with "didn't send anything back" would be a downgrade.

**`consumeStream` moved to `lib/coachStream.ts`** so it could be tested at all.
It was a module-local function inside a .tsx component, and the suite runs on
plain modules — the rule was untestable where it lived. No behaviour changed in
the move; the component imports it and its message type.

**Mutation-tested, and the first attempt was wrong.** Breaking the rule with
`!started || (!full && !sawError)` was supposed to fail the "stays silent when a
reply did arrive" test and did not — `started` is true whenever text arrived, so
that mutation never fires on the case it claimed to test. The honest mutation is
dropping the `!full` guard, and that fails the test as intended. Three rules,
three mutations, each caught by the test named for it. That is the fourth bad
mutation caught in three days by insisting on this step.

**What this does not do is explain the blank reply.** It makes the next one
report a cause instead of nothing. The cause itself is still unknown, and the
Vercel logs held nothing because their 24-hour window had lapsed since the last
use. The next Coach message on the deployed site either answers or names its
own failure.


---

## 0.16 The Coach was being cut off mid-word

2026-09-02, from a live screenshot. Asked what licences a caterer needs in
Milwaukee County, the Coach answered *"…you already have a Milwauk"* and
stopped. Reported as "the coach gives no useful information", which is what it
looks like, and is not what it was.

**It was the token ceiling, again, in the other route.** `coach` streamed with
`max_tokens` at 500 — sized when the prompt said "a few short paragraphs" and
the member profile was four lines. Both ends grew. §0.14 drew the lesson from
`opportunities` and the same cap was left standing here: **a prompt changed to
ask for more output is a change to the token budget.** Twice now.

**The cruelty of where it cut.** GROUNDING_RULES tell the model to say plainly
when the reference material does not answer, *and then name the agency, form or
office to check with* — the second clause is the useful half, and it comes last
in the sentence. So the truncation reliably delivered the caveat and ate the
referral. The member got the disclaimer and none of the help, from a prompt
written specifically to make sure they got the help.

**Truncation was invisible to the stream.** `streamClaude` read `usage` off the
final `message_delta` and ignored `delta.stop_reason` sitting beside it. A
completed stream and an exhausted one were byte-identical to the consumer: 200,
ordinary totals, terminal `done`. Now `stop_reason: "max_tokens"` yields an
error event carrying TRUNCATED_REPLY_NOTICE, after the text and before `done` —
reported rather than returned early, because a ceiling hit is not a failure: the
call succeeded, the text is real, and the spend still has to be filed.

**500 → 1200**, sized as `opportunities` was, and the prompt now asks for the
useful part first: the next step, the agency, what to ask it, with any caveat in
one sentence after it. A member who reads two lines should still have something
to act on. Whether that reads better is a judgement only the live site settles —
the mechanism is what is tested here, not the taste.

**Mutation-tested.** Notice deleted, stop reason never read, notice fired on
every reply: each failed the test named for it, and the third also failed "ends
with exactly one terminal event", which is the guard that stops a warning being
attached to answers that are fine.


---

## 0.17 One bad field was throwing away four good matches

2026-09-03, from a second live pass. Funding & Programs returned matches once
and then failed again on a retry with the same profile — and the Coach hit the
raised 1200-token ceiling too.

**The funding panel was all-or-nothing, and that was the intermittency.**
`isSelectionList` was `value.every(...)`: five matches with one missing
`nextStep` rejected the whole reply and told the member the format was wrong.
Which field a model fumbles varies run to run, so the same question worked one
minute and failed the next. That is the worst shape a bug can take — it reads as
the feature being unreliable rather than as something with a cause.

Replaced by `validSelections` in `lib/opportunitySelections.ts`: judge each
entry on its own, drop the bad one, keep the rest, and fail only when nothing
usable arrived. This is the rule `resolveSelections` already applied to
references missing from the catalog — an entry that cannot be trusted does not
become an opportunity, and the ones beside it are untouched. The two halves now
agree instead of contradicting each other. Moved to `lib/` because a helper
inside a route file cannot be tested; `null` still means "not a list at all",
which is a different message from a list that came back empty.

**Raising the Coach cap a second time would have been the wrong fix.** At 1200
the reply ran to roughly nine hundred words against a prompt asking for "a few
short paragraphs" — so the instruction was not binding and the cap was doing the
editing. Truncation is the worst possible editor: it cuts at the end, and the
grounding rules put the useful half at the end. The prompt now carries a hard
200-word limit and the cap is 2000 as a safety net. A reply that still reaches
2000 is the instruction being ignored, and it should surface as the truncation
notice rather than be hidden by a cap raised to swallow it.

**Mutation-tested.** All-or-nothing restored, empty list collapsed into null,
empty ref accepted: each failed the test named for it.

**What is still unmeasured** is whether the answers are any good once they
arrive whole. Two rounds of "the site gives nothing useful" have both turned out
to be truncation and brittle parsing rather than the model or the reference
material. The third round is the one that will actually test the content.

---

## 1. Blockers to clear before new AI work

None of these is a hard stop any more — the lockfile one was, and it landed
in `c75f76c`, so PR #17 merged and master builds.

**1.2 — Verify some Wisconsin entries. Done, 2026-08-29.** Eight are
`verified: true` and the ninth was dropped, so the Wisconsin half of the funding
panel has content and Grants.gov is no longer the feature's only source. The
re-read before sign-off corrected two descriptions — see §0.11 —
which is the argument for having done it rather than trusting the pass before.

**Diarise 2027-02-25.** `STALE_AFTER_DAYS` is 180, so on that date all eight
drop out of the catalog on their own and the panel goes quiet again until
someone re-checks them. That is the mechanism working, not a bug, but nothing
announces it. `WISCONSIN-PROGRAMS-REVIEW.md` carries the date at the top.

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

### 2.1 — Tell the member what to do next, unprompted

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
- **The opportunities route's extra read is gone.** It fetched the language
  directive beside the member row; it now takes both off the member context it
  needed anyway. Listed here because it is the shape the other two items want:
  the saving came from a route asking for the right thing once, not from
  optimising the query it already had.
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

# Roadmap — making the AI advice better, cheaper and more trustworthy

Written 2026-08-25. Companion to `NEXT-SESSION-PROMPT.md`, not a replacement:
that file is the handoff for the work in flight, this one is the standing plan
for where the AI features go next. When an item here is built, delete it from
here and let the commit history carry it.

---

## 0. Where the AI stands today

Six surfaces, all fed from one shared description of the member
(`lib/memberContext.ts`):

| Surface | Route | Output |
| --- | --- | --- |
| AI Coach | `app/api/ai/coach` | Freeform chat, module-aware when mounted on a module page |
| Decision Grill | `app/api/ai/grill` | One question at a time, then a JSON-validated decision brief |
| Review Step | `app/api/ai/review-step` | Strongest point / gap / Wisconsin tip |
| Module Summary | `app/api/ai/summarize-module` | Saved prose artifact per module |
| Toolkit Documents | `app/api/ai/document` | A real document built from the member's own answers |
| Funding & Programs | `app/api/ai/opportunities` | Selection from a retrieved catalog, never recall |

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

Then `VERIFY-DEPLOY.md`, whose two checks have been open since PR #16 and are
now running on a deploy that has changed considerably.

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

### 2.1 — Bilingual advice

**Problem.** This is a Chinese Chamber of Commerce, and the AI is the one part
of the portal that could speak a member's own language at almost no cost.
Today it is English-only. The need is already acknowledged in the data model —
the Launch module's contract-review step asks whether having a document
translated or reviewed in another language would help — but nothing acts on the
answer.

**Fix.** A `preferred_language` fact in `data/facts.ts`, set in onboarding and
changeable in the profile, plus one line in each system prompt. Generated
documents and decision briefs follow the same preference.

**Watch for.** Named Wisconsin resources, agency names, form numbers and URLs
stay in English, because that is what the member will have to type into a
government site. Say so explicitly in the prompt rather than hoping. The
`review-step` and `grill` routes return JSON with fixed keys — translate the
values, never the keys, or the parsers break. Verify with a real speaker before
claiming the feature works; the house rule about not claiming until verified
applies here more than anywhere.

**Size.** Small in code, real in review effort.

### 2.2 — A feedback loop on answer quality

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

### 2.3 — Stream the Coach

**Problem.** Every AI surface is a non-streaming POST that resolves to JSON. On
the Coach — the one surface that reads as a conversation — the member watches a
spinner for the whole generation. It is the cheapest available improvement to
how fast the portal feels, and it changes no advice at all.

**Fix.** Stream the Coach reply, and the Grill's questions. Leave
`review-step`, the Grill brief, `summarize-module`, `document` and
`opportunities` alone: they parse or validate structured output, and streaming
buys them nothing while adding a partial-JSON failure mode.

**Watch for.** The rate limiter must still run before the stream opens. Errors
after the first byte cannot be a 502 any more — decide how a mid-stream failure
renders before writing the route, not after. Prompt caching is unaffected.

**Size.** Medium, mostly client-side.

### 2.4 — Tell the member what to do next, unprompted

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
- **The rate limiter costs three round trips.** Two counts plus an insert before
  the model is called at all. A single Postgres function returning both counts
  and recording the attempt would make it one. Keep the fail-open behaviour
  exactly as it is.
- **Six `select("*")` calls in `lib/appStore.ts`.** Considered and skipped
  twice now: naming columns by hand without a live database to test against
  risks a runtime break on the dashboard for a small win. Worth doing with a
  database in front of you, not before.

---

## 4. Deliberately not started

**The member directory.** `DIRECTORY-DESIGN.md` is complete and two decisions
block any code: contact method (in-portal relay, member-chooses, or plain
email) and reciprocity (must you be listed to browse). Note §0 of that document
— isolation here is application code, not RLS, so the directory needs a
server-side read path that structurally cannot return non-consented data.

**Persisting Coach chat history across visits.** Tempting, and 2.1 gets most of
the benefit for far less: the member's saved artifacts are the durable part of a
conversation, and the chat transcript is mostly not. Revisit only if members ask
for it.

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

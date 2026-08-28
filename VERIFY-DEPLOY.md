# Post-deploy verification

Four checks that can only be answered against the live site. Each one covers a
mechanism that **fails silently** — the app looks fine either way, and the only
difference is whether it is doing the thing it was built to do.

Current on `2b91008`. Run these on the deployed Vercel URL, signed in as a real
member account. They are independent; do them in any order, or one at a time.

Checks 1 and 2 have been open since PR #16. Checks 3 and 4 are new with the
Grants.gov cache.

---

## Check 1 — a guided step saves and survives a reload

**What it proves.** Saving a guided step used to fire two concurrent
read-modify-writes at the same `module_step_progress` row: one wrote the
answers, one wrote the completed flag, and whichever landed second reverted the
other. A member could tick "completed", save, reload, and find the box unticked
— or lose the answer they had just typed. It is now a single upsert
(`saveStepProgress`, `lib/appStore.ts`).

**Steps.**

1. Sign in and open any roadmap module — `/dashboard/roadmap/<module>`.
2. Open a guided step you have **not** already filled in.
3. Type something you will recognise, e.g. `verification test 2026-08-27`.
4. Tick the **completed** checkbox.
5. Save.
6. Hard-reload (Ctrl+Shift+R).

**Pass:** the text is still there **and** the box is still ticked.

**Fail:** either one comes back empty. Note which of the two reverted — that
identifies which write is losing.

> Use a throwaway step, or clear the text afterwards. Whatever you type is saved
> to that member's real record.

---

## Check 2 — prompt caching is actually hitting

**What it proves.** `lib/ai.ts` marks the stable half of the Coach and Grill
prompts with `cache_control: ephemeral`. A cache read costs roughly 10% of the
normal input rate, which on a multi-turn conversation is most of the input bill.
But caching fails *silently*: if the prefix is too short, or the cache expired,
the API returns a perfectly normal response and bills full price. The usage
numbers are the only evidence.

**Steps.**

1. Open the AI Coach in the dashboard.
2. Send a message. Wait for the reply.
3. Send a **second** message in the same conversation, within a few minutes.
4. Vercel → project → **Logs** (Functions) → filter for `callClaude usage`.

**Pass:** first message `cacheStatus: written`, second `cacheStatus: hit`.

| Value | Meaning |
|---|---|
| `written` | Cache created. Expected on the first message. |
| `hit` | Cache read. Expected on the second and later messages. |
| `not-requested` | This route didn't ask for caching. Should never appear for `coach` or `grill`. |
| `skipped (prefix under N tokens)` | Asked for, but the prompt is too short to qualify. |

**Fail — `skipped`:** not a bug, but caching is buying nothing on that route.

**Fail — `not-requested` on coach:** the `{ stable }` form isn't reaching
`callClaude`.

**Fail — second message also `written`:** something in the "stable" half is
varying per request, which defeats the mechanism entirely. The member context
now carries their saved artifacts and their reference material, so a
non-deterministic ordering in either would show up exactly here.

---

## Check 3 — funding searches are reading the cache, not calling Grants.gov

**What it proves.** The whole point of the nightly refresh. If the
`grants_cache` table is missing or the reads are failing, every search falls
through to a live Grants.gov call inside the member's request — the old
behaviour. Nothing errors. It is just slower and goes dark whenever Grants.gov
does, which is what the cache was built to stop.

**Steps.**

1. Sign in → Funding & Programs → **Find matches**.
2. Look at the provenance line under the results.

**Pass:** it reads *"N federal listings from Grants.gov, checked <date>"* with a
real date. Searching twice in a row should be noticeably quicker the second
time, and the date should not change between them.

**Fail — no "checked" date:** `federalFetchedAt` is null, which means the read
returned nothing and the row was written fresh by that request. Once is normal
on a keyword nobody has searched before. Every time means the table is missing
or the write is failing — re-run `supabase-verify.sql` and check the
`grants_cache` row.

**Fail — an amber "Grants.gov couldn't be reached" line:** the fallback is
working as designed, but Grants.gov is unreachable. Worth knowing, not a bug
here.

---

## Check 4 — the cron endpoint is protected and works

**What it proves.** That `CRON_SECRET` is set, and that the job Vercel runs at
09:00 UTC will actually do something. A cron that has never successfully run
looks identical to one that runs perfectly — the site behaves the same either
way until the cached rows go stale.

**Steps.**

1. In a browser, open `<your-site>/api/cron/refresh-grants` directly.
2. Then Vercel → project → **Logs**, filter for `refresh-grants`.

**Pass on step 1:** `401 Not authorised`. That is correct — you are not Vercel's
scheduler and should be turned away.

**A `503 Refresh is not configured` instead** means `CRON_SECRET` is unset, or
was set after the current deployment was built. Set it and redeploy.

**Step 2, after the first scheduled run** (the morning after deploying): look for
`refresh-grants: run complete`. The line reports `succeeded`, `failed` and
`skipped`. Expect `succeeded: 1` on an empty members table — only the generic
`small business` keyword — rising as members join with industries filled in.

**Fail — no log line at all the morning after:** the cron isn't firing. Check
Vercel → project → **Cron Jobs** shows the schedule from `vercel.json`, and that
your plan permits scheduled functions.

---

## Reporting back

"Pass" is enough. For a failure, what actually helps:

- Check 1 — which reverted, the answer text or the completed flag.
- Check 2 — the full `callClaude usage` line from both messages.
- Check 3 — the exact provenance line under the results.
- Check 4 — the status code from step 1, and the `refresh-grants` log line if there is one.

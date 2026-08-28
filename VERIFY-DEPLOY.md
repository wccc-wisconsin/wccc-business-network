# Post-deploy verification — PR #16

Two things shipped in PR #16 that can only be confirmed against the live site.
The code for both is present on `master` (commit `0df6945`) and was reviewed
this session — what these checks prove is that it behaves correctly in
production, where the environment variables and Supabase policies are real.

Run these on the deployed Vercel URL while signed in as a real member account.

---

## Check 1 — guided step saves and survives a reload

**What it proves.** Saving a guided step used to fire two concurrent
read-modify-writes against the same `member_step_progress` row: one wrote the
answers column, one wrote the completed flag, and whichever landed second
reverted the other. A member could tick "completed", save, reload, and find the
box unticked — or worse, lose the answer they had just typed. It is now a
single upsert (`saveStepProgress`, `lib/appStore.ts:696`).

**Steps.**

1. Sign in and open any roadmap module — `/dashboard/roadmap/<module>`.
2. Open a guided step that you have **not** already filled in.
3. Type a distinctive answer into the textarea — something you will recognise,
   e.g. `verification test 2026-08-23`.
4. Tick the **completed** checkbox for that step.
5. Save.
6. Hard-reload the page (Ctrl+Shift+R).

**Pass:** the answer text is still there **and** the completed box is still
ticked.

**Fail:** either one comes back empty or unticked. That means the two writes are
still racing — tell me which of the two reverted and I'll trace it, because the
single-upsert path should make this impossible.

> Do this on a throwaway step, or clear the test text afterwards — whatever you
> type is saved to that member's real record.

---

## Check 2 — prompt caching is actually hitting

**What it proves.** `lib/ai.ts` marks the stable half of each system prompt with
`cache_control: ephemeral`. Anthropic charges roughly 10% of the normal input
rate for a cache read, so on a multi-turn Coach conversation this is most of the
input cost. But caching fails *silently* — if the prompt prefix is under the
minimum cacheable length, or the cache expired between turns, the API returns a
perfectly normal response and just bills full price. The only way to know is the
usage numbers.

**Steps.**

1. Open the AI Coach in the dashboard.
2. Send a message. Wait for the reply.
3. Send a **second** message in the same conversation, within a few minutes of
   the first. (The cache has a short TTL — leave it too long and you will get a
   `written` rather than a `hit`, which is not a failure, just a cold cache.)
4. In Vercel → your project → **Logs** (Functions), filter for
   `callClaude usage`.

**What you're reading.** Each entry looks like this:

```
callClaude usage {
  route: 'coach',
  model: '...',
  inputTokens: 1234,
  outputTokens: 210,
  cacheWrite: 1100,
  cacheRead: 0,
  cacheStatus: 'written'
}
```

`cacheStatus` is the field that matters, and it has four possible values:

| Value | Meaning |
|---|---|
| `written` | Cache was created. **Expected on the first message.** |
| `hit` | Cache was read — you are paying ~10% for that prefix. **Expected on the second and later messages.** |
| `not-requested` | This route didn't ask for caching. Should not appear for `coach` or `grill`. |
| `skipped (prefix under N tokens)` | Caching was requested but the system prompt is too short to qualify. |

**Pass:** first message `written`, second message `hit`.

**Fail — `skipped`:** the system prompt is below the model's minimum cacheable
length. Not a bug, but it means caching is buying nothing on that route and the
threshold in `lib/ai.ts` may need revisiting.

**Fail — `not-requested` on coach:** the `{stable}` form isn't reaching
`callClaude`. `app/api/ai/coach/route.ts:67` should be passing
`{ stable: systemPrompt }`, not a bare string.

**Fail — second message also `written`:** the cache isn't being reused between
turns. Most likely something in the "stable" half is varying per request, which
would defeat the whole mechanism. Send me both log entries and I'll diff them.

---

## Reporting back

For each check, "pass" is enough. For a failure, the useful details are:

- Check 1 — which reverted, the answer text or the completed flag.
- Check 2 — the full `callClaude usage` line from both messages.

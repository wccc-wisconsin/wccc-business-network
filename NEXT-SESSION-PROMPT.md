# Next session — WCCC Business Network

Written 2026-09-04. `ROADMAP.md` §0.15–§0.17 is the long-form account.

**Status in one line: the AI surfaces work, the demo docs are written, and one
commit is sitting unpushed on the user's machine.**

---

## Do this first

### 1. The user pushes what is already verified

Nothing below is deployed until this runs. It is typechecked, linted, built, and
green on 272 tests, with every new rule mutation-tested.

```
git add data/modules.ts test/supportBrief.test.ts DEMO-QUESTIONS.md DEMO-SCRIPT.md app/api/ai/coach/route.ts ROADMAP.md
git commit -m "A one-page support brief a member can hand to WCCC"
git push
```

**The user runs all git commands.** Read-only git from the sandbox leaves a
`.git/index.lock` it cannot delete — it can be renamed into `.git/_stale_locks/`,
which is what previous sessions did. Do not run git from the sandbox at all.

### 2. Ask how the demo went

It was scheduled for 2026-09-04. `DEMO-QUESTIONS.md` has the walkthrough that
was written for it. What to find out:

- Did the **Decision Grill** get used? It has still never been exercised on the
  live site, it makes two model calls where the Coach makes one, and it is the
  highest-risk thing left.
- Did **Your WCCC Support Brief** get generated? New in the last session, never
  run against the real API.
- How many results did **Funding & Programs** return? Five is healthy. Fewer
  means entries were dropped as malformed, which now degrades gracefully rather
  than failing — but it is worth knowing.

---

## What happened last session, and the lesson

Three rounds of "this site gives nothing useful" were **all mechanical, and none
of them were the model or the reference material.**

| | |
| --- | --- |
| Coach returned nothing | A stream ending with no text and no error rendered blank and said nothing. §0.15 |
| Coach stopped mid-word | `max_tokens` 500, then still truncating at 1200. `stop_reason` was never read. §0.16 |
| Funding "wrong format" | `every()` validation threw away four good matches over one malformed field. §0.17 |

**The lesson, stated plainly: this project has no end-to-end check that makes a
real model call.** 272 tests mock every one. So the suite went green through all
three failures and the user found each of them on screen, in front of an
audience. That is the single most valuable thing left to build, and the user has
been told so:

> A script — `npm run smoke` — that asks each AI surface a real question and
> checks three things: the reply finished (`stop_reason` is not `max_tokens`),
> the JSON routes kept all five entries rather than salvaging two, and the text
> names a body from the reference catalog rather than talking generally. It
> needs `ANTHROPIC_API_KEY` in a local `.env.local`, costs a few cents a run,
> and would have caught every one of the three above.

The user has not yet said to build it. Offer it again.

---

## Open, in the order I would take them

1. **The smoke check**, above.
2. **Decision Grill and Module Toolkit on the live site** — still never run.
3. **How the support brief reaches WCCC.** The member now generates a one-page
   brief and it saves to their account. Delivery is deliberately undecided: the
   user has to ask the site's creator whether he wants his email on the site.
   There is **no email infrastructure** in the repo (only `mailto:` links) and
   **no admin/staff concept at all** — `getPortalActivitySummary` exists in
   `lib/appStore.ts` and is wired to no page. Do not assume an admin view
   exists.
4. **Whether the eight funding entries compete with WCCC.** The user raised it.
   Checked: all eight are public agencies or nonprofit advisors (WEDC, WWBIC,
   SBDC, WHEDA, DFI, SCORE, SBA, Supplier Diversity certification) — none are
   chambers or membership bodies. The nearest overlap is SCORE/SBDC free
   advising. It is a positioning judgement for WCCC, not a technical one.
5. **`npm audit` — 5 high severity**, build-chain only. `npm audit fix` is
   lockfile-only and takes it to 0. Its own commit.
6. **Rating buttons have never been clicked on the live site.** `VERIFY-DEPLOY.md`
   check 7. Nothing reads `ai_feedback` back, deliberately — and the user has
   said explicitly he does **not** want an analytics page (member counts, what
   is being asked, how answers are rated). Do not build one.

---

## What the user has said he wants

- The site **demo-ready at any time**, not staged for one event.
- Answers that are **short**. The Coach is capped at 120 words; he pushed back
  twice on length.
- Members able to **send the creator a document** about their wants and
  concerns. Half-built — see item 3.

---

## Environment notes

- The user's `node_modules` is a Windows install, so the sandbox cannot run
  vitest against it. **The recipe that works:** copy `app/ components/ lib/
  data/ test/` plus the root configs into `$HOME/check` in the device sandbox,
  `npm ci`, then `npx tsc --noEmit`, `npm test`, `npx eslint`, `npx next build`.
  Node 22 and npm registry access are both available there. About two minutes.
- `next build` fails on Google Fonts. Stub the two `next/font/google` calls in
  `app/layout.tsx` **in the copy only**. Never commit the stub.
- It also needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` set
  to anything non-empty; `pk_test_stub` / `sk_test_stub` are enough.
- Vercel logs hold **24 hours**. They are empty unless something was triggered
  recently — that is not evidence of a problem.
- The deployed site runs **Clerk in Development mode**. Visible on the live
  sign-in page. Unaddressed, and worth raising.

---

## House rules

- Comments explain *why*, including why the alternative was rejected. Several
  apparent bugs are deliberate and documented — read the comment before fixing.
- Never invent WCCC programs, events, partners or perks. The support brief in
  `data/modules.ts` is explicitly instructed against it, with a test.
- Verify before claiming: typecheck, lint, test, build. Then mutation-test —
  break each new rule and confirm the test meant to catch it fails. It has now
  caught a bad test or a bad mutation on five separate occasions.
- The site is standalone. `contacts`, `public_registrations` and `subscribers`
  in the shared Supabase project belong to the sibling `wccc-platform` site.

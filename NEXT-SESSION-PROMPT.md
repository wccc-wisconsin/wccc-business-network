# Next session — WCCC Business Network

Written 2026-09-04, after the first end-to-end run of the AI surfaces on the
deployed site. `ROADMAP.md` §0.15–§0.17 covers the sessions before this one.

**Status in one line: the Decision Grill, the Support Brief and the answer
ratings have now been used on the live site for the first time, three token
budgets were found to be too small, and the fixes are pushed.**

---

## 2026-09-11 — pre-meeting run, read this before the section below

Ran the demo pre-flight on the live site before a WCCC board meeting. Fixed and
handed to the user to push:

- **Markdown shown literally** — `**` and `#` in Coach replies and toolkit
  documents, not only the Support Brief. Resolved the open choice below by
  neither option: `lib/plainText.ts` cleans the text **at render** (Coach,
  toolkit display and Copy, Grill questions, module summary). Render-side
  because the Coach streams and saved copies get cleaned without a migration.
  11 tests, mutation-tested. The component wiring has no test harness.
- **Grill brief 2200 → 4000.** Truncated twice on a four-answer interview.
- **Documents 1400 → 3000.** Licences & Permits Action List stopped at item 5.
- **Demo persona is now a single-member LLC**, on the live account and in
  `seed-demo-member.sql`.

Found and **not** fixed:

1. **`lib/deadlines.ts` never checks `entity_structure`.** Sole proprietors are
   shown the Wisconsin annual report, which they don't file. That is why the
   persona was switched, not a fix. A real sole-prop member still sees it.
   Careful: nonprofits (nonstock corporations) *do* file with DFI.
2. **Output tokens per word look too high.** 310 words of document hit a
   1400-token ceiling (~4.5 tokens/word; prose is ~1.3). Check the Vercel log
   line `document: reply hit the token ceiling` — if `outputTokens` is far
   above what `textLength` explains, something invisible (thinking blocks?) is
   spending the budget, and that would explain every "budget too small" bug in
   this file. The `callClaude` comment about non-text blocks arriving first
   points the same way. Diagnose before raising any budget again.
3. **The Coach isn't told today's date.** It called a chat from earlier the
   same day "last week". `conversationLines` in `lib/memberContext.ts` gives
   ISO dates with no reference point.
4. **`opportunities/route.ts` says the default timeout is 10s.** Documents took
   ~20s and grill briefs ~30s with no `maxDuration`, so that comment is wrong
   for this deployment.
5. **Funding returned 3 matches, not 5.** Correct by the prompt's own rule
   ("three good matches is correct"). `DEMO-QUESTIONS.md` still says fewer
   than five means dropped entries; it doesn't.

## Do this first

### 1. Confirm what is deployed

Three changes were made this session:

| Change | What it does | State |
| --- | --- | --- |
| `de747fa` | Tell a member when an answer ran out of room, rather than only that it failed | Pushed, deployed, **confirmed working in production** |
| grill budgets 350→700, 1100→2200 | Lets the grill finish a question and a brief | Pushed, and verified by re-running the whole interview |
| opportunities budget 1200→2400 | Lets the funding list finish | **Handed to the user at the end of the session — confirm it went out** |

Check the last one first:

```
git log --oneline -3
```

If "Give the funding list room to finish" is not there, the change may still be
sitting in the working tree. It is typechecked, linted and green on 272 tests.

**The user runs all git commands.** Read-only git from the sandbox leaves a
`.git/index.lock` it cannot delete — it can be renamed into `.git/_stale_locks/`,
which is what previous sessions did. Avoid git from the sandbox.

### 2. Fix the Support Brief's stray asterisks

The one known visible defect. `Your WCCC Support Brief` renders its headings as
literal `**Where I am**` — asterisks and all — because the brief in
`data/modules.ts` asks for markdown headings and `components/ModuleToolkit.tsx`
renders the document as plain pre-wrapped text.

This shows on the single page a member is meant to hand to a WCCC staff member,
and the Copy button carries the markers with it.

Two routes, and **the choice has not been made**:

- **Change the prompt** to ask for plain headings. Smallest change, touches only
  `data/modules.ts`, and no test asserts on the `**` (checked). But it fixes only
  this document — the other six generators may emit markdown too, and nobody has
  looked.
- **Strip the markers server-side** before the text is saved and returned, as a
  small pure function in `lib/`. Fixes every generator at once, cleans the saved
  copy and the clipboard copy as well as the display, and lands where this
  repo's tests actually live — so unlike the route changes, it can be
  mutation-tested. Larger, and needs care not to mangle legitimate content.

Ask the user which. Do not guess — the second is better engineering, the first
is what someone about to demo would want.

---

## What happened this session, and the lesson

The user had an hour before a meeting. The plan was to click through the three
surfaces that had never been run. That was all it took.

| | |
| --- | --- |
| Grill question stopped mid-word | `max_tokens` 350. Raised to 700. |
| Grill brief returned an error | `max_tokens` 1100. Structured output, so a cut-off brief cannot be parsed at all and the member loses the whole interview. Raised to 2200. |
| Funding "Refresh matches" failed | `max_tokens` 1200, already raised once from 700. Raised to 2400. |

**Six failures across this project now, and all six are the same species:** a
ceiling set too low, a validator too strict, or a stream left unhandled. Not the
model. Not the reference material. Not the prompts. When a member says this site
gives nothing useful, **check the budget before touching the prompt.**

**The second lesson, which is less obvious.** The budgets were only found
because the *error message* had been fixed an hour earlier. The grill's failure
used to read "Couldn't put the brief together. Please try again" — the same
shape of message that sent everyone reading the JSON schema last time. Changed
to name truncation, it made the real cause obvious on sight. Better errors are
not polish; they are how the next bug gets found.

**On the smoke check.** It was proposed again at the start of this session and
argued down, correctly. Recorded so it is not re-proposed blindly:

> A script calling `lib/ai.ts` directly would have caught **one** of the three
> bugs above. Truncation handling lives in `lib/ai.ts`, but the funding
> validator lives in the route and the blank-reply render lives in the
> component — both behind Clerk, both unreachable without a session token that
> expires in about a minute. A check worth having has to go through the routes,
> and solving the auth problem is the real cost. It is also not clear it beats
> a person spending three minutes clicking, which is what found all six.

---

## Open, in the order I would take them

1. **The Support Brief asterisks**, above.
2. **The rest of the toolkit and the AI Coach on the live site.** Three document
   generators (90-Day Marketing Plan, First-Customer Outreach, Sales Follow-Up)
   and the Coach have still never been run in production. Given the pattern,
   check `MAX_DOCUMENT_TOKENS` (1400) against a 600-word SOP before assuming it
   is fine.
3. **How the support brief reaches WCCC.** Unchanged: the member generates it and
   it saves to their account. Delivery is deliberately undecided — the user has
   to ask the site's creator whether his email goes on the site. There is **no
   email infrastructure** in the repo (only `mailto:` links) and **no
   admin/staff concept at all**. `getPortalActivitySummary` exists in
   `lib/appStore.ts` and is wired to no page. Do not assume an admin view exists.
4. **`npm audit` — 5 high severity**, build-chain only. `npm audit fix` is
   lockfile-only and takes it to 0. Its own commit.
5. **Clerk is in Development mode on the live site.** Raised twice this session
   and the user pushed back on the repetition — fairly. Not urgent; the badge is
   cosmetic. What actually matters is the user cap on development instances and
   social sign-in running through Clerk's shared credentials. Do not raise it
   again unless asked, or unless real signups approach the cap.
6. **Nothing reads `ai_feedback` back**, deliberately. The user has said
   explicitly he does **not** want an analytics page. Do not build one. Ratings
   were confirmed working this session.

---

## What the user has said he wants

- The site **demo-ready at any time**, not staged for one event.
- Answers that are **short**. The Coach is capped at 120 words. He raised length
  again this session, then judged it "not that big of a deal" — the document
  generators are long because they are documents. Leave it unless he returns to it.
- Members able to **send the creator a document** about their wants and
  concerns. Half-built — see item 3.

---

## Working with this user

He pushes back, and he has been right when he has. Twice this session: on the
smoke check, and on whether the Development-mode warning was worth repeating.
Answer the question he actually asked, concede plainly when he is right, and do
not restate a point he has already heard.

---

## Environment notes

- The user's `node_modules` is a Windows install, so the sandbox cannot run
  vitest against it. **The recipe that works, and did again this session:** copy
  `app/ components/ lib/ data/ test/` plus the root configs into `$HOME/check`,
  **also copy `seed-demo-member.sql`** (`demoSeed.test.ts` reads it from the
  working directory and fails without it), then `npm ci`, `npx tsc --noEmit`,
  `npm test`, `npx eslint`, `npx next build`. Node 22 and npm registry access are
  both available. About two minutes.
- `next build` fails on Google Fonts. Stub the two `next/font/google` calls in
  `app/layout.tsx` **in the copy only** — and give the stub a `subsets?: string[]`
  field, or the typecheck inside `next build` rejects it. Never commit the stub.
- It also needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` set to
  anything non-empty; `pk_test_stub` / `sk_test_stub` are enough.
- **Driving the live site works, and is the highest-value check available.** The
  browser pane cannot sign in — the user has to do that once — after which the
  whole dashboard is reachable. Every navigation needs the site re-approved;
  that is normal, not a failure.
- The deployed site is `https://wccc-business-network.vercel.app`. It was not
  recorded anywhere in the repo, which cost time this session.
- Vercel logs hold **24 hours**. Empty logs are not evidence of a problem.

---

## House rules

- Comments explain *why*, including why the alternative was rejected. Several
  apparent bugs are deliberate and documented — read the comment before fixing.
  Where a comment's reasoning has been overtaken by evidence, **correct the
  comment** rather than leaving a rationale that contradicts the code beneath it.
- Never invent WCCC programs, events, partners or perks. The support brief in
  `data/modules.ts` is explicitly instructed against it, with a test.
- Verify before claiming: typecheck, lint, test, build. Then mutation-test —
  break each new rule and confirm the test meant to catch it fails.
- **Be honest about what cannot be verified.** The route and component changes
  this session have no direct test coverage, because this repo has no route or
  component test harness — all 272 tests cover `lib/` and `data/`. Say so rather
  than implying the suite covers them.
- The site is standalone. `contacts`, `public_registrations` and `subscribers` in
  the shared Supabase project belong to the sibling `wccc-platform` site.

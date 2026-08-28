# What changed this week — WCCC member portal

Week of 21–27 August 2026. Written to be read aloud in about ten minutes.

**In one line:** the AI stopped guessing and started remembering.

---

## The two problems we set out to fix

**It made things up.** Asked to suggest funding, the assistant listed programs
from memory. Some had closed years ago. Some never existed. Nothing in the
system could tell the difference, and neither could a member — they'd only find
out after wasting an application.

**It forgot everything.** A member could spend an hour explaining their
business and come back the next day to a blank slate. Every visit started from
nothing.

Both are now fixed at the level of how the system works, not by asking the AI
more politely.

---

## What a member notices

**Funding suggestions are real, and checkable.** Every listing is retrieved
from Grants.gov or from a list someone at WCCC has verified. The assistant picks
from that list — it can no longer name a program that isn't on it. Each result
shows where it came from and when it was last checked.

**Answers about Wisconsin rules come with a source.** Filing dates, fees and
deadlines now come from a verified list, filtered to that member's own
situation, with the agency named. When we don't have the answer, it says so and
points at who to ask — instead of producing a confident figure.

**The assistant knows what they've already done.** It can see their saved
decision briefs, module summaries and generated documents. Someone who spent
twenty minutes working through a lease decision no longer has to re-explain it
in the next conversation.

**Replies appear as they're written** instead of after a ten-second wait.

**Coming next, built but not yet live:** the coach offers to save what it
learned. *"You mentioned two people on payroll — save this to your profile?"*
The member taps yes or no. Nothing is ever saved without them saying so.

---

## What changed underneath

**Funding data is fetched once a night, not once per click.** Before, every
search called Grants.gov live while the member waited. Now an overnight job
keeps the data ready. Faster, and if Grants.gov is down members see yesterday's
list clearly labelled rather than an empty page.

**We can now see what the AI costs.** Per member, per feature. Previously we
capped the number of requests without knowing what any of them cost.

**A test suite, from nothing.** 142 automated checks. Every one of them was
also deliberately broken once to confirm it actually catches the problem it
claims to.

---

## Where things stand

| | |
| --- | --- |
| **Live now** | Verified funding, sourced Wisconsin answers, nightly data refresh, assistant sees past work |
| **Built, awaiting deploy** | Streaming replies, cost tracking, conversation memory |
| **Needs WCCC** | Verifying nine Wisconsin programs |

---

## The one thing we need from the chamber

**Nine Wisconsin programs are waiting on a human check.** WEDC, WWBIC, SBDC,
WHEDA, DFI, SCORE, SBA, the state Supplier Diversity Program, and county loan
funds.

Every description has been checked against the organisation's own website. What
we can't do by machine is decide whether we'd actually send a member there. So
each one needs someone here to open the link and say yes.

**This is about fifteen minutes**, and until it's done the portal shows no
Wisconsin programs at all — deliberately. We chose to show nothing rather than
show something nobody had checked. The checklist is in the repository as
`WISCONSIN-PROGRAMS-REVIEW.md`.

One of the nine needs a decision rather than a check: "county revolving loan
funds" isn't a single program with a single web page. Either we drop it, or we
list the specific counties where our members actually are.

---

## The principle worth stating out loud

The portal will not tell a member something nobody has verified.

That's why the Wisconsin section is currently empty, why funding results carry
a "checked on" date, and why the assistant says "I don't have that figure, WI
DFI publishes it" instead of guessing. A chamber's recommendation carries our
name on it. Empty is recoverable; wrong is not.

---

## Next

1. Deploy the three finished changes
2. A screen where members can read and delete their own saved conversations
3. Bilingual advice — Chinese-language answers, which for this membership may
   reach more people than anything else on the list

Full technical detail is in `ROADMAP.md` and `NEXT-SESSION-PROMPT.md`.

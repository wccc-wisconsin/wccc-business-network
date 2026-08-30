# What changed this week — WCCC member portal

Week of 21–28 August 2026. Written to be read aloud in about ten minutes.

**In one line:** the AI stopped guessing, started remembering, and the portal
stopped locking members out of the help it was built to give them.

---

## The three problems we set out to fix

**It made things up.** Asked to suggest funding, the assistant listed programs
from memory. Some had closed years ago. Some never existed. Nothing in the
system could tell the difference, and neither could a member — they'd only find
out after wasting an application.

**It forgot everything.** A member could spend an hour explaining their
business and come back the next day to a blank slate. Every visit started from
nothing.

**It held most of itself back.** Six of the seven roadmap stages were locked
behind a membership tier the member chose for themselves during sign-up, with
no payment involved anywhere. It gated nothing that needed gating and asked
someone to price themselves before they'd seen anything.

All three are now fixed at the level of how the system works, not by asking the
AI more politely or by changing the wording on a page.

---

## What a member notices

**Everything is open to everyone.** All seven stages, every AI tool, whatever
they pay. The tier question is gone from sign-up entirely. Membership is still
sold on the public site and we still record who has paid — it simply no longer
decides what anyone can open.

**Funding suggestions are real, checkable, and now filtered to the member.**
Every listing is retrieved from Grants.gov or from the list of eight Wisconsin
organisations someone at WCCC has now verified.

Two of those eight are removed automatically when a member's own answers say
they cannot use them — the WHEDA loan guarantee, which only works through a
lender you already have, and the state certification, which only helps an owner
whose ownership qualifies. The portal says when it has done this and why, so a
member whose details have changed can correct them rather than wondering where a
program went. Everything else is shown to everyone: the filter only removes on a
clear no, never on a blank or a "prefer not to say".

The bigger change is what the matcher can see. It used to pick funding knowing a
member's business name, industry, city and tier. It now sees what the portal
actually knows — their stage, their business structure, whether they have staff
or a bank account, what they said they were working on — and each Wisconsin
entry now carries a line, written by a person, about who it genuinely helps and
who it wastes time for. "Why this fits you" used to be written from four facts
and read exactly like a sentence written from sixteen. The assistant picks
from that list — it can no longer name a program that isn't on it. Each result
shows where it came from and when it was last checked.

**Answers about Wisconsin rules come with a source.** Filing dates, fees and
deadlines come from a verified list, filtered to that member's own situation,
with the agency named. When we don't have the answer it says so and points at
who to ask, instead of producing a confident figure.

**The assistant remembers, and the member can see exactly what it remembers.**
Conversations are saved. "Past chats" in the coach lists every one — and lets
them reopen or delete any of it. The coach opens knowing what they last came
about: *"last time you were looking at your DBE certification."* It is told the
opening line only, never the transcript, so it can pick a thread back up but
cannot claim to remember how the conversation went.

**They can tell us when an answer was useless.** Two small buttons under every
Coach reply, decision brief and step review. One tap, no form, and it never
interrupts them — if the tap fails to save, they are not shown an error, because
they were doing us a favour.

This is the one item on the list that makes everything else measurable. Until
now nothing anywhere recorded whether a single AI answer helped anybody, which
means every improvement we have made to the assistant — including all of this
week's — was made on judgement rather than evidence. It is also how we will find
out whether the new funding filter is helping or quietly hiding things people
needed.

Worth being straight about what it does not do yet: nothing reads the ratings
back. No dashboard, no report. That is on purpose — a report designed before
there is a month of real answers in it would be a report about imagined data.
The ratings are being kept from the day this ships, so the month starts now.

**They can correct their own details.** Business name, industry, city. Until
this week those four answers were collected once at sign-up and frozen forever —
there was no screen anywhere that could change them. That mattered most for
industry, which is what we search federal funding on: a member who picked the
wrong one was getting the wrong money suggested to them, permanently.

**Sign-up is four questions instead of seven.** Name, business, industry, city.
About a minute.

---

## What changed underneath

**Funding data is fetched once a night, not once per click.** An overnight job
keeps it ready. Faster, and if Grants.gov is down members see yesterday's list
clearly labelled rather than an empty page.

**We now search for the right thing.** The industry a member picks is also the
term we search federal grants on — so "Finance & Accounting" was being searched
for with the ampersand in it, and "Other" searched for the word *other*. The
label a member recognises and the query that finds them money are now two
different things.

**We can see what the AI costs.** Per member, per feature, split by how it's
billed.

**A test suite, grown from nothing to 220 automated checks.** Every one was also
deliberately broken once, to confirm it actually catches the problem it claims
to. Fifty of those breakages were run this week alone — and two of them found
tests that were passing for the wrong reason, which is exactly what the exercise
is for.

---

## Where things stand

| | |
| --- | --- |
| **Live now** | Everything above. Deployed and verified against the live database |
| **Now live** | Eight Wisconsin programs, signed off 29 Aug — re-check due 25 Feb 2027 |
| **Built, switched off** | Answers in Chinese, Spanish or Hmong — waiting on one person to read it, see below |

---

## The two things we need from the chamber

**1. Eight Wisconsin programs — done, and one thing it taught us.**

WEDC, WWBIC, SBDC, WHEDA, DFI, SCORE, the SBA district office and the state
Supplier Diversity Program are now live. The assistant can name them; before
this week it refused to name any Wisconsin program at all, however obviously
useful.

**The final re-read caught a claim we had confirmed twice and had wrong.** We
were telling members the state's 5% bid preference is for service-disabled
veteran-owned firms only. That is what the program's own home page says. The
state procurement manual says it is a *permissive* preference covering both
minority-owned and veteran-owned firms — and that the minority-owned half is
**currently paused**. A member could have read our line, assumed a preference
they do not have, and priced a bid on it.

So that entry no longer quotes a figure at all. It names the certifications and
sends the member to the program to confirm the current rule, because a number
with a moving part in it is exactly the thing a file like this gets wrong
eighteen months later, silently. Same reasoning removed a WEDC line we could not
substantiate.

The ninth — "county revolving loan funds" — was **dropped rather than
published.** It is not one program with one web page, and it was pointing at
WEDC as a stand-in, so a member clicking it would have landed at an organisation
that does not run it. Replacing it with real per-county entries is worth doing;
we need to know which counties our members are actually in.

**One date to put in the diary: 25 February 2027.** Verification expires after
six months by design, so on that day these eight disappear from the portal on
their own until someone re-checks them. That is the safety mechanism working —
but nothing announces it, so it needs to be somebody's calendar entry.

**2. Someone who reads Chinese — twenty minutes.**

The portal can answer in Simplified Chinese, Traditional Chinese, Spanish or
Hmong. It is built, tested and **switched off**, and it will stay off until
somebody has read real output.

What is tested is the plumbing: that the preference is stored, that it reaches
every one of the seven AI features, that agency names, form numbers and web
addresses stay in English inside the translated text — those are what a member
has to type into a government site, and a translated one finds nothing. What
nobody has done is read a Chinese answer and said it reads like a person wrote
it. That is not something a test can answer, and for this chamber specifically
the members most able to notice awkward Chinese are exactly the ones who would
be reading it, about tax filings and legal deadlines.

So it is off rather than live-and-hoped-for. Turning it on is one line, once one
person has read a handful of answers on a preview link and said yes. That is the
whole ask, and for this membership it is probably worth more than anything else
on this list.

---

## The principle worth stating out loud

The portal will not tell a member something nobody has verified.

That's why the Wisconsin section sat empty for weeks until someone signed it
off, why funding results carry a "checked on" date, why verification expires
after six months and the entry quietly disappears until someone re-checks it,
why we dropped a bid-preference figure rather than publish one that is half
paused, and why the assistant says "I don't have that figure, WI DFI publishes
it" instead of guessing. It is also why the bilingual feature is built and
switched off. A chamber's recommendation carries our name on it. Empty is
recoverable; wrong is not.

The same principle is why the coach is given the opening line of a past
conversation and never the transcript. It can say what you came about. It cannot
invent what was said.

---

## Next

1. A Chinese speaker reviews real translated output, which is what switches
   the bilingual feature on
2. Watch the first month of answer ratings, then decide what to fix — nothing currently does, so
   every improvement to the AI is being made on judgement rather than evidence
3. Run the six post-deploy checks against the live site
4. Tell us which counties our members are in, so the dropped ninth entry can be
   rebuilt as real per-county loan funds

Full technical detail is in `ROADMAP.md` and `NEXT-SESSION-PROMPT.md`.

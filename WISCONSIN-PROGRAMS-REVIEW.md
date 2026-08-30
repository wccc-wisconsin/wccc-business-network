# Wisconsin programs — review checklist

> **Status: signed off 2026-08-29. Eight entries are live; the ninth was
> dropped. 2027-02-25 is the last day they are shown** — from the 26th they
> vanish from the panel on their own until someone re-checks them.
>
> You do not need to remember that date. `test/wisconsinPrograms.test.ts` starts
> failing 30 days beforehand with the date and these instructions, so the next
> `npm test` after **2027-01-26** will tell you. Re-verifying clears it.

**Nothing in `data/wisconsinPrograms.ts` is shown to a member until someone
here has checked it.** A new entry is written with `verified: false`, and the
runtime filter (`activeWisconsinPrograms()`) returns only verified entries, so
an unchecked entry leaves the Wisconsin half of the Funding & Programs panel
empty and saying so on screen.

That is deliberate. The federal half of the catalog is retrieved live from
Grants.gov and is as current as Grants.gov is. Wisconsin has no equivalent API,
so this half is a hand-maintained file, and a hand-maintained file's
characteristic failure is describing a program confidently for years after it
ended. The portal must never tell a member a program is active when nobody
checked.

## What was checked, when, and what each pass was worth

| Pass | What it did | What it found |
| --- | --- | --- |
| 2026-08-23 | All nine URLs fetched, descriptions compared to the sites | Three wrong or unsupported claims corrected — see the table |
| 2026-08-28 | Re-read against the same sites | Eight matched, several word for word |
| **2026-08-29** | **Re-read again, then signed off by WCCC** | **Two more corrections, and the ninth entry dropped** |

Each of those first two was a machine reading a web page: a starting point, not
a sign-off. A machine cannot tell you whether an organisation is the right
referral for a WCCC member, and a website will happily describe a program long
after the funding for it has gone. The sign-off on 2026-08-29 is the part that
made the entries live.

### What the third pass changed, and why it was worth doing

Two descriptions were rewritten rather than merely confirmed, which is the
argument for re-reading rather than trusting the previous pass:

- **#8, Supplier Diversity — the previous pass got this wrong.** It recorded
  that the 5% bid preference applies to DVB firms only and that the stored
  description "already gets it right". The program's own home page does say
  exactly that, which is why it was read that way twice. But the State
  Procurement Manual ([PRO-606](https://doa.wi.gov/ProcurementManual/Pages/PRO-606.aspx))
  has it as a *permissive* MBE/DVB preference — "agencies may apply" — with the
  MBE half **currently paused**, and WBE getting no preference at all. Storing a
  figure with a moving part in it is exactly what rule 3 in the catalog file
  warns against, so the entry now points at the policy instead of quoting a
  number. Nothing downstream re-checks a number once it is written down.
- **#1, WEDC — an unsupported sub-claim.** "publishes which are currently open"
  could not be confirmed: the programs directory renders client-side and served
  no open/closed labels to read. Softened to what is actually visible.

**#4, WHEDA — worth knowing.** "Arranged through a partner lender rather than
directly" is supported by WHEDA's lender-facing guarantee forms and its own
"works closely with lenders" wording, but is not stated in those words on the
site. It is inference from good evidence rather than a quote. Left as written.

## How to verify one entry

1. Open the entry's `url`.
2. Confirm the organisation still exists and still does roughly what the
   `description` says. Correct the description if it drifted — better a shorter
   accurate line than a fuller stale one.
3. In `data/wisconsinPrograms.ts`, set that entry's `verified: true` and
   `lastVerified: "YYYY-MM-DD"` (today).
4. Leave anything you could not confirm at `verified: false`. An unverified
   entry costs a member nothing. A wrong one costs them a wasted application.

Entries can be verified one at a time — there is no need to finish the list
before any of it goes live. That mattered most before 2026-08-29, when none were
verified and Grants.gov was the feature's only source: if it was unreachable the
whole panel went dark. With eight live, the panel now has something to show even
when Grants.gov does not.

## Verification expires

`STALE_AFTER_DAYS = 180`. Six months after its `lastVerified` date an entry
drops out of the catalog automatically, exactly as though it had never been
verified, and returns when someone re-checks it. So this is a twice-a-year job,
not a one-off.

## The checklist

All eight are `verified: true`, `lastVerified: "2026-08-29"`, and drop out of
the catalog on their own on **2027-02-25**.

| # | Entry | Last quoted evidence (2026-08-29) | Status |
|---|---|---|---|
| 1 | WEDC | Nav carries "Grow Your Business", "Build Your Small Business", and a Programs directory filtered by audience. Open/closed labelling **not** visible — directory is client-rendered | ✅ live, description softened |
| 2 | WWBIC | "individuals who are interested in starting, strengthening or expanding businesses"; six regions — Greater Milwaukee, North Central, Northeast, South Central, Southeast, Southwest | ✅ live |
| 3 | Wisconsin SBDC | "no-cost, confidential consulting and business education"; "nationally accredited network"; "located at Universities of Wisconsin campuses" | ✅ live |
| 4 | WHEDA | Vision "All people in Wisconsin have an affordable place to call home"; "more than 29,280 small business and agricultural loan guarantees" | ✅ live |
| 5 | Wisconsin DFI | "Business Entity Search", "Request Certificate of Status", "File Annual Report" all live under those exact names | ✅ live |
| 6 | SCORE — Wisconsin | "Mentoring is always free, for the life of your business"; SBA cooperative agreement in the footer; four WI chapters — Madison, NE, SE, West Central | ✅ live |
| 7 | SBA Wisconsin District Office | "Our office provides help with SBA services including funding programs, counseling, federal contracting certifications, and disaster recovery"; "Serving all 72 counties in Wisconsin" | ✅ live, still 302s to legacy.sba.gov |
| 8 | Wisconsin Supplier Diversity Program | "Minority-Owned (MBE), Service-Disabled Veteran-Owned (DVB) and Woman-Owned (WBE)"; "at least 51% owned, managed, and controlled". Bid preference contradicted by PRO-606 | ✅ live, **description corrected** |
| 9 | County / municipal revolving loan funds | — | ❌ **dropped 2026-08-29** — a category, not an organisation |

## Rows that still carry a note

**#7 — the SBA URL redirects.** `https://www.sba.gov/district/wisconsin` currently
returns a 302 to `legacy.sba.gov/district/wisconsin`. The content is right and
the link works, but a URL on a host called "legacy" is one reorganisation away
from breaking. Worth re-checking where it lands when you verify, and using
whatever the canonical address is by then.

**#8 — which certifications actually matter to members.** The state certifies
MBE, WBE and DVB itself. Members may also hold or want federal certifications
(8(a), HUBZone, WOSB) or private ones (NMSDC), which the state does not
administer. If WCCC wants to point members at those too, they should be separate
entries with their own URLs rather than folded into this one.

**#9 — dropped, and what would replace it.** Many Wisconsin counties and cities
run their own small revolving loan funds, but there is no statewide list and no
single URL, so the entry pointed at WEDC as a stand-in — meaning a member who
clicked "county revolving loan funds" landed on an organisation that does not
run one. It was removed on 2026-08-29 rather than verified.

The useful version is one entry per county where WCCC members are actually
concentrated — Milwaukee, Dane, Waukesha, whichever they are — each linking to
that county's own economic development office, each verified separately. That
needs someone to say which counties, and is real research plus a confirmation
each. Worth doing; not blocked on anything.

## Two fields that decide who sees an entry

Added 2026-08-29 alongside the sign-off. Both are about *fit*, and they are not
interchangeable — read this before writing either.

**`fitNote` — every entry has one, and it is judgement, not fact.** One or two
sentences on who this organisation genuinely helps and who it wastes time for:
"of no use to someone who has not yet got a lender", "rarely a wrong referral",
"opens nothing by itself". It is the part a chamber knows that a search result
does not, and it is what the AI weighs when choosing what to recommend.

It goes to the model, never onto the member's screen. `description` is what the
organisation says about itself; this is WCCC's opinion about it, and the two
must not appear side by side looking equally official. Same content rule as a
description: no dates, no dollar figures, no percentages other than the
ownership test — a stale number here is quoted with the chamber's authority
behind it.

**`requirements` — only where an answer genuinely disqualifies.** Two entries
have one. WHEDA needs a lender relationship; Supplier Diversity needs qualifying
ownership. Anything softer than *this cannot work for you* belongs in `fitNote`,
where the AI can weigh it, rather than here, where the code removes the entry
before anyone sees it.

The filter is deliberately reluctant: it removes an entry only on an answer that
positively rules the member out. A blank, an unanswered question, and "prefer
not to say" all keep the entry visible. **Please keep it that way.** Showing a
member something they cannot use costs them a click; hiding help from someone
who qualifies costs them the money, and neither of you would ever find out. A
test fails if a third `requirements` entry appears, so that adding one is a
decision rather than a habit.

## Adding an entry

Add an object to the array with a new stable `id`, a `fitNote`,
`verified: false`, and `lastVerified: null`, then verify it like any other. Never reuse an `id` for a
different organisation — saved member opportunities reference the catalog by
what it contained at generation time.

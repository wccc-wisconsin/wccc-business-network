# Wisconsin programs — review checklist

**Nothing in `data/wisconsinPrograms.ts` is shown to a member until someone
here has checked it.** Every entry ships with `verified: false`, and the runtime
filter (`activeWisconsinPrograms()`) returns only verified entries, so until
this checklist is worked through, the Wisconsin half of the Funding & Programs
panel is empty and says so on screen.

That is deliberate. The federal half of the catalog is retrieved live from
Grants.gov and is as current as Grants.gov is. Wisconsin has no equivalent API,
so this half is a hand-maintained file, and a hand-maintained file's
characteristic failure is describing a program confidently for years after it
ended. The portal must never tell a member a program is active when nobody
checked.

## What was pre-checked, and what that is worth

On **2026-08-23** all nine URLs were fetched and every description was compared
against what the organisation says about itself. Three were wrong or
unsupported and have been corrected — details in the table below.

That was a machine reading a web page. It is a starting point, not a sign-off.
It cannot tell you whether an organisation is the right referral for a WCCC
member, and a website will happily describe a program long after the funding for
it has gone. So your job on each row is **confirmation, not research**: open the
link, see that the description matches, and decide whether you'd actually send a
member there.

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
before any of it goes live. Verifying even two or three is worth doing before
launch: while none are verified, Grants.gov is the feature's only source, so if
it is unreachable the whole panel is dark.

## Verification expires

`STALE_AFTER_DAYS = 180`. Six months after its `lastVerified` date an entry
drops out of the catalog automatically, exactly as though it had never been
verified, and returns when someone re-checks it. So this is a twice-a-year job,
not a one-off.

## The checklist

| # | Entry | URL | Pre-check found | Checked by | Date | ☐ |
|---|---|---|---|---|---|---|
| 1 | WEDC | https://wedc.org/ | Confirmed. State economic development agency; programs page organised by audience. Description unchanged. | | | ☐ |
| 2 | WWBIC | https://www.wwbic.com/ | **Corrected.** The draft called it a CDFI — the site doesn't say so, so the claim was removed. Confirmed: loans, training, coaching, post-loan support, six regional offices, serves entrepreneurs generally despite the name. | | | ☐ |
| 3 | Wisconsin SBDC | https://wisconsinsbdc.org/ | Confirmed, and tightened to their own words: "no-cost, confidential consulting and business education," nationally accredited, based at Universities of Wisconsin campuses. | | | ☐ |
| 4 | WHEDA | https://www.wheda.com/ | **Corrected.** Housing is its primary mission, which the draft didn't say — a member expecting a business-first agency would be misled. Small-business and agricultural loan guarantees via partner lenders confirmed. | | | ☐ |
| 5 | Wisconsin DFI | https://dfi.wi.gov/ | Confirmed, and made more useful: Business Entity Search and Certificate of Status are the specific tools for proving good standing. | | | ☐ |
| 6 | SCORE — Wisconsin | https://www.score.org/ | **Corrected.** The draft said "low-cost workshops"; SCORE's workshops and mentoring are free, mentoring "for the life of your business." | | | ☐ |
| 7 | SBA Wisconsin District Office | https://www.sba.gov/district/wisconsin | Confirmed — covers all 72 counties, Milwaukee office. Two notes below. | | | ☐ |
| 8 | Wisconsin Supplier Diversity Program | https://supplierdiversity.wi.gov/Pages/Home.aspx | **Corrected.** The draft pointed at the DOA front page; this is the actual program. Confirmed: MBE, WBE and service-disabled-veteran certification, 51% ownership test, 5% bid preference for certified DVB firms. | | | ☐ |
| 9 | County / municipal revolving loan funds | https://wedc.org/ | Not verifiable as written — see below. | | | ☐ |

## Three rows that need a judgement call

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

**#9 — this is a category, not a program.** Many Wisconsin counties and cities run
their own small revolving loan funds, but there is no statewide list and no
single URL, so it currently points at WEDC as the nearest useful starting point.
Two honest options: drop the entry, or replace it with one entry per county
where WCCC members are actually concentrated — Milwaukee, Dane, Waukesha,
whichever they are — each with the county economic development office's own
link, each verified separately. The second is more work and much more useful.

## Adding an entry

Add an object to the array with a new stable `id`, `verified: false`, and
`lastVerified: null`, then verify it like any other. Never reuse an `id` for a
different organisation — saved member opportunities reference the catalog by
what it contained at generation time.

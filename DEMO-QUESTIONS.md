# Demo questions — WCCC Portal

A bank of questions for tomorrow, aimed at what the portal can actually answer
well. Companion to `DEMO-SCRIPT.md`, which has the personas, the walkthrough
order and the pre-flight.

**Use these the night before, not live.** Run them, read the answers, keep the
three or four that landed. The dashboard reloads saved opportunities and briefs,
and **Past chats** reopens any Coach conversation, so a good answer generated
tonight is on screen tomorrow without another model call. See "generate before
you present" in `DEMO-SCRIPT.md`.

---

## Why some questions work and others don't

The Coach may only assert Wisconsin and federal specifics that are in its
reference material. That material is eight verified entries:

| Reference | What it can speak to |
| --- | --- |
| **WEDC** | State grant and loan programs, entrepreneurship support |
| **WWBIC** | Business loans, finance training, coaching — serves everyone despite the name |
| **SBDC** | Free, confidential consulting; starting up, financing, growth |
| **WHEDA** | Small-business loan guarantees, through a partner lender |
| **DFI** | Entity registration, annual reports, Business Entity Search, Certificate of Status |
| **SCORE** | Free mentoring for the life of the business, plus workshops |
| **SBA Wisconsin District** | SBA loans via lenders, federal contracting certifications, all 72 counties |
| **Supplier Diversity certification** | State MBE / WBE / DVB certification, opens state contracting |

Plus the compliance calendar: Wisconsin annual report, Form 941 payroll returns,
federal estimated tax.

**A question whose answer routes through that table gets a specific, confident
reply naming a real body.** A question about a county fee, a dollar threshold or
a filing deadline that isn't in the calendar gets an honest "I don't have that —
here's who does", which is correct behaviour but a weaker thing to watch.

Pick accordingly. The strong set below is chosen on exactly that basis.

---

## AI Coach — the strong set

Each of these lands squarely on the catalog. Ask as Golden Lotus Catering
(Milwaukee, food & beverage, priority Revenue).

### 1. Free help, and who to call first

> Where can I get free, one-on-one help with my business plan in Wisconsin?

**Good answer names:** SBDC (free, confidential, at UW campuses) and SCORE (free
mentoring for the life of the business). Both are in the catalog, so this should
be specific and confident, with a next action.

**Why it demos well:** it's the single most useful thing a chamber can tell a
member, and the answer is entirely on solid ground.

### 2. Money, without asking for a number

> I need about $25,000 for kitchen equipment. What are my realistic options in Wisconsin?

**Good answer names:** WWBIC, the SBA Wisconsin District Office, and possibly
WHEDA loan guarantees — and should say SBA and WHEDA go through a participating
lender rather than direct. It should *not* quote a rate or a maximum.

**Why it demos well:** three real options, correctly described, with no invented
figures. If someone in the room asks "what's the interest rate?", the honest
non-answer is the feature.

### 3. Certification — arguably the most valuable thing here

> How do I get certified as a minority-owned business, and what does it actually open up for me?

**Good answer names:** the Wisconsin Supplier Diversity Program (51% owned,
managed and controlled), and separately the SBA for *federal* contracting
certifications. State and federal are different tracks and the catalog carries
both.

**Why it demos well:** this is the question a WCCC member most wants answered,
and it's the clearest case of the portal knowing something a general search
muddles.

### 4. Good standing — concrete and checkable

> Before I apply for a loan, how do I check my LLC is in good standing?

**Good answer names:** DFI, its Business Entity Search, and the Certificate of
Status. Possibly ties to the Wisconsin annual report from the compliance
calendar.

**Why it demos well:** a complete, actionable answer with a named tool the
member can go use in the next five minutes.

### 5. It knows the member

> Given where I am, what should I be working on in the next 30 days?

**Good answer:** refers to details from the Snapshot — part-time, irregular
revenue, no employees, priority Revenue — and to roadmap position, without
being told any of it again.

**Why it demos well:** point out afterwards that nothing in that question
mentioned the business. Context is the product.

---

## AI Coach — questions that hit a gap on purpose

Use **at most one**, and only if you want to show the guardrail. The answer will
decline to guess and refer you onward, which is the designed behaviour and reads
as trustworthy — but it is a weaker watch than the five above.

> What licenses do I need to cater private events in Milwaukee County?

Names the county and city health departments and the WI Department of Revenue on
the seller's permit, gives you the sentence to say on the phone, and refuses to
invent a fee. Good answer, and a good story about why it refuses — **if** you
frame it before you ask: *"watch what it does when it doesn't know."*

Unframed, it just looks like the site doesn't know things.

**Do not ask** for a specific fee, a tax threshold, a form number outside the
compliance calendar, or anything needing legal or tax advice. Those are refused
by design and three refusals in a row reads as an empty product.

---

## Decision Grill

The Grill needs a real decision with real numbers — vague inputs produce vague
questions. **It makes two model calls where the Coach makes one, and it has
never been run on the live site, so rehearse this one first.**

### Primary

> Should I sign a lease on a commercial kitchen, or keep renting by the hour?

Answers to feed it, from `DEMO-SCRIPT.md`: about $40/hour at a shared commissary,
roughly 20 hours a month; the lease is ~$1,800/month on a three-year term;
October–December are busiest, summer is slow; about $9,000 in savings; the worry
is being locked in through a slow summer.

**Good brief:** uses the actual numbers (20 × $40 = $800 against $1,800), names
the summer exposure as the real risk, and gives a decision rather than a list of
considerations.

### Alternates

> Should I hire my first part-time employee, or keep subcontracting per event?

> Should I raise prices 15% and risk losing repeat customers, or hold and take more volume?

Both have the same shape: a real trade-off with numbers attached, which is what
makes the questioning sharp.

---

## Funding & Programs

No typing — click **Find matches**. It reads the profile.

**Good result:** five matches, each naming a catalog entry with a sentence about
*this* business and a next step. Expect WWBIC, SBDC, SCORE, WEDC and either SBA
or Supplier Diversity certification.

**Count them.** Fewer than five means some were dropped as malformed. It still
works, and it is worth a note to fix rather than a thing to mention on the day.

---

## Step review — cheapest thing to show

Open **Launch → Make it official → Licences & permits**, write two or three real
sentences, click **Review my answers**.

**Good review:** strongest point, gap, and a Wisconsin-specific tip that names a
body from the table above.

Fast, low-risk, and shows the AI is threaded through the roadmap rather than
bolted on as a chatbot.

---

## The deterministic proof — lead with this

Not a question, and the strongest thing you have.

Open the deadline panel. Ten Wisconsin filings exist in the system; Golden Lotus
sees **one** — the annual report for LLCs formed April–June — and underneath:

> *9 filings hidden because your profile says they don't apply to you.*

Say the count out loud. It is computed from the profile, it cannot truncate or
fail, it has been verified working live, and the audience can check the
arithmetic themselves. Most portals show everyone the same list; this one
removes nine and says why.

---

## A 12-minute run, if time is short

1. **Deadline panel** — the count. (2 min)
2. **Coach, question 5** — "what should I work on in the next 30 days". Show it
   already knows the business. (3 min)
3. **Funding & Programs** — the saved matches. (2 min)
4. **Coach, question 3** — certification. The highest-value answer for a WCCC
   member. (3 min)
5. **Known gaps** — name two from the bottom of `DEMO-SCRIPT.md` before anyone
   finds them. (2 min)

The Decision Grill is the best demo in the product when it lands and the least
proven on the live site. Include it only if tonight's rehearsal went clean.

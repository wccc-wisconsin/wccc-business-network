# Demo questions and walkthrough — WCCC Portal

Every interactive surface in the portal, in the order a member meets them, with
what to click, what to type, and what a good result looks like. Companion to
`DEMO-SCRIPT.md`, which holds the personas and the known gaps.

**Generate the AI output the night before.** Saved opportunities and briefs
reload with the dashboard, **Past chats** reopens any Coach conversation, and
generated documents persist per module. So run the AI parts tonight, read them,
regenerate anything thin, and tomorrow you are presenting output you have
already approved. See "generate before you present" in `DEMO-SCRIPT.md`.

Persona throughout: **Golden Lotus Catering**, Milwaukee, Food & Beverage,
priority **Revenue**. Seeded by `seed-demo-member.sql`.

---

## Why some questions work and others don't

The Coach may only assert Wisconsin and federal specifics that are in its
reference material — eight verified entries plus the compliance calendar:

| Reference | What it can speak to |
| --- | --- |
| **WEDC** | State grant and loan programs, entrepreneurship support |
| **WWBIC** | Business loans, finance training, coaching — serves everyone despite the name |
| **SBDC** | Free, confidential consulting; starting up, financing, growth |
| **WHEDA** | Small-business loan guarantees, through a partner lender |
| **DFI** | Entity registration, annual reports, Business Entity Search, Certificate of Status |
| **SCORE** | Free mentoring for the life of the business, plus workshops |
| **SBA Wisconsin District** | SBA loans via lenders, federal contracting certifications, all 72 counties |
| **Supplier Diversity** | State MBE / WBE / DVB certification, opens state contracting |

Compliance calendar: Wisconsin annual report, Form 941 payroll returns, federal
estimated tax.

A question routing through that table gets a specific, confident answer naming a
real body. A question about a county fee or a dollar threshold gets an honest
referral — correct behaviour, weaker to watch. Choose accordingly.

---

# The full walkthrough

## A. Homepage, signed out — 2 min

What a prospective member sees free: hero, programs, partners, and the Wisconsin
Asian Hub section (directory, events, live RFPs).

**Say:** this is the shop window; everything after sign-in is the member benefit.

> **Note:** homepage statistics are hardcoded in `data/stats.ts` and have not
> been checked against real WCCC numbers. Don't invite scrutiny of them.

## B. Sign up and onboarding — 2 min

Four fields: business name, industry, city. That's the whole intake.

**Say:** four fields, and from here on the portal never asks a member to
re-type anything it already knows. That claim is the spine of the demo — every
later section pays it off.

## C. Member profile card — editable, 1 min

On the dashboard. Click **Edit**: name, business name, industry (a dropdown),
city. Change the city to something else, save, and change it back.

**Why show it:** it proves the profile is live data, not a fixed seed. Worth
doing early so nobody wonders later whether the personalisation is hardcoded.

## D. Business Snapshot — 7 questions, editable any time — 3 min

`BusinessAssessmentCard`. Seven multiple-choice questions that compute the
member's **stage** and record their **priority**.

Answer as a business operating but still informal: about a year in, part-time,
a handful of repeat customers, small and irregular revenue, no employees,
**top priority: Revenue**.

**Watch for:** the stage it computes and the priority it stores. Say out loud
that every AI surface leads with that priority — then let the Coach prove it
later.

**Then re-open it** and point out it can be updated any time as the business
changes. This is the "editable and interactive" heart of the dashboard.

## E. Compliance calendar — the proof — 2 min

`ComplianceCalendar`, driven by the member's stored facts. **This is the
strongest thing you have, and it involves no model call.**

Ten Wisconsin and federal filings exist in the system. Golden Lotus sees **one**
— the Wisconsin annual report for LLCs and corporations formed April–June — and
underneath it:

> *9 filings hidden because your profile says they don't apply to you.*

**Say the count out loud.** Most portals show everyone the same list. This one
removes nine and tells you why it removed them. It is computed from the profile,
it cannot truncate or fail, and the audience can check it themselves.

If someone asks how it knows: the member said they have no employees, so payroll
filings drop; the entity type and formation month decide which annual report
applies.

## F. Roadmap tabs and module list — 1 min

`DashboardRoadmapTabs` and `RoadmapModuleList`. Eight stages: Foundation,
Launch, Revenue, Capital, Opportunity, Growth, Expansion, Legacy.

**Watch for:** the progress bar reads against real steps ("3 of 8 steps"), not a
vanity percentage.

**Say:** every stage is open to every member — tier gating is switched off.

---

## G. Inside a module — the richest section, 6–8 min

Open **Launch**. Four separate interactive things live here and most demos miss
three of them.

### G1. Guided steps — text entry and completion

`StepCard`. Open **Make it official → Licences & permits**. Type two or three
real sentences, for example:

> I have my food handler certificate and I rent commissary hours by the hour.
> I'm not sure whether I need a seller's permit for prepared food.

Tick the step complete. **Say:** completion is self-reported — nothing verifies
the work, and that is deliberate for now.

### G2. "Review my answers" — inline AI feedback

Click it on the step you just filled in.

**Good review:** a strongest point, a gap, and a Wisconsin-specific tip naming a
body from the reference table. Fast, cheap, and it shows the AI is threaded
through the roadmap rather than bolted on as a chatbot.

### G3. Module Toolkit — it generates real documents

`ModuleToolkit`. Launch carries **Licences & Permits Action List** and **Your
Standard Terms Sheet**; Revenue carries a **90-Day Marketing Plan**.

Click one. It produces an actual document, saved to the member's account and
still there on reload.

**This is the most under-shown feature in the portal.** A member walks away with
a document, not advice. Generate it tonight so tomorrow it is already in the
list.

### G4. Module summary

`ModuleSummaryPanel`. Generates a written summary of the member's progress
through that stage, saved per module.

### G5. The Coach, scoped to the module

The same Coach appears inside a module and is told which stage the member is
looking at. Ask something stage-specific here rather than on the dashboard, and
point out that you never told it which module you were in.

---

## H. AI Coach — 5 min

### The strong five

**1. Free help, and who to call first**
> Where can I get free, one-on-one help with my business plan in Wisconsin?

Should name **SBDC** (free, confidential, at UW campuses) and **SCORE** (free
mentoring for the life of the business). The most useful thing a chamber can
tell a member, and entirely on solid ground.

**2. Money, without inventing a number**
> I need about $25,000 for kitchen equipment. What are my realistic options in Wisconsin?

Should name **WWBIC**, the **SBA Wisconsin District Office**, possibly **WHEDA**
guarantees — and should say SBA and WHEDA go through a participating lender
rather than direct. It should *not* quote a rate or a maximum. If someone asks
"what's the interest rate?", the refusal is the feature.

**3. Certification — the highest-value answer for this audience**
> How do I get certified as a minority-owned business, and what does it actually open up for me?

Should name the **Wisconsin Supplier Diversity Program** (51% owned, managed and
controlled) for state contracting, and separately the **SBA** for federal
certifications. Two different tracks; the catalog carries both.

**4. Good standing — concrete and checkable**
> Before I apply for a loan, how do I check my LLC is in good standing?

Should name **DFI**, the **Business Entity Search** and the **Certificate of
Status**, and may tie to the annual report in the calendar.

**5. It already knows the member**
> Given where I am, what should I be working on in the next 30 days?

Should refer to the Snapshot — part-time, irregular revenue, no employees,
priority Revenue — and to roadmap position. **Afterwards, point out that nothing
in the question mentioned the business.**

### The memory loop — 90 seconds, and the trust story

Do this straight after question 5.

1. Ask a question that reveals something new, e.g.
   > I've been thinking about hiring my first part-time employee for the holidays.
2. Click **Save what we discussed**.
3. The Coach proposes candidate facts, **each shown above the member's own words
   quoted from the chat**. Confirm one.
4. Ask a follow-up. It now uses the fact.

**Say:** the Coach cannot write to a member's profile on its own. It proposes,
quotes what they actually said, and the member confirms each item. For a chamber
holding members' business details, that consent step is the point.

### Past chats — the other half of the bargain

Open **Past chats**. Every stored conversation is listed and any of them can be
deleted by the member.

**Say:** the portal keeps transcripts so the coach has continuity, so the member
gets to see and remove them. Also worth knowing: the AI is given only the *date
and opening line* of past chats, never the transcript, and is explicitly told it
cannot claim to remember how an exchange went.

---

## I. Decision Grill — 5 min

**Rehearse this one first.** It makes two model calls where the Coach makes one,
and it has never been exercised on the live site.

Type:
> Should I sign a lease on a commercial kitchen, or keep renting by the hour?

Answer its questions with real numbers:

- about **$40/hour** at a shared commissary, roughly **20 hours a month**
- the lease is **~$1,800/month**, three-year term
- **October–December** busiest, summer slow
- about **$9,000** in savings
- the worry is being locked in through a slow summer

**Good brief:** uses the arithmetic (20 × $40 = $800 against $1,800), names the
summer exposure as the real risk, and reaches a decision rather than listing
considerations. Saved to the dashboard and reloads there.

**Alternates,** same shape — a real trade-off with numbers:

> Should I hire my first part-time employee, or keep subcontracting per event?

> Should I raise prices 15% and risk losing repeat customers, or hold and take more volume?

## J. Funding & Programs — 2 min

`OpportunitiesPanel`. No typing — click **Find matches**; it reads the profile.

**Good result:** five matches, each naming a catalog entry with a sentence about
*this* business and a next step. Expect WWBIC, SBDC, SCORE, WEDC, and either SBA
or Supplier Diversity certification.

**Count them.** Fewer than five means entries were dropped as malformed — it
still works, but tell me afterwards.

Federal grant postings come from a nightly Grants.gov refresh, so that half is
live data rather than a fixed list.

## K. Community Hub links — 1 min

`CommunityHubLinks` — the bridge back to the public Wisconsin Asian Hub:
directory, events, RFPs.

## L. Rating buttons — 30 seconds

Under any Coach reply, decision brief or step review: **Was this useful? Yes /
No.** Click one.

**Say:** every answer can be rated, and the model that produced it is recorded
alongside the rating, so a drop in quality can be told apart from a model change.

> Nothing visible confirms it saved — deliberately, so a member doing you a
> favour is never shown an error. There is also no screen yet that reads the
> ratings back.

---

# Questions to use carefully, and questions not to ask

## The gap question — use at most one, and frame it first

> What licenses do I need to cater private events in Milwaukee County?

It names the county and city health departments and the WI Department of Revenue
on the seller's permit, gives the sentence to say on the phone, and refuses to
invent a fee.

**Frame it before you ask:** *"watch what it does when it doesn't know."* Framed,
the refusal reads as trustworthy. Unframed, it just looks like the site doesn't
know things.

## Do not ask

- A specific fee, rate or dollar threshold
- A form number outside the compliance calendar
- Anything needing legal or tax advice
- Any second gap question — three refusals in a row reads as an empty product

---

# Run orders

## 12 minutes

1. Compliance calendar — the count (2)
2. Coach question 5 — it already knows the business (3)
3. Funding & Programs — saved matches (2)
4. Coach question 3 — certification (3)
5. Two known gaps, named before anyone finds them (2)

## 25 minutes

Add: Business Snapshot (D), one module — guided step, Review my answers, and a
generated document (G1–G3), and the memory loop (H).

## Full, 40 minutes

A through L in order. Decision Grill only if last night's rehearsal was clean.

---

# Before you start

- Run the pre-flight in `DEMO-SCRIPT.md` — ten minutes, alone, the night before.
- Generate: funding matches, one decision brief, one Coach conversation per
  question you plan to show, one toolkit document, one module summary.
- Read every one. Regenerate anything thin. What you keep is what tomorrow shows.

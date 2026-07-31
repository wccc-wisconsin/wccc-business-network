# WCCC Portal — Demo Script

Test personas and a walkthrough order, for demoing the portal without owning a
business yourself. Everything below is realistic for a Wisconsin small business
and specific enough that the AI features produce good output — vague answers are
what make them produce generic-sounding replies.

---

## Persona A — early-stage food business

Use this one for the main walkthrough. It's early enough that the free Launch
module is genuinely relevant, so the roadmap doesn't look empty.

### Onboarding form

| Field | Answer |
|---|---|
| Business name | Golden Lotus Catering |
| Industry | Food Service / Catering |
| City | Milwaukee |
| Journey | Know Your Business |

### Business Snapshot

Answer as a business that's operating but still informal:

- Operating for about a year, part-time
- A handful of repeat customers, mostly word of mouth
- Revenue is small and irregular
- No employees; owner does everything
- **Top priority: Revenue** — this unlocks the Revenue module free, which is
  the more interesting one to show since Launch is free anyway

### Decision Grill

Type this decision:

> Should I sign a lease on a commercial kitchen, or keep renting by the hour?

When it asks follow-up questions, answer in this direction:

- Currently paying about $40/hour at a shared commissary, roughly 20 hours a month
- The lease being considered is ~$1,800/month, three-year term
- Busiest months are October through December; summer is slow
- About $9,000 in savings
- Biggest worry is being locked in through a slow summer

That gives it real numbers to work with, which is when the grilling gets sharp.
Vague answers ("not sure," "some money") produce vague questions back.

### AI Coach

Good questions to try:

- "What licenses do I actually need to cater private events in Milwaukee County?"
- "How do I price a catering job so I'm not losing money on labor?"
- "What's the difference between a commissary agreement and a commercial lease?"

### Funding & Programs

Just click **Find matches** — it uses the profile above. Expect grants, capital
access, and minority-owned certification suggestions relevant to food service in
Milwaukee.

---

## Persona B — established firm chasing contracts

Use this one to show the Opportunity module and certification help, which is
arguably the most valuable thing the portal offers a WCCC member.

| Field | Answer |
|---|---|
| Business name | Vang Facilities Services |
| Industry | Commercial Cleaning / Facilities |
| City | Madison |
| Journey | Know Your Business |

Business Snapshot: operating six years, six employees, steady commercial
contracts, wants to bid on public work. **Top priority: Opportunity.**

Decision Grill:

> Should I pursue DBE certification, or focus on private-sector clients?

Coach questions:

- "What does a capability statement need to include for county work?"
- "How long does MBE certification take in Wisconsin, and what will it cost me?"

---

## Walkthrough order for tomorrow

Show it in the order a real member would encounter it, not feature by feature:

1. **Homepage, signed out** — hero, programs, then the Wisconsin Asian Hub
   section (business directory, events, live RFPs). This is what a prospective
   member sees for free.
2. **Sign up → onboarding** — the intake form. Use Persona A.
3. **Dashboard, first view** — everything at zero. Point out that the progress
   bar reads "0 of 8 steps" against the actual roadmap, not a vanity number.
4. **Business Snapshot** — fill it in, show that it unlocks a module free based
   on the stated priority, regardless of tier.
5. **Open the unlocked module** — guided steps, then "Review my answers" on one
   step to show inline AI feedback.
6. **AI Coach** — ask one of the questions above. Point out it already knows the
   business, city, tier, and roadmap position; nothing had to be re-typed.
7. **Decision Grill** — start it, answer two or three questions, generate the
   brief.
8. **Funding & Programs** — Find matches.

Steps 6–8 are the strongest part of the demo. Leave time for them.

---

## Judging whether the output is any good

You don't need to own a business to tell these apart.

**Good signs:**

- Names specific Wisconsin bodies: WI DFI, WEDC, Wisconsin SBDC, WWBIC, SCORE,
  Milwaukee County procurement
- Refers back to details you actually typed (the $1,800 lease, the slow summer)
- Gives a next action with a who or a where, not just "consider your options"
- Says "talk to an accountant" when the question is genuinely a tax question

**Red flags worth noting:**

- Generic advice that would fit any business in any state
- Named programs that sound plausible but you can't find by searching — the
  prompts instruct against inventing names, so report it if it happens
- Encouragement with no substance ("That's a great question!")
- Confident legal or tax advice — it's told not to do this

---

## Known gaps, if asked

Be upfront about these rather than hoping they don't get clicked:

- **The personal track ("Know Yourself") has no guided steps yet.** All four
  modules show resource lists only. Picking that journey gives an empty roadmap.
- **QR event check-in is built but switched off** (`CHECKIN_ENABLED` in
  `app/dashboard/page.tsx`). The backend and database table exist; it needs a
  decision about whether attendance counts toward anything before turning on.
- **Step completion is self-reported** — ticking a checkbox marks a step done;
  nothing verifies the work.
- **Homepage statistics are hardcoded** in `data/stats.ts` and haven't been
  verified against real WCCC numbers.
- **Business and Corporate tiers now unlock identical roadmap content.**
  Corporate's value is seats, directory placement, and sponsorship, per the
  membership page. If that's wrong, it's a one-word change per module in
  `data/modules.ts`.

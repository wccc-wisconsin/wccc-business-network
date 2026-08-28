# WCCC member-to-member directory — consent and read-path design

**Status: proposal. No code written. Needs your approval, and on two points your decision.**

This is half two of the catalog work: let members find each other for trade — who
in the chamber can supply what. The data mostly exists already in `member_facts`.
Publishing it is the part that needs care, so this document works out how before
anything is built.

---

## 0. A correction to the brief, and why it changes the design

The handoff said *"`member_facts` currently scopes each member to their own rows"*
via RLS, and that the directory therefore needs a deliberate read path rather than
a loosened policy on that table. The conclusion is right. The premise is not, and
the difference matters.

I checked `supabase-schema.sql`. RLS is enabled on all 14 tables and there are
**zero policies** — `grep -c "create policy"` returns 0. The schema comment at
line ~318 explains this deliberately: enabled-with-no-policies is deny-by-default
for the `anon` and `authenticated` roles, and the only Supabase client in the
codebase (`lib/appStore.ts`, `import "server-only"`) authenticates with
`SUPABASE_SERVICE_ROLE_KEY`, which carries `bypassrls`. No browser ever talks to
Supabase directly.

So member-to-member isolation today is **not** enforced by RLS. It is enforced by
application code: `getMemberFacts(memberId)` is only ever called with the
caller's own Clerk `userId`.

Two consequences:

1. **You cannot secure the directory by writing an RLS policy**, because the
   service role ignores policies. Anything the server code asks for, it gets. The
   real control has to be a server-side read path that *structurally cannot*
   return non-consented data — not a policy that a service-role query bypasses.
2. **RLS policies are still worth writing**, as defence in depth for the day
   someone adds a browser-side client. But they are the second line, not the
   first, and this design does not depend on them.

---

## 1. What is publishable at all

Not "everything in `member_facts` that the member ticks". The catalog has 24
facts and most of them should never be publishable *even if a member consents*,
because consent to publish is not informed when the member doesn't grasp the
consequence. These are business-financial and compliance internals:

`bank_account`, `bookkeeping_system`, `monthly_costs`, `pays_estimated_tax`,
`insurance_carrier`, `insurance_limits`, `advisor`, `formation_date`,
`formation_state`, `entity_structure`, `has_employees`, `seller_permit`,
`industry_license`, `ownership_basis`, `pricing_basis`, and every `*_renewal_date`
and `sam_registration_date`.

Publishing `monthly_costs` or `insurance_limits` hands a competitor a costing
model. Publishing `sam_registration_date` or a renewal date tells anyone watching
exactly when a business lapses. A member ticking a box does not make that a good
outcome for them, and the portal should not offer the box.

**The eligible set — a hard-coded allowlist, not a member-configurable one:**

| Source | Field | Why it belongs in a trade directory |
|---|---|---|
| `members` | `business_name` | The listing needs a name |
| `members` | `industry` | Primary browse axis |
| `members` | `city` | Secondary browse axis; local trade is the point |
| `member_facts` | `core_capabilities` | What they actually do — the core of the listing |
| `member_facts` | `naics_codes` | Precise matching; already collected for bid matching |
| `member_facts` | `certifications_held` | MBE/DBE/WBE — a real reason to seek a supplier out |
| `member_facts` | `target_customer` | Tells a browser whether they're a fit |
| new | short blurb | Member-authored, in their words, for the listing specifically |

The allowlist lives in code as a constant, and the directory table has one column
per eligible field. A fact key added to `data/facts.ts` next year is therefore
**not** publishable by default — someone has to deliberately add a column. That is
the intended friction.

---

## 2. Consent

Five requirements. None of them is optional.

**Opt-in, never opt-out.** Default state is not listed. No member is enrolled by
a migration, an announcement, or a "we're launching this, tell us if you object".

**Per-field, expressed as presence.** Rather than a parallel table of booleans,
each eligible field is its own nullable column on the listing row. A field the
member didn't share is `NULL`. This is deliberate: a boolean table lets the value
and the permission drift apart, and a bug that reads the value while missing the
boolean leaks. A `NULL` column cannot leak, because there is nothing in it.

**Informed, and recorded as such.** The opt-in screen states in plain language,
above the toggles and not behind a link: *who* can see this (other signed-in WCCC
members — name them as a group, and say roughly how many), *what* exactly is
shown (a live preview of their own listing as others will see it), that it is
**not** public to the open web and not indexed by search engines, and how to
withdraw. The row stores `consent_version` and `consented_at`. If the disclosure
text changes materially, the version bumps and consent is re-collected — existing
listings go back to `draft` rather than silently continuing under terms the member
never saw.

**Withdrawable in one click, effective immediately.** Setting `status` to
`withdrawn` removes it from every read. And the confirmation should be honest
rather than reassuring: other members may already have seen or copied the details,
so withdrawal stops future disclosure — it cannot retract past disclosure. Saying
so costs nothing and is true.

**Auditable.** An append-only `member_directory_consent_log`: member id, action
(`published` / `updated` / `withdrawn`), `consent_version`, the list of fields
shared, timestamp. If a member ever asks "what did you show about me, and when",
there has to be an answer that isn't a guess.

### Contact method — decision needed (Q1)

Publishing member email addresses to every other member creates a spam and
harvesting surface, and a member who opted into a *trade directory* did not
thereby opt into a mailing list. Three options:

- **(a) In-portal relay.** Other members click "contact", the portal sends the
  message. Email addresses are never exposed. Safest; needs an outbound mail
  path, which is real extra work.
- **(b) Member chooses**, per listing: show my email / contact me through the
  portal / don't show contact details, find me at events. Honest and flexible.
- **(c) Show email to signed-in members.** Simplest. Also the one that generates
  the first complaint.

I'd suggest **(b) with (c) as one of its choices**, deferring the relay to later —
it gets the directory shipped without building mail infrastructure, and no
address is exposed without a specific per-member choice.

---

## 3. Snapshot, not live view — and why

The obvious design is a Postgres view joining `member_facts` to a consent table,
so listings are always current and there's one copy of the data. **I'm
recommending against it**, for one reason that I think is decisive:

A member fills in `core_capabilities` during a guided compliance step, months
after opting into the directory, with no directory context on screen. Under a live
view, that text is published to the whole chamber the instant they hit save. They
consented to publishing *the text they reviewed at opt-in* — not to a standing
grant over whatever that field contains forever. That's consent drift, and it is
precisely the failure this whole design exists to prevent.

The secondary reason: a view is only as safe as its join condition and its column
list. Get either subtly wrong — or add a fact key later that the view's filter
doesn't exclude — and it leaks. A snapshot table physically contains only
publishable data, so the same bug can't produce the same outcome.

**The cost, stated plainly:** snapshots go stale. Two mitigations, both required:

- When a member edits a fact that has a published copy, the dashboard shows
  "your directory listing is out of date — review and republish". The listing
  stays as-is until they act; it does not auto-update.
- Every listing displays its own `published_at` on screen, so a browsing member
  can see they're reading something from four months ago.

*(Rejected alternative, recorded so nobody re-litigates it silently: the live view.
It is DRY and never stale, and those are real advantages. It loses on consent
drift, which is a correctness problem rather than a maintenance one.)*

---

## 4. Schema sketch

```sql
create table if not exists member_directory_listings (
  member_id text primary key references members(id) on delete cascade,

  -- draft: member started, hasn't consented. published: visible to members.
  -- withdrawn: kept (not deleted) so the audit log stays meaningful and a
  -- member who re-opts-in doesn't retype everything. Never read when withdrawn.
  status text not null default 'draft'
    check (status in ('draft', 'published', 'withdrawn')),

  -- One column per allowlisted field. NULL means "not shared" — see §2.
  display_business_name text,
  display_industry      text,
  display_city          text,
  core_capabilities     text,
  naics_codes           text,
  certifications_held   text,
  target_customer       text,
  blurb                 text,

  contact_method text not null default 'none'
    check (contact_method in ('none', 'email', 'relay')),
  contact_email  text,

  consent_version text not null,
  consented_at    timestamptz,
  published_at    timestamptz,
  updated_at      timestamptz not null default now()
);

-- Browse is "published listings, filtered by industry or city". Partial index
-- because the withdrawn and draft rows are never in a result set and there is
-- no reason for them to occupy the index. Expression index on lower() because
-- members type their own city — "Madison" and "madison" have to match.
create index if not exists member_directory_published_idx
  on member_directory_listings (lower(display_industry), lower(display_city))
  where status = 'published';

-- Append-only. Never updated, never deleted. See §2.
create table if not exists member_directory_consent_log (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  action text not null check (action in ('published', 'updated', 'withdrawn')),
  consent_version text not null,
  fields_shared text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table member_directory_listings   enable row level security;
alter table member_directory_consent_log enable row level security;
```

Consistent with the rest of the schema: RLS on, no policies, service role only.
If a browser client is ever added, the *only* policy to write is on the listings
table —

```sql
create policy directory_read on member_directory_listings
  for select to authenticated using (status = 'published');
```

— and `member_facts` policies stay untouched, permanently.

---

## 5. Read path

One function in `lib/appStore.ts`, and these rules:

- **Explicit column list. Never `select("*")`.** A `*` means any column added
  later is published the moment it exists. Naming columns makes publication a
  deliberate act each time.
- **`status = 'published'` in the query itself**, not filtered in JS afterwards.
  The performance fix in the last session was exactly this pattern for member
  documents; the security argument is stronger than the performance one.
- **Caller must be a signed-in member** via Clerk `auth()`, same as every other
  route. Directory reads are not public.
- **Paginated, with a hard row cap and no bulk export.** The realistic abuse here
  isn't an outside attacker, it's a member scraping the whole chamber into a
  prospect list. A cap doesn't prevent that, but it makes it deliberate and slow
  rather than one click.
- **Empty means empty.** If nobody has opted in yet, the page says so. No sample
  listings, no placeholder businesses — same house rule that got the fabricated
  events removed.

### Reciprocity — decision needed (Q2)

Should a member have to be listed themselves in order to browse others? It
drives opt-in and feels fair. It also punishes the member who is genuinely
looking for a supplier but has nothing to sell, and it converts a free choice
into a toll. My inclination is **no** — require signed-in and active membership,
nothing more — but this is a chamber-culture call, not a technical one, and it's
yours.

---

## 6. Suggested build order

1. Schema + `lib/appStore.ts` functions (get / upsert / withdraw / log). No UI.
2. Opt-in screen: the disclosure text, per-field toggles, live preview of the
   member's own listing exactly as others will see it, publish and withdraw.
3. Browse UI: filter by industry, city, certification; search `core_capabilities`
   and `naics_codes`.
4. The out-of-date-listing banner in the dashboard.
5. Contact — per whatever Q1 lands on.

Steps 1 and 2 are the ones worth reviewing closely. 3 through 5 are ordinary
feature work once the consent model is settled.

---

## 7. What I need from you

- **Q1 — contact method.** Relay, member-chooses, or plain email? (I lean
  member-chooses.)
- **Q2 — reciprocity.** Must you be listed to browse? (I lean no.)
- **Q3 — the disclosure text.** Who at WCCC signs off on the wording members
  consent to? I can draft it, but it shouldn't ship on my say-so.
- **Q4 — the allowlist in §1.** Anything you'd add or, more importantly, remove?
- **Q5 — launch.** Does the directory go live with whatever opt-ins exist, however
  few, or is there a minimum before it's worth showing? An empty directory is
  honest but reads as broken.

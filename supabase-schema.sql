-- Run this in your Supabase SQL editor: Dashboard → SQL Editor → New query

create table if not exists members (
  id text primary key,           -- Clerk user ID
  email text not null unique,
  name text not null default '',
  business_name text not null default '',
  industry text not null default '',
  city text not null default '',
  journey text not null default 'business',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

-- Migration: add industry and city if upgrading an existing database
alter table members add column if not exists industry text not null default '';
alter table members add column if not exists city text not null default '';

-- Migration: add membership tier fields if upgrading an existing database
alter table members add column if not exists membership_tier text not null default 'network';
alter table members add column if not exists membership_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'members_membership_tier_check'
  ) then
    alter table members add constraint members_membership_tier_check
      check (membership_tier in ('network', 'individual', 'business', 'corporate'));
  end if;
end $$;

create table if not exists login_events (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  session_id text not null default '',
  email text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

-- Migration: add session_id if upgrading a database created before this
-- column existed (create table if not exists is a no-op on existing tables,
-- so it wouldn't otherwise be added).
alter table login_events add column if not exists session_id text not null default '';

create unique index if not exists login_events_member_session_idx
  on login_events(member_id, session_id)
  where session_id <> '';

create table if not exists event_registrations (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  event_title text not null,
  created_at timestamptz not null default now(),
  unique(member_id, event_title)
);

create table if not exists program_enrollments (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  program_title text not null,
  created_at timestamptz not null default now(),
  unique(member_id, program_title)
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  type text not null,
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

-- Attendance is separate from registration: a member can register for an
-- event ahead of time, and is only marked "attended" once they check in
-- (see checkInForEventAction in app/actions.ts).
create table if not exists event_attendance (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  event_title text not null,
  created_at timestamptz not null default now(),
  unique(member_id, event_title)
);

-- Indexes: the dashboard always queries these tables filtered by member_id
-- and, for activities/logins, ordered by created_at. Without these, lookups
-- degrade to sequential scans as the tables grow. These two tables need
-- explicit indexes because neither has a unique constraint starting with
-- member_id (login_events' unique index is partial, so it can't serve
-- general member lookups or the created_at ordering).
create index if not exists activities_member_created_idx
  on activities(member_id, created_at desc);

create index if not exists login_events_member_created_idx
  on login_events(member_id, created_at desc);

-- Removed: redundant with the index Postgres already creates for
-- unique(member_id, event_title) — a btree on (member_id, event_title)
-- serves member_id-only lookups via its leading column, so this was a
-- duplicate that cost an extra write on every check-in and bought nothing.
-- Verified against Postgres: member_id lookups still use an index scan on
-- event_attendance_member_id_event_title_key without it.
drop index if exists event_attendance_member_idx;

-- AI Business Builder: one row per member/module/step. `answers` holds the
-- guided-question responses for that step as { [questionKey]: string }.
-- `completed` drives the checkbox + the module's completion %.
create table if not exists module_step_progress (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  module_key text not null,
  step_key text not null,
  completed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(member_id, module_key, step_key)
);

-- Removed: redundant with unique(member_id, module_key, step_key) above.
-- getModuleProgress filters on (member_id, module_key), which is the leading
-- prefix of that unique index, so the planner uses it either way. This table
-- takes a write on every guided-step save, so the duplicate index was the
-- most expensive of the three.
drop index if exists module_step_progress_member_module_idx;

-- The AI-generated "save summary" artifact per module (e.g. a member's
-- Business Idea Summary from the Launch engine). One saved artifact per
-- member per module — regenerating overwrites the previous one.
create table if not exists module_summaries (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  module_key text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_id, module_key)
);

-- Funding & Programs: AI-generated matches (grants, loans, certifications,
-- WCCC/WEDC/SBA programs) tailored to one member's industry/city/stage.
-- Excludes contracts/RFPs, which are the roadmap's own "Opportunity" stage.
-- One row per member — regenerating overwrites the previous set, same
-- pattern as module_summaries. `content` is a JSON array of
-- { title, type, description, whyItFits, nextStep }.
create table if not exists member_opportunities (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade unique,
  content jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

-- Business Snapshot: a short questionnaire (data/assessment.ts) that scores
-- a member's business maturity and records which single roadmap module
-- their stated "most urgent need" unlocks for free, regardless of
-- membership tier (see isModuleUnlocked in data/modules.ts). One row per
-- member — retaking the assessment overwrites the previous result, same
-- upsert pattern as module_summaries / member_opportunities.
-- `answers` holds the raw question-key -> selected-option-value map so past
-- answers can be re-shown if the member reopens the form to update it.
create table if not exists business_assessments (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade unique,
  answers jsonb not null default '{}'::jsonb,
  score int not null default 0,
  stage text not null default '',
  free_module_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Removed: an exact duplicate. `member_id ... unique` on the column above
-- already creates a btree index on exactly (member_id); this added a second
-- identical one. Never shipped to production, so nothing to clean up unless
-- an earlier version of this script was already run.
drop index if exists business_assessments_member_idx;

-- Decision Grill: one row per finished grilling — the member states a
-- decision they're weighing, the AI interrogates it one question at a time,
-- then writes a decision brief. Unlike member_opportunities /
-- business_assessments this deliberately KEEPS A HISTORY rather than
-- upserting one row per member: looking back at how you decided something
-- six months ago is the point of the feature, so each session inserts.
-- `transcript` is the JSON array of { role, content } turns; `brief` is the
-- generated { decision, recommendation, confidence, keyFactors, blindSpots,
-- risks[], nextSteps[] } object (validated server-side before it's stored,
-- see normalizeBrief in app/api/ai/grill/route.ts). Nothing is written until
-- a brief is generated, so abandoned sessions leave no rows behind.
create table if not exists member_decisions (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  topic text not null,
  transcript jsonb not null default '[]'::jsonb,
  brief jsonb not null,
  created_at timestamptz not null default now()
);

-- Kept, unlike the three indexes dropped above: this table has no unique
-- constraint to piggyback on, and the only query against it is
-- getMemberDecisions — filter on member_id, order by created_at desc, limit N.
-- The descending second column lets Postgres satisfy both the filter and the
-- sort from one index scan and stop at the limit, instead of reading every
-- row a member has and sorting them.
create index if not exists member_decisions_member_created_idx
  on member_decisions (member_id, created_at desc);

-- Module toolkit: documents a member generates for their own business from a
-- module's tools (see `tools` on BusinessModule in data/modules.ts) — a 90-day
-- marketing plan, outreach emails, a follow-up system. Written from their
-- saved guided-step answers, so each one is specific to their business.
--
-- Unlike module_summaries (one row per member per module, regenerating
-- overwrites), this keeps a history: these are work product a member may want
-- to come back to, and losing last month's marketing plan because they
-- generated a new one would be its own bug.
create table if not exists member_documents (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  module_key text not null,
  tool_key text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Kept, for the same reason as member_decisions_member_created_idx: no unique
-- constraint on this table to piggyback on, and both queries against it filter
-- on member_id and order by created_at desc — the document list, and the
-- 24-hour count backing the per-member daily generation cap. One index scan
-- serves both instead of reading every row a member owns and sorting.
create index if not exists member_documents_member_created_idx
  on member_documents (member_id, created_at desc);

-- Member facts: the canonical answers about one business, so the portal asks
-- for a thing once and reuses it everywhere. See data/facts.ts for the
-- catalog and the reasoning.
--
-- One row per member per fact — writing the same fact again overwrites it,
-- because there is only ever one current answer to "what is your entity
-- structure". `source` and `source_label` record where the value last came
-- from ("launch" / "Register your business & EIN") so the UI can tell the
-- member why a box was already filled in; provenance the member can't see is
-- provenance they can't correct.
--
-- `confirmed_at` is separate from `updated_at` on purpose. Re-saving a step
-- without touching a carried-over value still means the member looked at it
-- and let it stand, which is what the staleness check in data/facts.ts reads.
-- `updated_at` only moves when the value itself changes.
--
-- Values are stored as text regardless of the fact's declared type. Dates are
-- ISO YYYY-MM-DD strings and choice facts hold their option value; both are
-- validated against the catalog before they get here (isValidFactValue), so
-- the column stays one shape and the meaning lives in one place.
create table if not exists member_facts (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  fact_key text not null,
  value text not null,
  source text not null default 'profile',
  source_label text not null default '',
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  unique(member_id, fact_key)
);

-- No separate member_id index, for the same reason the three dropped above
-- were redundant: every read here is "all facts for this member", which the
-- unique(member_id, fact_key) btree already serves through its leading
-- column. This table takes a write on every guided-step save, so a duplicate
-- index would cost on the hot path and buy nothing.

-- Every AI generation a member fires, one row per attempt. Backs the per-member
-- daily caps in lib/aiRateLimit.ts.
--
-- Attempts, not successes: the row is written before the model is called, so a
-- request that fails or times out still counts. The provider bills for tokens
-- it produced regardless of whether this app could use them, and a failing
-- endpoint being retried in a loop is exactly the case a cap exists to stop.
--
-- This replaces counting rows in member_documents, which was the previous
-- limiter for the document generator. That count was bypassable — deleting a
-- document freed up quota — and blind to generations that never saved.
--
-- `route` is the API route key ("coach", "grill", "document", ...), so limits
-- can differ per feature and usage is auditable per feature.
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  route text not null,
  created_at timestamptz not null default now()
);

-- Serves both reads: "this member's calls in the last 24h" and the same
-- narrowed to one route. member_id leads because every query filters on it;
-- created_at descending lets the window scan stop early instead of reading a
-- member's whole history.
create index if not exists ai_usage_member_created_idx
  on ai_usage (member_id, created_at desc);

-- Row Level Security: ENABLED on every table, with no policies attached.
--
-- This looks like it would lock the app out. It doesn't: the only Supabase
-- client in the codebase is lib/appStore.ts, which is `import "server-only"`
-- and authenticates with SUPABASE_SERVICE_ROLE_KEY. The service role carries
-- the `bypassrls` attribute, so it reads and writes normally regardless of
-- what is set here. No browser ever talks to Supabase directly.
--
-- These lines used to read `disable row level security`. That is the riskier
-- setting, because Supabase serves every table in the `public` schema over
-- PostgREST, and the project's anon key is designed to be publishable — it is
-- safe to expose precisely BECAUSE RLS constrains it. With RLS off, anyone
-- holding that key can read and write every row here: member emails, business
-- names, assessments, decision briefs. Enabled with no policies is deny-by-
-- default for the anon and authenticated roles, and costs this app nothing.
--
-- If you ever add a browser-side Supabase client, it will correctly get zero
-- rows until you write explicit policies for it. That is the point.
alter table members enable row level security;
alter table login_events enable row level security;
alter table event_registrations enable row level security;
alter table program_enrollments enable row level security;
alter table activities enable row level security;
alter table event_attendance enable row level security;
alter table module_step_progress enable row level security;
alter table module_summaries enable row level security;
alter table member_opportunities enable row level security;
alter table business_assessments enable row level security;
alter table member_decisions enable row level security;
alter table member_documents enable row level security;
alter table member_facts enable row level security;
alter table ai_usage enable row level security;

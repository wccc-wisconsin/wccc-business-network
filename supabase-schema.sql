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

create table if not exists login_events (
  id uuid primary key default gen_random_uuid(),
  member_id text not null references members(id) on delete cascade,
  session_id text not null default '',
  email text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

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

-- Disable RLS (service role key bypasses it anyway, but keeps it simple)
alter table members disable row level security;
alter table login_events disable row level security;
alter table event_registrations disable row level security;
alter table program_enrollments disable row level security;
alter table activities disable row level security;

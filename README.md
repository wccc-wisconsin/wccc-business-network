This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database

Auth is handled by Clerk; member data lives in Supabase. To set up (or update) the database, run `supabase-schema.sql` in the Supabase dashboard: **Dashboard → SQL Editor → New query**.

The script is additive and safe to re-run — every statement uses `if not exists` guards, so running it against an already-set-up database just applies any new columns/tables without touching existing data. When you add a field that `lib/appStore.ts` reads or writes, add a matching `alter table ... add column if not exists` migration here in the same PR, or the app will silently fail to persist it (this happened with `membership_tier` and `membership_expires_at` — see PR #1).

### Applying it

1. Supabase dashboard → SQL Editor → New query → paste all of `supabase-schema.sql` → Run.
2. Paste all of `supabase-verify.sql` → Run.

Step 2 runs two checks: that every one of the 103 columns the app reads or
writes exists, and that Row Level Security is on for every table. Every row should read `ok`. It is
generated from `supabase-schema.sql`, so regenerate it when you add a table or
column there.

Do step 2 even when step 1 reports success. Several tables are newer than the
last deploy, and the features behind them **fail silently** when their table is
absent — the member fills in the form, sees a result, and nothing is saved:

| Table | Feature that silently no-ops without it |
| --- | --- |
| `member_opportunities` | Funding & Programs matches aren't kept between visits |
| `business_assessments` | Business Snapshot doesn't save, and grants no free module |
| `member_decisions` | Decision Grill briefs are lost when the member leaves the page |
| `member_documents` | Module toolkit documents aren't kept |
| `member_facts` | Facts gathered from guided steps don't carry over, and the compliance calendar can't personalise |
| `ai_usage` | The per-member daily caps on the AI features stop applying — see `lib/aiRateLimit.ts`. Fails open, so AI keeps working, uncapped |
| `grants_cache` | Every funding search calls Grants.gov live again, inside the member's request, and the nightly `/api/cron/refresh-grants` job has nowhere to write. Degrades to the pre-cache behaviour rather than breaking — so it looks fine and is simply slower and more fragile |
| `conversations` | Coach chats are never stored. The chat itself works; "Past chats" in the Coach stays empty however much a member talks to it, and the coach opens cold every visit because there is nothing to read back. Its `opening` and `message_count` columns are newer than the table — without those two the list read fails and the drawer is empty even though the transcripts are there |

A note on re-running: `create table if not exists` is a **no-op on a table that
already exists**, so it will not add a column to a table created by an earlier
version of this script. Existing tables get explicit `alter table ... add column
if not exists` migrations instead — that mismatch is what bit `membership_tier`
and `membership_expires_at` in PR #1. When you add a field that `lib/appStore.ts`
reads or writes, add the matching `alter table` here in the same PR.

**Row Level Security is enabled on every table, with no policies.** That is
deliberate and does not lock the app out: the only Supabase client is
`lib/appStore.ts`, which is `server-only` and connects with
`SUPABASE_SERVICE_ROLE_KEY` — the service role bypasses RLS. Supabase serves
every `public` table over PostgREST, and the anon key is meant to be
publishable *because* RLS constrains it; with RLS off, that key would grant
read/write on member emails, assessments and decision briefs. If you ever add
a browser-side Supabase client it will get zero rows until you write explicit
policies, which is the intended behaviour.

**Index cleanup, applied by the same run:** three indexes were redundant with
the index Postgres already creates for a `unique(...)` constraint
(`event_attendance_member_idx`, `module_step_progress_member_module_idx`,
`business_assessments_member_idx`). A btree on `(a, b)` already serves lookups
on `a`, so each duplicate cost a write on every insert/update and bought no read
speed. They're now `drop index if exists`, verified against a real Postgres: the
affected queries still plan as index scans on the unique-constraint index.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

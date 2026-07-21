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

**Pending migration:** this file now includes `member_opportunities` (backs the dashboard's Funding & Programs panel — AI-generated grants/loans/certifications/programs matched to each member; deliberately excludes contracts/RFPs, which are the roadmap's own "Opportunity" stage). Re-run the script in the Supabase SQL Editor to add it; until then the feature degrades gracefully (members can generate matches, they just won't be saved between visits).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Presensi FILKOM is a university attendance management system built with **Next.js 16** (App Router, React 19) + **Supabase** (PostgreSQL + Auth). It is a single Next.js application (not a monorepo).

### Running the application

- **Dev server**: `npm run dev` (starts on port 3000)
- **Build**: `npm run build`
- **Lint**: `npm run lint` (ESLint; the codebase has pre-existing lint errors/warnings that are not blockers)

### Environment variables

A `.env.local` file is required with:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side, bypasses RLS)
- `CRON_SECRET` — (optional, only enforced in production) auth token for the auto-close cron endpoint

Without valid Supabase credentials, the app starts and pages render, but all data operations (login, fetching records, scanning) will fail at runtime.

### Key routes

- `/login` — Admin login (Supabase Auth)
- `/` — Dashboard (auth-protected)
- `/student` — Public student attendance lookup
- `/scan/[token]` — Public scanner page (PIN-gated)

### Database schema

The Supabase schema is defined in `supabase/schema.sql`. There is no local database; all data goes through the hosted Supabase instance.

### Gotchas

- The middleware uses Supabase client creation with `!` non-null assertions on env vars. If the env vars are completely absent (not even placeholders), the app will crash at startup.
- ESLint exits with code 1 due to pre-existing errors (31 errors, 16 warnings as of setup). This is expected behavior from the codebase.
- The `npm run build` command succeeds even with placeholder Supabase credentials since static pages don't make runtime Supabase calls during build.

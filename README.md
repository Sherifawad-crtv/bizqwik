# Bizqwik

Internal attendance & payout portal for a calisthenics department. Coaches log training
sessions; heads review and settle; an accountant pays. Built as a mobile-first PWA (native
tab bar + FAB on mobile, sidebar + tables on desktop ≥1024px).

## Roles

- **Coach** — logs own sessions, views own running total and history
- **Head Coach** — everything a coach can do, plus settles/reopens any coach's month
- **Department Head** — everything a head coach can do, plus manages tiers, invites, and
  people, and views the multi-month oversight dashboard
- **Accountant** — marks settled coaches as paid; no session-logging access

## Stack

- React + TypeScript + Vite
- React Router
- `@supabase/supabase-js` — auth + the `make-server-980e1cbf` edge function as the API

## Local development

```bash
npm install
npm run dev
```

To point the Vite app at a **local** Supabase stack (Phase 1+ of the backend plan), create
`.env.local` (gitignored via `*.local`):

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase status`>
```

Restart `npm run dev` after changing env. Without these vars, the app falls back to the
cloud project baked into `src/lib/supabaseClient.ts`.

### API contract + smoke (Phase 0)

Frozen Edge route/JSON fixtures live under `supabase/tests/contract/`. Validate them:

```bash
./supabase/tests/smoke/smoke.sh
```

After local Edge is up: `./supabase/tests/smoke/smoke.sh --live` (see `supabase/tests/smoke/README.md`).

Backend architecture / local-first plan: `docs/architecture/backend.md` and
`docs/architecture/backend-phase-0-1.md`.

## Backend

All data access goes through `src/lib/backend.ts`, which targets the Supabase project
configured in `src/lib/supabaseClient.ts` (defaults to "Bizqwik Test"). Override per Vercel
environment with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to point elsewhere (e.g. a
Production deploy against the "Bizqwik - Production" project) without touching the code.

## Deployment

Connected to Vercel — pushes to `main` deploy automatically. `vercel.json` includes the SPA
rewrite required for client-side routing (React Router) to work on refresh/direct navigation.

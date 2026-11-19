# Local seed

Runs automatically on `supabase db reset` via `supabase/seed.sql`
(see `[db.seed]` in `config.toml`).

## Logins (local only)

| Email | Password | Role |
|---|---|---|
| `depthead@local.test` | `local-dev-password` | dept_head |
| `frontdesk@local.test` | `local-dev-password` | front_desk |
| `client@local.test` | `local-dev-password` | client (member app) |

Org: **Local Dev Gym** (`local-dev-gym`).

## After reset

1. `supabase db reset` (applies baseline + seed)
2. Point the app at local with `.env.local` (see repo README)
3. `npm run dev` and sign in with a seed email above
4. Serve functions: `supabase functions serve make-server-980e1cbf`

Never reuse these passwords on remote projects.

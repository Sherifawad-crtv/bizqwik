# 0015 — Backend Phase 1: local Supabase + baseline

**Date:** 2026-11-19  
**Branch:** `dev-mahmoud`

## What landed

- Remote schema dump from Sherif lab (`aylhnxniqrihpvrllpgz`) into
  `supabase/migrations/20261119_00_baseline_from_remote.sql` via Session
  pooler (`postgres.<ref>@aws-0-eu-central-1.pooler.supabase.com`).
- Older incremental SQL moved to `supabase/migrations_archive/` so local
  `db reset` applies baseline only (strategy C).
- `supabase/seed.sql` + `supabase/seed/README.md` — local Auth users and
  gym data; password `local-dev-password`.
- `.env.local` (gitignored) → `http://127.0.0.1:54321` + local anon key.
- Generated `src/lib/database.types.ts` from local schema.
- Verified: `supabase db reset` twice, Auth login, Edge `/me` `/profiles`
  `/locations`, and `smoke.sh --live` all green.

## Connection note

Direct host `db.<ref>.supabase.co` did not resolve here (no A/AAAA). Use
the pooler URL with URL-encoded password (`@` → `%40`, `%` → `%25`) and
username `postgres.<project-ref>`.

## Still out of scope

No Production deploy, no wallet RPCs, no Edge split.

# Migrations

## Local source of truth (Phase 1+)

`20261119_00_baseline_from_remote.sql` is a **full schema snapshot** of project
`aylhnxniqrihpvrllpgz` (Sherif lab), taken with `supabase db dump` via the
Session pooler.

For **local** `supabase db reset`, only this baseline (plus any **new**
migrations dated after it) should run.

### Strategy

- **Baseline** = recreate the whole remote schema on an empty local DB.
- Older incremental SQL files lived in git but did **not** cover the full
  early schema (hand-applied on remote). They are kept under
  `supabase/migrations_archive/` for history only — **not** applied by
  `db reset`.
- **Production / remote cutover must NOT re-apply the baseline.** Remote
  already has these objects. Cutover later applies only **new** migrations
  written after this baseline (Phase 2+ money RPCs, etc.).

### Naming

- Baseline: `YYYYMMDD_00_baseline_from_remote.sql`
- New work: `YYYYMMDD_NN_<short_name>.sql` with dates **after** the baseline
- Do not resurrect archive files into `migrations/` unless you intentionally
  replace the baseline workflow

### Refreshing the baseline (rare)

Only if local drift from the lab remote is intentional to re-sync:

```bash
# Prefer Session pooler URL with user postgres.<project-ref>
# Password: URL-encode @ → %40 and % → %25
set -a && source supabase/.env && set +a
supabase db dump --db-url "$DATABASE_URL" \
  -f supabase/migrations/20261119_00_baseline_from_remote.sql
```

Do not dump into Production cutover history without an explicit plan.

### Seed

`supabase/seed.sql` runs on every `db reset`. Logins and notes:
`supabase/seed/README.md`.

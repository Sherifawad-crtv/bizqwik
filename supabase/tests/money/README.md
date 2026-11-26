# Money RPC tests (Phase 2)

Requires local Supabase (`supabase start` / after `db reset`).

## One command (Phase 6)

Live verify includes the parallel concurrency check:

```bash
npm run backend:verify:live
# or full reset + serve + suite:
npm run backend:verify:ci
```

See `scripts/backend-verify.sh` and `docs/architecture/backend-phase-6.md`.

## Flag

Edge reads `MONEY_RPC`:

| Value | Behaviour |
|---|---|
| unset / `0` / `false` / `off` | Legacy JS helpers (default until M6) |
| `1` / `true` / `on` | Postgres RPCs |

```bash
MONEY_RPC=1 supabase functions serve make-server-980e1cbf
# or: supabase functions serve --env-file supabase/functions/.env.local
```

## Scripts

```bash
# SQL parity + grant + cross-org checks
psql "$DB_URL" -f supabase/tests/money/parity.sql

# Sequential “second debit loses” check
psql "$DB_URL" -f supabase/tests/money/concurrency.sql

# True parallel full-balance debits (expects exactly one win)
python3 supabase/tests/money/concurrency_parallel.py
```

`DB_URL` for local is usually `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

Shadow mode was **not** enabled (parity via SQL suite instead).

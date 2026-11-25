# API smoke

## One command (Phase 6)

From the repo root:

```bash
npm run backend:verify              # fixture dry-run
npm run backend:verify:live         # needs supabase start + functions serve
```

See `scripts/backend-verify.sh` and `docs/architecture/backend-phase-6.md`.

## Phase 0 (no server)

Validates that contract fixtures exist, parse as JSON, and contain the required keys:

```bash
chmod +x supabase/tests/smoke/smoke.sh
./supabase/tests/smoke/smoke.sh
```

## Phase 1+ (local Edge)

With `supabase start` and `supabase functions serve` (see Phase 1 playbook):

```bash
# from `supabase status` — API URL is usually http://127.0.0.1:54321
export SMOKE_BASE_URL="http://127.0.0.1:54321/functions/v1/make-server-980e1cbf"
export SMOKE_ANON_KEY="<anon key from supabase status>"
# optional: user access token after signing in via the local app
export SMOKE_JWT="<access_token>"

./supabase/tests/smoke/smoke.sh --live
```

### Getting `SMOKE_JWT`

1. Run the Vite app against local Supabase and sign in as a seed user.  
2. DevTools → Application → Local Storage (or Network on `/token`) → copy `access_token`.  
3. Or sign in with the Auth API using email/password and read `access_token` from the JSON.

Without `SMOKE_JWT`, `--live` still checks `/health` only.

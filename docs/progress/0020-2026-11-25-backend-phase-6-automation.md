# 0020 — Backend Phase 6: local automation / CI

**Date:** 2026-11-25  
**Branch:** `dev-mahmoud`  
**Playbook:** `docs/architecture/backend-phase-6.md`

## What landed

```
scripts/backend-verify.sh              # --dry | --live | --ci
package.json                           # backend:verify / :live / :ci
.github/workflows/backend-verify.yml   # dry always; live local Supabase when backend paths change
docs/architecture/backend-phase-6.md
supabase/tests/smoke/README.md         # one-command pointer
supabase/tests/money/README.md         # one-command pointer
```

## Verified locally

- `npm run backend:verify` (dry) green  
- `npm run backend:verify:live` green (smoke health+me + concurrency_parallel)

## Intentional leave-behinds

- `tenant-isolation.ts` not in default verify (GATE / manual).  
- Live CI job skips on PRs that only touch non-`supabase/` paths.  
- No Production secrets; no Production deploy.

## Still out of scope

GATE full acceptance walkthrough; CUTOVER.

# 0018 — Backend Phase 4: dedupe solo-desk / clients-list

**Date:** 2026-11-19  
**Branch:** `dev-mahmoud`  
**Playbook:** `docs/architecture/backend-phase-4.md`

## What landed

```
supabase/functions/
  _shared/
    db.ts              # unchanged (admin / env)
    auth.ts            # real requireUser(c) via admin() — no make-server import
    mappers.ts         # real toClient / toPackageInstance / toMembershipInstance / list toGroupPlan
    clientsCore.ts     # imports mappers from _shared/mappers (no local copies)
    errors.ts          # still thin stub
  clients-list/index.ts  # adminClient + requireUser + loadClients from _shared
  solo-desk/index.ts     # adminClient + requireUser from _shared; soloOwner stays local
  make-server-980e1cbf/
    context.ts           # re-exports requireUser + shared list mappers from _shared;
                         # keeps richer toGroupPlan (freeze / share fields)
```

**Shared `requireUser` API:** `requireUser(c)` using `admin()` from `_shared/db.ts` (preferred shape from M0).

## Verified locally

- `functions serve` boots all three slugs
- `smoke.sh --live` (health + me) green
- `GET clients-list/clients` 200; ids/core fields match main `GET /clients` (6 seed clients)
- `GET solo-desk/org-settings`: 403 on seed `mode=team`; after local `mode='solo'` → 200 with `dropInPrice` / `instapayQr` / `instapayAddress` / price maps; mode restored to `team`
- `concurrency_parallel.py` green

## Intentional leave-behinds

- Main `context.toGroupPlan` stays richer (freezeDays / frozenUntil / canFreeze / shareGroupId); `_shared/mappers.toGroupPlan` is the list/summary shape used by `clientsCore`.
- Domain helpers remain in `context.ts`; `services/*` facades unchanged.
- No Production deploy.

## Still out of scope

Zod / org helper (Phase 5); CI (Phase 6); slug renames.

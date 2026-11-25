# 0019 — Backend Phase 5: validation + org helper

**Date:** 2026-11-25  
**Branch:** `dev-mahmoud`  
**Playbook:** `docs/architecture/backend-phase-5.md`

## What landed

```
supabase/functions/_shared/
  org.ts        # clientInOrg / staffInOrg / rowInOrg
  errors.ts     # errBody + jsonError
  validate.ts   # Zod money/desk schemas + parseBody (npm:zod@3.23.8)
make-server-980e1cbf/
  context.ts    # staffInMyOrg → _shared/org.staffInOrg
  routes/desk.ts# M0 money POSTs: parseBody + org-scoped lookups
docs/architecture/backend-phase-5.md
```

Validated POSTs: `packages`, `check-ins`, `drop-ins`, `group-plans/sell`, `bookings/collect`, `clients/refund`, `clients/compensate`.

## Verified locally

- `smoke.sh --live` green  
- Schema reject: bad UUID → 400 `clientId: Invalid uuid`; missing `bookingId` → 400  
- `POST clients/compensate` 200; unknown/other-org client id → 404 `No such client`  
- `POST drop-ins` 200 (cash); check-in reaches domain (`no_plan`) after schema accept  
- `concurrency_parallel.py` green  

## Intentional leave-behinds

- Zod not applied to non-money routes (catalog/ops/client-app money can follow later).  
- Full `tenant-isolation.ts` phased deploy not run this pass — focused cross-tenant id check via unknown UUID + org-scoped helpers documented instead.  
- Domain error copy/codes unchanged (`insufficient_wallet`, `active_plan_confirm`, etc.).  
- No Production deploy.

## Still out of scope

Phase 6 automation/CI; Production cutover.

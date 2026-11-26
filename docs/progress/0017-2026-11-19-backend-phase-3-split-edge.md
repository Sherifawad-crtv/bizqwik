# 0017 — Backend Phase 3: split Edge source

**Date:** 2026-11-19  
**Branch:** `dev-mahmoud`  
**Playbook:** `docs/architecture/backend-phase-3.md`

## What landed

```
supabase/functions/
  _shared/
    db.ts              # admin client, MONEY_RPC, P, secrets/vapid helpers
    auth.ts            # facade → make-server context (Phase 4 will own copies)
    mappers.ts         # facade → context
    errors.ts          # thin stub for Phase 5
    clientsCore.ts     # pre-existing
  make-server-980e1cbf/
    index.ts           # ~37 lines: CORS + mount routers only
    context.ts         # domain helpers (wallet/points/sales/…) used by routes
    routes/
      me.ts catalog.ts desk.ts settlements.ts
      accounting.ts client-app.ts classes.ts ops.ts
    services/
      wallet.ts points.ts sales.ts activity.ts   # re-export facades for Target layout
```

- **134 routes** moved into slice modules; mount pattern `register(app)` from each file.
- API contract unchanged (same paths/JSON).
- `solo-desk` / `clients-list` untouched (Phase 4).

## Verified locally

- `supabase functions serve` boots
- `smoke.sh --live` green
- `GET locations`, `POST clients/compensate` (RPC) OK
- `concurrency_parallel.py` green

## Deviations / follow-ups

- Domain helpers still live mainly in `context.ts` (not fully physically moved into every `services/*.ts` body). Services + `_shared/auth|mappers` are **facades** so Phase 4 has a stable import surface; deepen the move when touching those areas.
- `_shared/auth.ts` → `context.ts` is a temporary coupling; Phase 4 should own real shared implementations without importing the main function’s context.

## Still out of scope

No Production deploy; no solo/clients-list dedupe (Phase 4); no Zod (Phase 5).

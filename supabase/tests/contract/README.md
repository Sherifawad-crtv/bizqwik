# API contract fixtures (frozen — Current)

These files record the **Current** HTTP API that the business PWA expects via
`src/lib/backend.ts` and `src/lib/types.ts`.

They exist so backend refactors (money RPCs, splitting the Edge Function) cannot
silently rename paths or JSON keys.

## Rules

1. **Changing a fixture = changing the contract.** That needs an explicit
   expand/contract plan ([backend-guidelines.md](../../../docs/architecture/backend-guidelines.md)),
   not a drive-by cleanup.
2. Keep **keys and value types**. Fake/redact PII (`name`, `email`, `phone`).
3. Each `*.json` fixture may include a `_meta` object (ignored by clients; for humans/smoke).
4. Route inventory: [routes.md](./routes.md).

## How these were captured (Phase 0)

Derived from Edge handler `c.json(...)` return shapes and matching TypeScript
interfaces in `src/lib/types.ts` / `backend.ts`. Marked
`capturedFrom: "edge-source+types"`.

**Phase 1 follow-up:** once local Supabase + seed users work, re-verify each
critical fixture against a real local response and set
`capturedFrom: "local-verified"` (or paste a redacted live Network capture).

## Critical fixtures

| File | Path | Why |
|---|---|---|
| `health.success.json` | `GET health` | Liveness |
| `me.success.json` | `GET me` | Every logged-in screen |
| `me.unauthorized.json` | `GET me` | Auth failure |
| `check-ins.success.json` | `POST check-ins` | Desk core |
| `drop-ins.success.json` | `POST drop-ins` | Desk sale |
| `drop-ins.active-plan-confirm.json` | `POST drop-ins` | UI branches on `code` |
| `packages.wallet-sale.success.json` | `POST packages` | Wallet-paid desk sale |
| `packages.insufficient-wallet.json` | `POST packages` | Money error `code` |
| `clients-refund.wallet.success.json` | `POST clients/refund` | Refund to wallet |
| `accounting-pnl.success.json` | `GET accounting/pnl` | Accounting read |

## Updating

1. Change the Edge route only with expand/contract.  
2. Update the fixture in the **same** PR as `backend.ts` / `types.ts` if the app uses new fields.  
3. Note why in `docs/progress/`.  

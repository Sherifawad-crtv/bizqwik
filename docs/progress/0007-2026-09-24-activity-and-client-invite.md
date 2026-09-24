# 0007 — Activity feed + logs, front-desk app invite (Phase 3, slice 3)

**Date:** 2026-09-24

## What changed
Two frontend-only pieces on already-deployed endpoints (v43) — no backend/deploy.

**Activity (`/activity`, dept_head + front_desk)** — `src/routes/Activity.tsx`:
- `Segmented` toggle between **Feed** (friendly per-event cards with a category
  chip — SALE / WALLET / POINTS / CLASS / CHECK-IN — a plain sentence, time, and
  a signed amount) and **Logs** (dense complete ledger: time · type · client ·
  amount, every row).
- `describe()` maps each `activity_log.type` to a sentence; unknown types fall
  back to a humanized label so new event types render without a code change.
- Reached as a drill-in (`pushDepth("/activity") = 1`): an **Activity** card on
  Oversight (dept_head) and a "Full activity & logs" link under the front-desk
  home's own check-in feed. Route gated to both roles.
- `src/lib/types.ts` `ActivityEntry`; `src/lib/backend.ts` `api.activity(limit)`.

**Front-desk: invite a client to the app** — `src/routes/frontdesk/Members.tsx`:
- New `invite` mode in the client sheet: an EMAIL field (prefilled from the
  client's stored email) → `api.inviteClient(clientId, email)` → success state.
  Button label flips to "Re-invite to app" when an email is already on file.
- `src/lib/backend.ts` `api.inviteClient` → `POST /client-invites`.

## Verification
`npx tsc -b` + `npm run build` clean (206 modules). Endpoints pg_net-verified in
0004. Full mocked-Playwright click-through of all Phase 3 screens is batched into
Phase 5.

## Follow-ups (rest of Phase 3)
- The money-flow backend deploy (one edge re-emit): payment selector
  cash/card/wallet on desk sales, staff booking list + arrived/no-show, refund →
  wallet/desk, admin compensation — then wire their UIs.

# 0006 — Dept-head class management (Phase 3, slice 2)

**Date:** 2026-09-24

## What changed
The dept_head screen for scheduling the classes members book in the app. No
backend/deploy — wires the already-deployed `/classes` GET/POST/update/cancel
endpoints (v43).

- **`src/lib/types.ts`**: `GymClass` + `GymClassStatus` (`active` | `cancelled`,
  matching the DB check constraint — the insert defaults to `active`).
- **`src/lib/backend.ts`**: `api.classes()`, `createClass`, `updateClass`,
  `cancelClass`.
- **`src/routes/ClassesManage.tsx`** (new): list of scheduled classes (title,
  date+time, price or "Free", description) with a cancelled section below;
  create/edit in a `Sheet` (title, description, `DateField` date, 30-min-slot
  `SelectField` time — no native pickers, keeps iOS PWA standalone, price EGP);
  cancel via `ConfirmSheet` (flags the automatic wallet refund).
- **Reached as a drill-in**, not a 6th bottom-nav tab (dept_head already has 5
  tabs + a FAB; a 6th clips on narrow phones). A "Classes" card on **Oversight**
  navigates to `/classes`; `RouteTransition` `pushDepth("/classes") = 1` so the
  mobile push animation and in-body "‹ Oversight" back link match `/coaches/:id`.
- **`src/App.tsx`**: `/classes` route under the dept_head `RequireRole` group.

`startsAt` is built as `new Date(`${date}T${time}:00`).toISOString()` (local →
UTC), so it round-trips through the timestamptz column and displays back in
local time.

## Verification
`npx tsc -b` + `npm run build` clean. Endpoints pg_net-verified in 0004; the api
client field mapping matches the handlers 1:1. Fixed a status mismatch before
ship (type said `scheduled`; DB default is `active`).

## Follow-ups (rest of Phase 3)
- activity feed + Logs tab (`/activity`); front-desk client-invite + wallet-fund.
- batched money-flow backend deploy: payment selector (cash/card/wallet), staff
  booking list + arrived/no-show, refund→wallet/desk, compensation.

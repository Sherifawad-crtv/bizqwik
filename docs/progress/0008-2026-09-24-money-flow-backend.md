# 0008 — Money-flow backend deployed (Phase 3, slice 4)

**Date:** 2026-09-24 · **Edge function:** `make-server-980e1cbf` **v44**

## What changed
One consolidated edge-function deploy adding the money flow. Designed to be
**non-breaking**: `payMethod` defaults to `"cash"`, so the current business app
(which sends no `payMethod`) behaves exactly as before — the new wallet-debit
code only runs when a caller explicitly sends `wallet`. Revolt's live sale paths
are untouched until the UI opts in.

- **`normPayMethod()`** helper (`cash` | `card` | `wallet`, default `cash`).
- **Desk sales** (`/clients`, `/packages`, `/memberships/sell`, `/drop-ins`):
  accept `payMethod`; `wallet` debits store credit (FIFO) and rolls the sale back
  on insufficient balance (`code: insufficient_wallet`); the method is recorded in
  the sale's `activity_log` meta. New-client creation rejects `wallet` (no balance
  yet). cash/card are recorded only (external tender).
- **Class ops** (staff, dept_head + front_desk):
  - `GET /classes/:id/bookings` — roster with client name, pay/attendance status.
  - `POST /bookings/attendance` — mark `arrived` / `no_show` (logs the event).
  - `POST /bookings/collect` — settle a pay-at-desk booking; `wallet` debits, else
    recorded as desk tender (`class_bookings.pay_method` is wallet|desk; the exact
    cash/card lives in the activity log).
- **Refunds & compensation:**
  - `POST /clients/refund` (dept_head + front_desk) — `destination: wallet` credits
    store credit; `desk` records the equivalent only (real money handled outside
    Bizqwik, "we just give them the equivalent").
  - `POST /clients/compensate` (dept_head) — goodwill wallet credit.
- New activity types: `booking_arrived`, `booking_no_show`, `class_collected`,
  `refund_desk` (plus `wallet_refund` / `wallet_compensation` via `creditWallet`).

## Deploy safety (the whole-file re-emit)
The MCP `deploy_edge_function` requires the full file inline. Process: edited the
repo file, local `tsc` syntax check (0 TS1xxx), diffed against deployed v43 to
confirm only intended hunks (also reconciled two stale comments), deployed v44,
then **re-fetched v44 and diffed byte-for-byte against the repo file — identical**.
`verify_jwt=true` preserved. `/health` → 200 via pg_net (boots + serves).

## Follow-ups
- Wire the UIs (no deploy): payment selector on desk sales; class roster +
  arrived/no-show + collect (dept_head/front_desk); refund + compensation actions
  on the client sheet.
- Phase 5: full money-flow pg_net functional suite (wallet debit/refund/compensate/
  collect/attendance on a disposable member) + mocked Playwright.

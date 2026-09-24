# 0002 — Client app v1 scope frozen

**Date:** 2026-09-24

## What changed
Rewrote `docs/architecture/client-app-integration.md` into the frozen v1 spec
after a full requirements pass with the product owner. Key resolutions:
- **Wallet** = EGP store credit; credited by refund-to-wallet + dept_head
  compensation; spent as a desk payment method **and** on in-app class bookings;
  12-month FIFO expiry; no top-ups/gateway.
- **Points** = symmetric rate B (one per-org `points_per_egp`, 5/10/15/20);
  earn = flat 1/check-in + `EGP×rate` on desk purchases (not on bookings);
  redeem = desk discount `points÷rate` at renewal/new package.
- **Classes** = dept_head-created dated classes (title, description, date, time,
  price), uncapped, no staff/slots; members book paying by **wallet now** or
  **at desk on arrival**; cancel → refund to wallet or desk.
- **Staff** get an activity **feed** + a **Logs tab** (all money/points/booking/
  attendance events); tiers/streaks/achievements cut; English only.
- Reuse existing `wallets`/`wallet_transactions`/`points_ledger`/`points_balances`
  (extend wallet txns with FIFO `expires_at`/`remaining`); add `org_settings`,
  `org_branding`, `client_invitations`, `clients.auth_user_id`, `classes`,
  `class_bookings`, `activity_log`.

## Why
The client app repo turned out to be a UI-only Figma-Make prototype describing a
larger product than the current back-office; this pass scoped a coherent v1 that
reuses the backend and defers booking-perks + payments.

## Verification
Docs only. No code/schema yet.

## Follow-ups
- Phase 1 (schema) is next.
- Still parked: rewards perks catalog, online payments, native app.
- One assumed default to confirm: arrived/no-show marking (front desk marks;
  check-in may auto-mark arrived).

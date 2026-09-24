# 0004 — Client app Phase 2: backend engines deployed

**Date:** 2026-09-24

## What changed
Extended `make-server-980e1cbf` (deployed v43) for the member app:
- **Auth:** signup now has a `client_invitations` branch (links the existing
  client row to the new auth user); `/me` returns a `client` identity.
- **Wallet engine:** EGP store credit with FIFO credit lots, lazy 12-month
  expiry (`creditWallet`/`debitWallet`/`sweepWalletExpiry`/`walletBalance`).
- **Points engine:** symmetric per-org rate — flat 1/check-in + `EGP×rate` on
  desk purchases (wired into `/clients`, `/packages`, `/memberships/sell`,
  `/drop-ins`); value in EGP = `points ÷ rate`.
- **`/client/*`:** public `branding`, `home`, `classes`, `classes/:id/book`
  (wallet or pay-at-desk), `bookings`, `bookings/:id/cancel` (refund→wallet),
  `check-in` (org-QR gated, +1 pt), `wallet`, `points`.
- **Classes:** dept_head CRUD (`/classes` GET/POST/update/cancel; cancel refunds
  wallet-paid bookings); **staff `/activity` feed**; `/client-invites` to invite
  a member to the app; ops `/ops/orgs/:id/{config,branding,settings}`.
- Every money/points/booking/attendance event writes to `activity_log`.

## Verification (pg_net, disposable member on Revolt, cleaned up)
Signup→link→signin; `/me` (client only); branding; home; classes; wallet;
points. Check-in (+1 pt, eligibility gate); wallet booking (FIFO debit 500→400);
duplicate-book blocked; cancel (refund→wallet, 400→500). `activity_log` captured
points_earned/check_in/class_booked/wallet_refund/class_cancelled. Ops
branding+settings set/read-back (appName, color, 3 onboarding assets, rate 15).
All test data + the test's Revolt branding/settings rows removed; Revolt back to
its original state.

## Follow-ups
- Phase 3: business-app + ops UI for classes, refunds/compensation, payment
  selector, feed + Logs tab, ops points rate + branding upload.
- The ops founder temp password still works — it should be rotated.

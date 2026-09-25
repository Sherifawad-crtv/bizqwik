# 0011 — Phase 5 verification + critical money-flow fix

**Date:** 2026-09-24 · **Edge function:** `make-server-980e1cbf` **v45**

## Summary
Phase 5 = end-to-end verification of the money flow shipped in v44 (progress
0008/0009). The verification pass **caught a live money bug** and fixed it in
v45. Both apps typecheck and build clean.

## The bug (found by the pg_net suite)
A wallet-paid **desk sale** silently drained the member's store credit **without
writing a debit ledger row**. Repro: sell a package with `payMethod: "wallet"` —
the FIFO credit lot's `remaining` dropped by the price, but no `debit` row was
recorded, so the ledger no longer reconciled (`sum(remaining)` ≠
`credits − debits`).

**Root cause (two faults in `debitWallet`):**
1. It inserted the debit row with category `"purchase"`, which is **not** in the
   `wallet_transactions_category_check` constraint
   (`session, refund, topup, reward, cashback, compensation, desk_sale,
   class_booking, expiry`) — the insert threw.
2. The lot-`remaining` decrement ran **before** that insert, so the throw left
   the credit consumed but unrecorded (non-atomic ordering).

## The fix (v45)
- `debitWallet` now **inserts the debit ledger row first**, then consumes credit
  lots — so if anything fails the credit is never silently drained.
- The three desk-sale handlers (`/packages`, `/memberships/sell`, `/drop-ins`)
  pass the allowed category **`"desk_sale"`** (was the illegal `"purchase"`).
- Deployed v45 via full-file re-emit; `verify_jwt=true` preserved.

## Verification (pg_net, disposable dept_head + member on Revolt)
Ran the full money loop against the live function and asserted the ledger after
each step. Final ledger (member):
`credit compensation 10000 | debit desk_sale 3200 | debit class_booking 150 |
credit refund 150 | credit refund 500`
- `sum(remaining of credit lots)` = **7300**
- `credits − debits` = **7300** — **reconciles** (pre-v45 these diverged).
- Cancel refunded 150 to wallet; booking → `cancelled/refunded`.
- Refund `destination: wallet` credited; `destination: desk` touched no wallet
  (log-only). All events present in `activity_log` (incl. distinct `refund_desk`
  vs `wallet_refund`).

## Cleanup
All disposable rows removed: test member client + auth user, test dept_head
profile + auth user, 3 ZZ classes, package/booking/wallet/points rows, their
`activity_log` entries, and the `zz_*` SQL helpers/tables. Verified zero `zz`
residue. **Left intact:** real Revolt coach (Abdelrahman Ahmed), Revolt's 3
bundle types, and the org rows.

## Notes / follow-ups
- Both apps: `tsc -b` + `npm run build` clean. Added `src/vite-env.d.ts` to the
  client app so `import.meta.env` typechecks (build already worked; tsc didn't).
- Mocked-network Playwright smoke per app (`npm run test:e2e`), fully offline
  against the dev server, all green:
  - business (`e2e/frontdesk-money.spec.ts`): login form + redirect; front-desk
    Drop-In payment selector (cash/card, wallet hidden for walk-ins) → record;
    dept-head-only route gated for front_desk.
  - client (`e2e/member-flow.spec.ts`): branded intro → sign in → home → book a
    class (pay from wallet) → bookings → profile → wallet; unknown gym shows the
    friendly "Gym not found".
- Unrelated observations (not touched): Revolt is `status: trial`; leftover
  `test`/`Test2`/`test3` orgs from ops verification remain.

# 0003 — Client app Phase 1: schema applied

**Date:** 2026-09-24

## What changed
Applied the client-app v1 schema to the Supabase project (two migrations, now
tracked in `supabase/migrations/`):
- `clients.auth_user_id` (+ partial unique index) and RLS helpers
  `my_client_id()` / `my_client_org_id()`.
- New tables: `client_invitations`, `org_branding` (incl. `onboarding_assets`),
  `org_settings` (`points_per_egp`, `wallet_credit_ttl_months`), `classes`,
  `class_bookings`, `activity_log`.
- Extended `wallet_transactions` with `expires_at` + `remaining` (FIFO expiry)
  and widened its category CHECK (`compensation`, `desk_sale`, `class_booking`,
  `expiry`).
- RLS on all new tables (one collapsed `manage` policy for team+staff), member
  self-read policies on classes/bookings/clients/wallet/points, covering indexes
  on the new FKs.
- Started tracking migrations in-repo (`supabase/migrations/`), which the repo
  wasn't doing before.

## Why
Phase 1 of the frozen client-app v1 spec — the additive data foundation the
backend/business-app/client-app phases build on.

## Verification
Migrations applied successfully. Confirmed all six tables + columns + widened
CHECK + both helpers + 24 policies present. Advisors: only performance
INFO/WARN (unindexed FKs — since indexed; unused-index on brand-new indexes;
some multiple-permissive/defense-in-depth overlaps that are moot because the
edge function uses the service role). **No security or correctness errors.**

## Follow-ups
- Phase 2 (backend): signup `client` branch, `/me` client, `/client/*`,
  wallet/points engines, classes/bookings, activity log, RLS-gated.

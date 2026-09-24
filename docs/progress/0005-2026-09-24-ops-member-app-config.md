# 0005 — Ops member-app config UI (Phase 3, slice 1)

**Date:** 2026-09-24

## What changed
First Phase 3 slice — the ops screen where Bizqwik sets each org's member-app
config at onboarding. No backend/deploy: wires the already-verified
`/ops/orgs/:id/{config,branding,settings}` endpoints (v43).

- **`src/lib/types.ts`** (from prior slice): `OrgBrandingConfig`,
  `OrgPointsSettings`, `OrgConfig`.
- **`src/lib/backend.ts`** (from prior slice): `api.ops.orgConfig(id)`,
  `setOrgBranding(id, b)`, `setOrgSettings(id, pointsPerEgp, ttlMonths)`.
- **`src/routes/ops/OrgDetail.tsx`**: new **Member app** section (`OrgAppConfig`
  loader → `OrgAppConfigForm`, keyed by org id so it re-seeds per org). Editable:
  - **Branding** — app name, logo URL, icon URL, primary color, 3 onboarding-art URLs.
  - **Loyalty** — points earn rate as a picker (Off / 5 / 10 / 15 / 20 points per
    EGP; symmetric rate, so redemption value = points ÷ rate), and wallet-credit
    expiry in months (default 12, min 1).
  - Save calls `setOrgBranding` then `setOrgSettings`, then refetches; inline
    "Saved." confirmation and error banner.

Empty branding fields save as `null`; empty onboarding URLs are dropped from the
array. "Off" points rate saves `pointsPerEgp: null` (points disabled for that org).

## Verification
`npx tsc -b` clean; `npm run build` clean (204 modules). Endpoints themselves
were pg_net-verified in 0004 (set/read-back of appName, color, 3 assets, rate 15).

## Follow-ups (rest of Phase 3)
- dept_head class management screen (CRUD over `/classes`).
- front-desk client-invite + wallet-fund screens.
- activity feed + Logs tab (`/activity`).
- batched money-flow backend deploy: payment selector (cash/card/wallet) on desk
  sales, refund→wallet/desk, admin compensation.

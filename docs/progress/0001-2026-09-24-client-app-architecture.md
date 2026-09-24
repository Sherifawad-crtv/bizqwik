# 0001 — Client app integration: architecture + progress convention

**Date:** 2026-09-24

## What changed
- Added the progress-log convention (`docs/progress/README.md`): one entry per
  push, with living design docs kept separately under `docs/architecture/`.
- Added the client-app integration design doc
  (`docs/architecture/client-app-integration.md`) capturing the agreed
  architecture for the white-labeled member app: shared backend, `role=client`
  identity + invite/real-email signup, per-org `*.bizqwik.co` PWA branding,
  org-encoded check-in QR, data-model additions, RLS, the PWA per-host strategy,
  and provisioning through the ops dashboard.

## Why
Before writing any client-integration code we wanted the architecture agreed and
documented — clean layering first — and a durable progress trail going forward.
The design is repo-independent at the platform/back-end layer; only the
client-app front-end specifics wait on the incoming client repo.

## Verification
Docs only — no code or schema changes. `tsc`/build unaffected.

## Follow-ups
- Phase 1 (schema) can start now; Phases 4–5 (client front-end) finalize against
  the client repo once shared.
- Confirm the client app's stack/hosting so per-host manifest + `apple-touch-icon`
  injection is designed correctly.

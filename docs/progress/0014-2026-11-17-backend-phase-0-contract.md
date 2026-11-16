# 0014 — 2026-11-17 — Backend Phase 0: freeze API contract

## What changed

- Added `supabase/tests/contract/`: route inventory (`routes.md`) and critical JSON
  fixtures for health, me, check-ins, drop-ins (incl. `active_plan_confirm`), wallet
  package sale / insufficient wallet, wallet refund, accounting P&L.
- Added `supabase/tests/smoke/smoke.sh` (+ README): dry-run validates fixtures; `--live`
  hits local Edge after Phase 1.
- Playwright: use bundled Chromium by default; only honor `PLAYWRIGHT_CHROMIUM_PATH`
  when set (Mac-friendly).
- Documented local `.env.local` pointing in `README.md`.
- Living backend docs: architecture, guidelines, implementation plan, Phase 0–1 playbook;
  frontend audit note under `docs/audit/`.

## Why

Seatbelt before money RPCs / Edge split: the live PWA’s paths and JSON keys must not
drift. All work stays local until the full plan GATE; no Production deploy in this phase.

## Verification

- [x] `./supabase/tests/smoke/smoke.sh` (fixture dry-run)
- [x] `npm run build`
- [x] Playwright browser install / config no longer requires `/opt/pw-browsers/chromium`
- [ ] Live `--live` smoke — blocked on Phase 1 local stack
- [ ] Fixtures re-verified against real local responses — Phase 1 follow-up

## Follow-ups

- Phase 1: `config.toml`, baseline schema, seed, local functions serve, UI login.
- Re-stamp fixture `_meta.capturedFrom` to `local-verified` once smoke `--live` works.

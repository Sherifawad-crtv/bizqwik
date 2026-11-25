#!/usr/bin/env bash
# One-command backend verify (Phase 6).
#
#   bash scripts/backend-verify.sh           # --dry (default): contract fixtures
#   bash scripts/backend-verify.sh --live    # smoke --live + money concurrency (stack must be up)
#   bash scripts/backend-verify.sh --ci      # db reset + functions serve + --live (CI / full local)
#
# Never points at Production. Seed password is local-only (see supabase/seed.sql).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="dry"
SEED_EMAIL="${BACKEND_VERIFY_EMAIL:-depthead@local.test}"
SEED_PASSWORD="${BACKEND_VERIFY_PASSWORD:-local-dev-password}"

usage() {
  cat <<'EOF'
Usage: bash scripts/backend-verify.sh [--dry|--live|--ci|-h]

  --dry   Contract/smoke fixture dry-run (default; no Docker)
  --live  Live Edge smoke (health+me) + wallet concurrency (needs supabase start + functions serve)
  --ci    Reset local DB (migrations+seed), serve functions, then --live
EOF
}

ok() { printf 'ok  %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry) MODE=dry ;;
    --live) MODE=live ;;
    --ci) MODE=ci ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; fail "unknown arg: $1" ;;
  esac
  shift
done

run_dry() {
  step "smoke fixture dry-run"
  bash "$ROOT/supabase/tests/smoke/smoke.sh"
}

load_status_env() {
  # Prefer explicit overrides, else supabase status.
  if [[ -n "${API_URL:-}" && -n "${ANON_KEY:-}" ]]; then
    return 0
  fi
  eval "$(supabase status -o env)"
  : "${API_URL:?supabase status missing API_URL}"
  : "${ANON_KEY:?supabase status missing ANON_KEY}"
  : "${DB_URL:?supabase status missing DB_URL}"
}

fetch_seed_jwt() {
  curl -sS "$API_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$SEED_EMAIL\",\"password\":\"$SEED_PASSWORD\"}" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); t=d.get("access_token");
sys.exit("auth failed: "+str(d)[:240]) if not t else print(t)'
}

wait_health() {
  local base="$1" anon="$2" i code
  for i in $(seq 1 60); do
    code=$(curl -sS -o /tmp/bq-verify-health.json -w "%{http_code}" \
      -H "apikey: $anon" -H "Authorization: Bearer $anon" \
      "$base/health" || true)
    if [[ "$code" == "200" ]]; then
      ok "Edge /health ready"
      return 0
    fi
    sleep 1
  done
  fail "Edge /health not ready (last HTTP ${code:-none})"
}

run_live() {
  step "load local supabase status"
  load_status_env
  local base jwt
  base="${SMOKE_BASE_URL:-$API_URL/functions/v1/make-server-980e1cbf}"
  base="${base%/}"

  step "sign in seed user ($SEED_EMAIL)"
  jwt=$(fetch_seed_jwt)

  step "smoke --live"
  SMOKE_BASE_URL="$base" \
  SMOKE_ANON_KEY="$ANON_KEY" \
  SMOKE_JWT="$jwt" \
    bash "$ROOT/supabase/tests/smoke/smoke.sh" --live

  step "money concurrency_parallel"
  python3 "$ROOT/supabase/tests/money/concurrency_parallel.py" "$DB_URL"
}

SERVE_PID=""
cleanup_ci() {
  if [[ -n "${SERVE_PID}" ]] && kill -0 "$SERVE_PID" 2>/dev/null; then
    kill "$SERVE_PID" 2>/dev/null || true
    wait "$SERVE_PID" 2>/dev/null || true
  fi
  rm -f /tmp/bq-backend-verify-functions.env
}

run_ci() {
  step "supabase db reset (migrations + seed)"
  supabase db reset

  step "write local functions env (MONEY_RPC=1)"
  printf 'MONEY_RPC=1\n' > /tmp/bq-backend-verify-functions.env

  step "functions serve (background)"
  trap cleanup_ci EXIT
  MONEY_RPC=1 supabase functions serve --no-verify-jwt --env-file /tmp/bq-backend-verify-functions.env \
    >/tmp/bq-backend-verify-serve.log 2>&1 &
  SERVE_PID=$!

  load_status_env
  local base="$API_URL/functions/v1/make-server-980e1cbf"
  wait_health "$base" "$ANON_KEY"

  run_live
  cleanup_ci
  trap - EXIT
  ok "ci suite complete"
}

case "$MODE" in
  dry) run_dry ;;
  live) run_dry; run_live ;;
  ci) run_dry; run_ci ;;
esac

ok "backend-verify ($MODE) complete"

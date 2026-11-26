#!/usr/bin/env bash
# API smoke: validate contract fixtures, optionally hit a live Edge base URL.
#
# Phase 0: always run fixture dry-run (no server required):
#   ./supabase/tests/smoke/smoke.sh
#
# Phase 1+ (local functions serving):
#   SMOKE_BASE_URL="http://127.0.0.1:54321/functions/v1/make-server-980e1cbf" \
#   SMOKE_JWT="<access_token>" \
#   SMOKE_ANON_KEY="<local anon key>" \
#   ./supabase/tests/smoke/smoke.sh --live
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CONTRACT="$ROOT/supabase/tests/contract"
LIVE=0
if [[ "${1:-}" == "--live" ]]; then LIVE=1; fi

red() { printf '%s\n' "$*" >&2; }
ok() { printf 'ok  %s\n' "$*"; }
fail() { red "FAIL $*"; exit 1; }

# --- dry-run: every *.json fixture must parse; required set must exist -----
REQUIRED=(
  health.success.json
  me.success.json
  me.unauthorized.json
  check-ins.success.json
  drop-ins.success.json
  drop-ins.active-plan-confirm.json
  packages.wallet-sale.success.json
  packages.insufficient-wallet.json
  clients-refund.wallet.success.json
  accounting-pnl.success.json
  routes.md
  README.md
)

for f in "${REQUIRED[@]}"; do
  [[ -f "$CONTRACT/$f" ]] || fail "missing $f"
done

python3 - <<PY
import json, pathlib, sys
c = pathlib.Path(r"$CONTRACT")
errors = []
for p in sorted(c.glob("*.json")):
    try:
        data = json.loads(p.read_text())
    except Exception as e:
        errors.append(f"{p.name}: {e}")
        continue
    if not isinstance(data, dict):
        errors.append(f"{p.name}: root must be object")
        continue
    meta = data.get("_meta")
    if meta is not None:
        for key in ("method", "path", "status"):
            if key not in meta:
                errors.append(f"{p.name}: _meta missing {key}")
    # body keys excluding _meta must exist for success-shaped files
    body_keys = [k for k in data if k != "_meta"]
    if not body_keys:
        errors.append(f"{p.name}: empty body")
if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
print(f"parsed {len(list(c.glob('*.json')))} fixtures")
PY
ok "fixture dry-run"

# Required keys on critical fixtures (contract integrity)
python3 - <<PY
import json, pathlib, sys
c = pathlib.Path(r"$CONTRACT")
checks = {
  "health.success.json": ["status"],
  "me.success.json": ["profile", "orgMode", "org", "tier", "bizqwikTeam", "client"],
  "me.unauthorized.json": ["error"],
  "check-ins.success.json": ["checkIn", "deducted"],
  "drop-ins.success.json": ["dropIn"],
  "drop-ins.active-plan-confirm.json": ["error", "code", "activePlan"],
  "packages.wallet-sale.success.json": ["package"],
  "packages.insufficient-wallet.json": ["error", "code"],
  "clients-refund.wallet.success.json": ["ok", "walletBalance"],
  "accounting-pnl.success.json": ["month", "current", "trend", "revenueBySource", "expensesBySource", "hasPastExpenses", "unsettledNote"],
}
err = []
for name, keys in checks.items():
    data = json.loads((c / name).read_text())
    for k in keys:
        if k not in data:
            err.append(f"{name} missing key {k}")
    if name.endswith("active-plan-confirm.json") and data.get("code") != "active_plan_confirm":
        err.append(f"{name} code must be active_plan_confirm")
    if name.endswith("insufficient-wallet.json") and data.get("code") != "insufficient_wallet":
        err.append(f"{name} code must be insufficient_wallet")
if err:
    print("\n".join(err), file=sys.stderr)
    sys.exit(1)
print("required keys present")
PY
ok "required keys"

if [[ "$LIVE" -eq 0 ]]; then
  ok "dry-run complete (pass --live after Phase 1 to hit Edge)"
  exit 0
fi

# --- live hits -------------------------------------------------------------
: "${SMOKE_BASE_URL:?set SMOKE_BASE_URL to .../functions/v1/make-server-980e1cbf}"
: "${SMOKE_ANON_KEY:?set SMOKE_ANON_KEY (local anon key)}"

BASE="${SMOKE_BASE_URL%/}"

hdr=(-H "apikey: $SMOKE_ANON_KEY" -H "Authorization: Bearer ${SMOKE_ANON_KEY}")
# health often allows anon key as bearer on gateway
code=$(curl -sS -o /tmp/bq-smoke-health.json -w "%{http_code}" "${hdr[@]}" "$BASE/health" || true)
[[ "$code" == "200" ]] || fail "health HTTP $code"
python3 - <<'PY'
import json
body = json.load(open("/tmp/bq-smoke-health.json"))
assert body.get("status") == "ok", body
print("health body ok")
PY
ok "GET health"

if [[ -z "${SMOKE_JWT:-}" ]]; then
  red "SMOKE_JWT not set — skipping GET me (set a user access token to enable)"
  ok "live smoke partial"
  exit 0
fi

code=$(curl -sS -o /tmp/bq-smoke-me.json -w "%{http_code}" \
  -H "apikey: $SMOKE_ANON_KEY" \
  -H "Authorization: Bearer $SMOKE_JWT" \
  "$BASE/me" || true)
[[ "$code" == "200" ]] || fail "me HTTP $code (body=$(cat /tmp/bq-smoke-me.json))"
python3 - <<'PY'
import json
body = json.load(open("/tmp/bq-smoke-me.json"))
for k in ("profile", "orgMode", "org", "tier", "bizqwikTeam", "client"):
    if k not in body:
        raise SystemExit(f"me missing {k}")
print("me keys ok")
PY
ok "GET me"
ok "live smoke complete"

#!/usr/bin/env sh
# Post-deploy smoke test script.
# Usage: bash scripts/smoke.sh [BASE_URL]
# Default BASE_URL: http://localhost:4000

set -e

BASE_URL="${1:-http://localhost:4000}"
PASS=0
FAIL=0

check() {
  LABEL="$1"
  EXPECTED_STATUS="$2"
  ACTUAL_STATUS="$3"
  BODY="$4"
  BODY_CHECK="$5"

  if [ "$ACTUAL_STATUS" = "$EXPECTED_STATUS" ] && echo "$BODY" | grep -q "$BODY_CHECK"; then
    echo "  PASS: $LABEL"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $LABEL (expected HTTP $EXPECTED_STATUS got $ACTUAL_STATUS, body check '$BODY_CHECK')"
    FAIL=$((FAIL + 1))
  fi
}

echo "Running smoke tests against: $BASE_URL"
echo ""

# 1. Health check: GET /health -> 200, body contains "status":"ok"
HEALTH_STATUS=$(curl -s -o /tmp/smoke_health.json -w "%{http_code}" "$BASE_URL/health")
HEALTH_BODY=$(cat /tmp/smoke_health.json)
check "GET /health -> 200 with status:ok" "200" "$HEALTH_STATUS" "$HEALTH_BODY" '"status"'

# 2. Public products: GET /api/public/products -> 200
PUBLIC_STATUS=$(curl -s -o /tmp/smoke_products.json -w "%{http_code}" "$BASE_URL/api/public/products")
PUBLIC_BODY=$(cat /tmp/smoke_products.json)
check "GET /api/public/products -> 200" "200" "$PUBLIC_STATUS" "$PUBLIC_BODY" "."

# 3. Admin gate: GET /api/admin/products (no token) -> 401
ADMIN_STATUS=$(curl -s -o /tmp/smoke_admin.json -w "%{http_code}" "$BASE_URL/api/admin/products")
ADMIN_BODY=$(cat /tmp/smoke_admin.json)
check "GET /api/admin/products (no token) -> 401" "401" "$ADMIN_STATUS" "$ADMIN_BODY" "."

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

exit 0

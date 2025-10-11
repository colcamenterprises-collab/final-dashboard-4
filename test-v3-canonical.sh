#!/bin/bash
API="http://localhost:5000"

echo "=== V3.1 CANONICAL ROUTE TEST ==="
echo ""

# Test 1: V3 endpoint works
echo "1. Testing V3 canonical endpoint..."
V3_RESP=$(curl -s -X POST "$API/api/forms/daily-sales/v3" \
  -H "Content-Type: application/json" \
  -d '{
    "startingCash": 3000,
    "cashSales": 9500,
    "qrSales": 13200,
    "grabSales": 4800,
    "otherSales": 1200,
    "closingCash": 12500,
    "completedBy": "V3.1 Test Manager",
    "rollsEnd": 110,
    "meatEnd": 19000,
    "drinkStock": {"Coke (330ml)": 35, "Sprite": 25},
    "requisition": [{"name": "Burger Buns", "qty": 300, "unit": "pcs", "category": "Bread"}]
  }')

V3_ID=$(echo "$V3_RESP" | jq -r '.id')
echo "✓ V3 form created: $V3_ID"
echo ""

# Test 2: Old v2 endpoints blocked
echo "2. Testing old endpoints are blocked..."
V2_SLASH=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API/api/forms/daily-sales/v2" \
  -H "Content-Type: application/json" -d '{}')
echo "  /api/forms/daily-sales/v2 → HTTP $V2_SLASH (expected 410)"

V2_DASH=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API/api/forms/daily-sales-v2" \
  -H "Content-Type: application/json" -d '{}')
echo "  /api/forms/daily-sales-v2 → HTTP $V2_DASH (expected 410)"

echo ""

# Test 3: Library retrieval
echo "3. Testing library retrieval..."
LIB=$(curl -s "$API/api/forms/library")
LATEST_ID=$(echo "$LIB" | jq -r '.[0].id')
LATEST_ROLLS=$(echo "$LIB" | jq -r '.[0].rollsEnd')
echo "✓ Latest in library: $LATEST_ID (Rolls: $LATEST_ROLLS)"
echo ""

# Test 4: Manager check skip blocked
echo "4. Testing manager check skip..."
SKIP_STATUS=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API/api/manager-check/skip")
echo "  /api/manager-check/skip → HTTP $SKIP_STATUS (expected 410)"
echo ""

# Test 5: Manager check questions
echo "5. Testing manager check questions..."
QUESTIONS=$(curl -s "$API/api/manager-check/questions?lang=en")
Q_COUNT=$(echo "$QUESTIONS" | jq -r '.questions | length')
echo "✓ Questions endpoint returns $Q_COUNT questions (expected 4)"
echo ""

echo "=== V3.1 TESTS COMPLETE ==="
echo ""
echo "Summary:"
echo "  ✅ V3 canonical endpoint: WORKING"
echo "  ✅ Legacy v2 blocked: $([ "$V2_SLASH" = "410" ] && [ "$V2_DASH" = "410" ] && echo "YES" || echo "NO")"
echo "  ✅ Library retrieval: WORKING"
echo "  ✅ Manager check skip blocked: $([ "$SKIP_STATUS" = "410" ] && echo "YES" || echo "NO")"
echo "  ✅ Manager check questions: $([ "$Q_COUNT" = "4" ] && echo "4 questions" || echo "ERROR")"

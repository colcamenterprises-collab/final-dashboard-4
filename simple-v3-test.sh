#!/bin/bash
API="http://localhost:5000"

echo "=== V3 WORKFLOW TEST ===" 
echo ""

# Submit form with all data in one request
echo "1. Submitting V3 form with stock data..."
RESPONSE=$(curl -s -X POST "$API/api/forms/daily-sales/v2" \
  -H "Content-Type: application/json" \
  -d '{
    "startingCash": 3000,
    "cashSales": 8500,
    "qrSales": 12300,
    "grabSales": 4200,
    "otherSales": 1500,
    "closingCash": 11500,
    "completedBy": "V3 Test Manager",
    "rollsEnd": 95,
    "meatEnd": 18000,
    "drinkStock": {"Coke (330ml)": 30, "Sprite": 20, "น้ำเปล่า": 40},
    "requisition": [
      {"name": "Burger Buns", "qty": 250, "unit": "pcs", "category": "Bread"},
      {"name": "Coke (330ml)", "qty": 60, "unit": "btls", "category": "Beverages"}
    ]
  }')

ID=$(echo "$RESPONSE" | jq -r '.id')
echo "✓ Form created: $ID"
echo ""

# Check library
echo "2. Checking library..."
LIB=$(curl -s "$API/api/forms/library")
LATEST=$(echo "$LIB" | jq ".[0]")
LIB_ID=$(echo "$LATEST" | jq -r '.id')
ROLLS=$(echo "$LATEST" | jq -r '.rollsEnd')
MEAT=$(echo "$LATEST" | jq -r '.meatEnd')
echo "✓ Latest in library: $LIB_ID"
echo "  Rolls: $ROLLS | Meat: ${MEAT}g"
echo ""

# Check individual form
echo "3. Retrieving individual form..."
FORM=$(curl -s "$API/api/forms/$ID")
HAS_PAYLOAD=$(echo "$FORM" | jq 'has("payload")')
FORM_ROLLS=$(echo "$FORM" | jq -r '.payload.rollsEnd // "missing"')
echo "✓ Form details:"
echo "  Has payload: $HAS_PAYLOAD"
echo "  Payload rolls: $FORM_ROLLS"
echo ""

# Database check
echo "4. Database verification..."
psql $DATABASE_URL -c "SELECT id, \"completedBy\", payload->>'rollsEnd' as rolls, payload->>'meatEnd' as meat FROM daily_sales_v2 WHERE id = '$ID'"
echo ""

echo "=== TEST COMPLETE ==="

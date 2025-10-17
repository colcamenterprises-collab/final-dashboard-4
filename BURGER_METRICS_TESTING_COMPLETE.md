# Burger Metrics Testing System - Complete ✅

## Summary
Successfully implemented and verified automated burger metrics testing infrastructure for the restaurant management dashboard. The system validates receipt analysis, burger counting, patty calculations, and meat weight tracking.

## Implementation Details

### 1. Fixed Burger Metrics Service
**File**: `server/services/burgerMetrics.ts`

**Critical Fixes Applied**:
- ✅ Changed `r.timestamp` → `r."closedAtUTC"` (schema alignment)
- ✅ Changed `ri.quantity` → `ri.qty` (correct column name)
- ✅ Fixed join condition: `ri.receipt_id` → `ri."receiptId"`

The service now correctly queries the `receipts` and `receipt_items` tables using the actual database schema.

### 2. Universal Seeder Script
**File**: `server/scripts/seed_burger_metrics_universal.ts`

**Features**:
- Auto-detects restaurant ID from database
- Seeds 6 test receipts into shift window (Oct 15, 2025 18:00 → Oct 16, 2025 03:00 Bangkok)
- Creates test data with 13 burgers total across different product types
- Cleans previous test data before seeding (idempotent)
- Inserts into both `receipts` and `receipt_items` tables with proper FK relationships

**Test Data**:
```
Receipt A (18:10): 3× Single Smash Burger + 1× Coke
Receipt B (19:25): 2× Super Double Bacon & Cheese  
Receipt C (20:05): 1× Triple Smash Set + 1× Sprite
Receipt D (21:40): 2× Crispy Chicken Fillet Burger
Receipt E (22:55): 4× Karaage Chicken + 2× Coke
Receipt F (01:15): 1× Kids Single Meal Set
```

### 3. Test Runner Script
**File**: `server/scripts/run_burger_metrics_test.ts`

**Validates**:
- ✅ Total Burgers: 13
- ✅ Beef Patties: 11
- ✅ Red Meat Grams: 1045g
- ✅ Chicken Grams: 600g
- ✅ Rolls: 13

**Output Format**:
```
→ GET http://localhost:5000/api/receipts/shift/burgers?date=2025-10-15

=== Non-zero products ===
- Single Smash Burger: 4
- Super Double Bacon & Cheese: 2
- Triple Smash Burger: 1
- Crispy Chicken Fillet Burger: 2
- Karaage Chicken Burger: 4

=== Totals ===
{ burgers: 13, patties: 11, redMeatGrams: 1045, chickenGrams: 600, rolls: 13 }

✅ Total Burgers: got=13 want=13
✅ Beef Patties: got=11 want=11
✅ Red Meat (g): got=1045 want=1045
✅ Chicken (g): got=600 want=600
✅ Rolls: got=13 want=13

🎉 TEST PASSED — burger metrics are correct.
```

### 4. NPM Scripts Added
**File**: `package.json`

```json
{
  "scripts": {
    "seed:burger-universal": "tsx server/scripts/seed_burger_metrics_universal.ts",
    "test:burger-metrics": "tsx server/scripts/run_burger_metrics_test.ts"
  }
}
```

## Usage Instructions

### Step 1: Seed Test Data
```bash
npm run seed:burger-universal
```

Expected output:
```
→ Using receipts & receipt_items tables
✅ Seeded 6 receipts into test shift window (2025-10-15 18:00 → 2025-10-16 03:00 Bangkok)
```

### Step 2: Run Tests
```bash
npm run test:burger-metrics
```

Expected result: **🎉 TEST PASSED — burger metrics are correct.**

### Step 3: Manual Verification (Optional)

**Via cURL**:
```bash
curl -s "http://localhost:5000/api/receipts/shift/burgers?date=2025-10-15" | jq
```

**Via UI**:
1. Navigate to `/operations/analysis/receipts/burgers`
2. Enter date: `2025-10-15`
3. Click "Load shift"
4. Verify totals match expected values

## API Endpoint

### GET `/api/receipts/shift/burgers`

**Query Parameters**:
- `date` (optional): YYYY-MM-DD format (e.g., "2025-10-15")
- `from` (optional): ISO timestamp
- `to` (optional): ISO timestamp

**Response**:
```json
{
  "ok": true,
  "data": {
    "shiftDate": "2025-10-15",
    "fromISO": "2025-10-15T18:00:00.000+07:00",
    "toISO": "2025-10-16T03:00:00.000+07:00",
    "products": [
      {
        "normalizedName": "Single Smash Burger",
        "qty": 4,
        "patties": 4,
        "redMeatGrams": 380,
        "chickenGrams": 0,
        "rolls": 4
      }
    ],
    "totals": {
      "burgers": 13,
      "patties": 11,
      "redMeatGrams": 1045,
      "chickenGrams": 600,
      "rolls": 13
    },
    "unmapped": {}
  }
}
```

## Cleanup

To remove test data:
```bash
psql "$DATABASE_URL" -c "DELETE FROM receipt_items WHERE \"receiptId\" LIKE 'test-burger-receipt-%'"
psql "$DATABASE_URL" -c "DELETE FROM receipts WHERE id LIKE 'test-burger-receipt-%'"
```

Or simply re-run the seeder (it auto-cleans before seeding).

## Technical Notes

### Database Schema
The system works with the following tables:

**receipts**:
- `id` (PK)
- `restaurantId` (FK to restaurants)
- `closedAtUTC` (used for shift filtering)
- `provider`, `externalId`, `receiptNumber`
- `subtotal`, `tax`, `discount`, `total`

**receipt_items**:
- `id` (PK)
- `receiptId` (FK to receipts)
- `name` (matched against burger catalog)
- `qty`, `unitPrice`, `total`

### Shift Window Logic
- Shift runs from **18:00 → 03:00 next day** (Asia/Bangkok timezone)
- Test date: Oct 15, 2025 covers receipts from 6PM Oct 15 to 3AM Oct 16
- Timezone-aware queries ensure accurate shift boundaries

### Burger Catalog Matching
The system matches receipt item names against patterns in `server/constants/burgerCatalog.ts`:
- Case-insensitive matching
- Supports Thai and English names
- Maps items to patty counts, meat weights, and roll counts

## Status: ✅ VERIFIED

All tests passing. System ready for production use.

**Last Verified**: October 17, 2025
**Test Result**: 🎉 PASSED (13/13 burgers, 11/11 patties, 1045g/1045g meat, 13/13 rolls)

# Burger Metrics Testing Infrastructure

## Overview
Created automated testing infrastructure for the burger metrics analysis system that processes receipt data and calculates burger sales statistics.

## Files Created

### 1. SQL Seed File: `server/scripts/seed_burger_metrics_test.sql`
- **Purpose**: Seeds test receipt data for burger metrics validation
- **Test Data**: 13 total burgers across 6 receipts with specific product combinations:
  - 3x Single Smash Burger (ซิงเกิ้ล) 
  - 2x Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)
  - 1x Triple Smash Set (Meal Deal)
  - 2x Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)
  - 4x Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ
  - 1x Kids Single Meal Set (Burger Fries Drink)

- **Test Shift**: October 15, 2025 (18:00 -> 03:00 next day, Asia/Bangkok timezone)
- **Data Cleanup**: Automatically removes previous TEST- receipts before seeding

### 2. TypeScript Test Runner: `server/scripts/run_burger_metrics_test.ts`
- **Purpose**: Validates burger metrics calculations
- **Test Endpoint**: GET `/api/receipts/shift/burgers?date=2025-10-15`
- **Validation Checks**:
  - Total burgers count = 13
  - Individual product quantities match expected values
  - Rolls, patties, and meat gram calculations

- **Output**: Pretty-printed results with ✅ pass or ❌ fail indicators

## Database Schema Requirements

The `receipts` table requires the following NOT NULL columns:
- `restaurantId` (FK to restaurants table)
- `provider` (e.g., 'LOYVERSE')
- `externalId` (external POS receipt ID)
- `receiptNumber` (display number)
- `createdAtUTC` (receipt creation timestamp)
- `closedAtUTC` (receipt closing timestamp)
- `subtotal` (pre-tax amount)
- `total` (final amount)

## How to Use

### Step 1: Fix Seed File Schema
The seed file needs to be updated with ALL required receipt fields. Current template:

```sql
INSERT INTO receipts (
  id, "restaurantId", provider, "externalId", "receiptNumber", 
  "createdAtUTC", "closedAtUTC", subtotal, total, "createdAt"
)
VALUES (
  'test-receipt-a', 
  'YOUR_RESTAURANT_ID', 
  'LOYVERSE', 
  'TEST-A-EXT', 
  'TEST-A', 
  '2025-10-15 11:10:00'::timestamp, 
  '2025-10-15 11:10:00'::timestamp,
  1000, 
  1000, 
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

### Step 2: Get Restaurant ID
```bash
psql "$DATABASE_URL" -c "SELECT id FROM restaurants LIMIT 1"
```

### Step 3: Update Seed File
Replace all instances of `YOUR_RESTAURANT_ID` with actual restaurant ID.

### Step 4: Run Seed
```bash
psql "$DATABASE_URL" -f server/scripts/seed_burger_metrics_test.sql
```

### Step 5: Run Test
```bash
tsx server/scripts/run_burger_metrics_test.ts
```

## Expected Test Output

```
→ GET http://localhost:5000/api/receipts/shift/burgers?date=2025-10-15

=== Products ===
Single Smash Burger (ซิงเกิ้ล): 3
Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน): 2
Triple Smash Set (Meal Deal): 1
Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น): 2
Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ: 4
Kids Single Meal Set (Burger Fries Drink): 1

=== Totals ===
{
  burgers: 13,
  patties: XX,
  redMeatGrams: XXXX,
  chickenGrams: XXXX,
  rolls: 13
}

✅ All validations passed!
```

## Integration with Burger Metrics Service

The test validates the `/api/receipts/shift/burgers` endpoint which:
1. Queries `receipt_items` joined with `receipts` table
2. Filters by shift date (Asia/Bangkok timezone: 5 PM -> 3 AM)
3. Matches item names against burger catalog patterns
4. Calculates patty counts and meat weights based on burger types
5. Returns aggregated burger sales data

## Troubleshooting

### Issue: Foreign key constraint errors
**Solution**: Ensure all receipt parent records insert successfully before receipt_items

### Issue: NULL value in column violations
**Solution**: Check all NOT NULL columns are populated in INSERT statements

### Issue: Test returns 0 burgers
**Solution**: Verify receipt `closedAtUTC` timestamps fall within the shift window (2025-10-15 18:00 -> 2025-10-16 03:00 Bangkok time)

### Issue: Burger catalog not matching
**Solution**: Ensure receipt_items `name` field exactly matches patterns in `server/constants/burgerCatalog.ts`

## Dependencies
- ✅ `tsx` - TypeScript execution runtime
- ✅ `node-fetch` - HTTP client for API calls
- ✅ PostgreSQL database connection

## Next Steps
1. Fix receipts table seed data with all required columns
2. Validate test passes with expected 13 burger count
3. Extend tests to validate patty counts and meat gram calculations
4. Add CSV export validation

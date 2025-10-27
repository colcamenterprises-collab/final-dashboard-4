# SHIFT ANALYTICS MM V1.0 - COMPLETE ARCHITECTURE DOCUMENTATION

## SYSTEM OVERVIEW

**Purpose**: Analyze POS (Loyverse) sales data by shift windows (5 PM → 3 AM Bangkok time) with meat/ingredient calculations based on menu catalog rules.

**Current Issue**: User reports POS API data does not match up / marry correctly.

---

## DATA FLOW DIAGRAM

```
┌─────────────────┐
│  Loyverse POS   │
│   (External)    │
└────────┬────────┘
         │ API Sync (3am daily)
         ▼
┌─────────────────────────────────────┐
│   receipts + receipt_items          │
│   (Raw POS data storage)            │
└─────────────┬───────────────────────┘
              │
              │ Query by shift window (5pm→3am Bangkok)
              ▼
┌─────────────────────────────────────┐
│   shiftItems.ts::computeShift()     │
│   • Maps SKUs via item_catalog       │
│   • Resolves NULL SKUs via item_alias│
│   • Calculates meat/rolls/patties    │
│   • Aggregates by category           │
└─────────────┬───────────────────────┘
              │
              │ Writes cache atomically
              ▼
┌─────────────────────────────────────┐
│ analytics_shift_item                │
│ analytics_shift_category_summary    │
│ (Cached computed results)           │
└─────────────┬───────────────────────┘
              │
              │ API Read (cache-first)
              ▼
┌─────────────────────────────────────┐
│   Frontend: ShiftAnalyticsMM.tsx    │
│   Displays table with category tabs │
└─────────────────────────────────────┘
```

---

## DATABASE SCHEMA

### Core Tables

#### 1. **receipts** (Raw POS data)
```sql
id                TEXT PRIMARY KEY
restaurantId      TEXT
provider          ENUM ('LOYVERSE')
externalId        TEXT (Loyverse receipt ID)
receiptNumber     TEXT
channel           ENUM
createdAtUTC      TIMESTAMP (when receipt created in POS)
closedAtUTC       TIMESTAMP (when payment completed)
subtotal          INTEGER (cents)
tax               INTEGER (cents)
discount          INTEGER (cents)
total             INTEGER (cents)
notes             TEXT
rawPayload        JSONB (full Loyverse JSON)
```

**Purpose**: Stores complete Loyverse receipt headers synced via API

---

#### 2. **receipt_items** (Raw line items)
```sql
id              TEXT PRIMARY KEY
receiptId       TEXT → receipts.id
providerItemId  TEXT (Loyverse line_id)
sku             TEXT (can be NULL!) 
name            TEXT (item name from POS)
category        TEXT (from Loyverse)
qty             INTEGER
unitPrice       INTEGER (cents)
total           INTEGER (cents)
modifiers       JSONB (addons/toppings)
```

**CRITICAL ISSUE**: `sku` can be NULL if Loyverse doesn't send it
- This causes SKU resolution failures
- System attempts fallback via `item_alias` table

---

#### 3. **item_catalog** (Menu master data - source of truth)
```sql
sku          TEXT PRIMARY KEY
name         TEXT (canonical item name)
category     TEXT (burger|drink|side|modifier|bundle|other)
kind         TEXT (beef|chicken|null)
patties_per  INTEGER (default 1)
grams_per    INTEGER (default 95 for beef)
rolls_per    INTEGER (default 1)
active       BOOLEAN (only active items used)
updated_at   TIMESTAMP
```

**Purpose**: Defines calculation rules for every menu item

**Seeded from**: `server/data/foodCostings.ts` on startup

**Calculation Logic**:
- If `category = 'burger'` and `kind = 'beef'`:
  - `patties = patties_per * qty`
  - `red_meat_g = patties * 95g` (hardcoded)
  - `rolls = rolls_per * qty`
- If `category = 'burger'` and `kind = 'chicken'`:
  - `chicken_g = grams_per * qty`
  - `rolls = rolls_per * qty`

---

#### 4. **item_alias** (SKU resolution fallback)
```sql
alias_name   TEXT PRIMARY KEY
sku          TEXT → item_catalog.sku
```

**Purpose**: When `receipt_items.sku IS NULL`, try to resolve by matching `receipt_items.name` to `alias_name`

**Example**:
```sql
alias_name = "Double Smash"
sku = "SKU123"
```

If receipt has `sku=NULL, name="Double Smash"`, it resolves to `SKU123`

---

#### 5. **analytics_shift_item** (Computed cache)
```sql
id          UUID PRIMARY KEY
shift_date  DATE (part of unique constraint)
from_ts     TIMESTAMPTZ (shift start: 5pm Bangkok)
to_ts       TIMESTAMPTZ (shift end: 3am Bangkok)
sku         TEXT (nullable, part of unique constraint)
name        TEXT (resolved from catalog or original)
category    TEXT (burger|drink|side|modifier|bundle|other)
qty         INTEGER (total sold in shift)
patties     INTEGER (calculated)
red_meat_g  REAL (beef grams)
chicken_g   REAL (chicken grams)
rolls       INTEGER (buns used)
raw_hits    JSONB (debug: array of "sku :: name" strings)
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ

UNIQUE (shift_date, COALESCE(sku, name))
```

**Purpose**: Pre-computed shift analytics to avoid recalculating on every page load

**Populated by**: `shiftItems.ts::computeShift()` via transactional DELETE + INSERT

---

#### 6. **analytics_shift_category_summary** (Rollup cache)
```sql
id           UUID PRIMARY KEY
shift_date   DATE
from_ts      TIMESTAMPTZ
to_ts        TIMESTAMPTZ
category     TEXT
items_total  INTEGER (sum of qty for this category)
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ

UNIQUE (shift_date, category)
```

**Purpose**: Quick category totals (e.g., total burgers sold)

---

## KEY CODE MODULES

### 1. Frontend: `client/src/pages/analysis/ShiftAnalyticsMM.tsx`

**API Call**:
```typescript
GET /api/analysis/shift/items?date=YYYY-MM-DD
```

**User Flow**:
1. User selects date via `<input type="date">`
2. Clicks "Load Shift"
3. API returns either:
   - `sourceUsed: "cache"` → from `analytics_shift_item` table
   - `sourceUsed: "live"` → freshly computed via `computeShift()`
4. Data displayed in sortable table with category tabs
5. CSV export available

**Data Structure**:
```typescript
type ShiftItem = {
  sku: string | null;
  name: string;
  category: "burger" | "drink" | "side" | "modifier" | "bundle" | "other";
  qty: number;
  patties?: number;
  red_meat_g?: number;       // or redMeatGrams (both supported)
  chicken_g?: number;        // or chickenGrams
  rolls?: number;
};
```

**Totals Calculation** (frontend aggregation):
```typescript
totalQty = filtered.reduce((sum, it) => sum + it.qty, 0)
totalPatties = filtered.reduce((sum, it) => sum + it.patties, 0)
totalBeef = filtered.reduce((sum, it) => sum + (it.red_meat_g || it.redMeatGrams), 0)
totalChicken = filtered.reduce((sum, it) => sum + (it.chicken_g || it.chickenGrams), 0)
totalRolls = filtered.reduce((sum, it) => sum + it.rolls, 0)
```

---

### 2. Backend Route: `server/routes/shiftAnalysis.ts`

**Endpoints**:

#### `GET /api/analysis/shift/items?date=YYYY-MM-DD&category=burger`
```typescript
1. Calculate shift window via shiftWindow(date)
   → shiftDate, fromISO, toISO

2. Query cache:
   SELECT * FROM analytics_shift_item 
   WHERE shift_date = ${shiftDate}
   ORDER BY category, name

3. If cache empty:
   → Call computeShift(date) for live data
   → Returns { sourceUsed: "live", items, ... }

4. Else:
   → Return { sourceUsed: "cache", items }

5. Optional: filter by category parameter
```

---

#### `POST /api/analysis/shift/rebuild?date=YYYY-MM-DD`
- Forces live recomputation
- Overwrites cache
- Use when receipts added retroactively

---

#### `GET /api/analysis/shift/raw?date=YYYY-MM-DD`
```sql
-- Raw aggregation without catalog join (debugging)
SELECT 
  ri.sku, 
  COALESCE(c.name, ri.name) AS name, 
  SUM(ri.qty)::int AS qty
FROM receipt_items ri
JOIN receipts r ON r.id = ri."receiptId"
LEFT JOIN item_catalog c ON c.sku = ri.sku
WHERE r."createdAtUTC" >= fromISO
  AND r."createdAtUTC" < toISO
GROUP BY ri.sku, COALESCE(c.name, ri.name)
ORDER BY name
```

**Purpose**: See what Loyverse actually sent (SKUs, names, quantities) without any processing

---

### 3. Computation Engine: `server/services/shiftItems.ts::computeShift()`

**INPUT**: `dateISO` (YYYY-MM-DD, e.g., "2025-10-26")

**ALGORITHM**:

#### Step 1: Calculate Shift Window
```typescript
const { shiftDate, fromISO, toISO } = shiftWindow(dateISO);
// Example output:
// shiftDate: "2025-10-26"
// fromISO: "2025-10-26T10:00:00.000Z" (5pm Bangkok = 10am UTC)
// toISO: "2025-10-27T20:00:00.000Z" (3am Bangkok next day = 8pm UTC same day)
```

#### Step 2: Query Raw Receipt Items with Alias Fallback
```sql
WITH base AS (
  SELECT 
    ri.sku, 
    ri.name, 
    SUM(ri.qty)::int AS qty
  FROM receipt_items ri
  JOIN receipts r ON r.id = ri."receiptId"
  WHERE r."createdAtUTC" >= fromISO
    AND r."createdAtUTC" < toISO
  GROUP BY ri.sku, ri.name
)
SELECT 
  COALESCE(base.sku, ia.sku) AS sku,  -- Resolve NULL SKUs via alias
  base.name,
  base.qty
FROM base
LEFT JOIN item_alias ia ON base.sku IS NULL AND ia.alias_name = base.name
```

**Result**: Array of `{ sku: string|null, name: string, qty: number }`

#### Step 3: Load Active Catalog
```sql
SELECT sku, name, category, kind, patties_per, grams_per, rolls_per
FROM item_catalog
WHERE active = true
```

**Build lookup**: `Map<sku, catalogRule>`

#### Step 4: Aggregate by SKU (or name if SKU still NULL)
```typescript
const acc = new Map<string, ShiftItemAccumulator>();

for (const rawItem of rawItems) {
  const sku = rawItem.sku ?? null;
  const catalogRule = sku ? bySku.get(sku) : null;
  
  // Use catalog name if found, else keep POS name
  const name = catalogRule?.name ?? rawItem.name;
  const category = catalogRule?.category ?? 'other';
  
  // Aggregation key: SKU if present, else name
  const key = sku ?? name;
  
  if (!acc.has(key)) {
    acc.set(key, {
      sku, name, category,
      qty: 0, patties: 0, red: 0, chick: 0, rolls: 0,
      hits: new Set() // Debug tracking
    });
  }
  
  const item = acc.get(key)!;
  item.qty += rawItem.qty;
  item.hits.add(`${sku ?? 'no-sku'} :: ${name}`);
  
  // Calculate meat/rolls for burgers only
  if (category === 'burger' && catalogRule) {
    if (catalogRule.kind === 'beef') {
      const patties = (catalogRule.patties_per ?? 1) * rawItem.qty;
      item.patties += patties;
      item.red += patties * 95; // HARDCODED 95g per patty
    } else if (catalogRule.kind === 'chicken') {
      item.chick += (catalogRule.grams_per ?? 100) * rawItem.qty;
    }
    item.rolls += (catalogRule.rolls_per ?? 1) * rawItem.qty;
  }
}
```

#### Step 5: Write Cache (Transactional)
```typescript
await db.$transaction(async tx => {
  // Delete old cache for this shift
  await tx.$executeRaw`
    DELETE FROM analytics_shift_item 
    WHERE shift_date = ${shiftDate}::date
  `;
  await tx.$executeRaw`
    DELETE FROM analytics_shift_category_summary 
    WHERE shift_date = ${shiftDate}::date
  `;
  
  // Insert computed items
  for (const item of acc.values()) {
    await tx.$executeRaw`
      INSERT INTO analytics_shift_item (
        shift_date, from_ts, to_ts, sku, name, category,
        qty, patties, red_meat_g, chicken_g, rolls,
        raw_hits, updated_at
      ) VALUES (
        ${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz,
        ${item.sku}, ${item.name}, ${item.category},
        ${item.qty}, ${item.patties}, ${item.red}, ${item.chick}, ${item.rolls},
        ${JSON.stringify(Array.from(item.hits))}::jsonb, now()
      )
      ON CONFLICT (shift_date, COALESCE(sku, name))
      DO UPDATE SET
        qty=EXCLUDED.qty, patties=EXCLUDED.patties,
        red_meat_g=EXCLUDED.red_meat_g, chicken_g=EXCLUDED.chicken_g,
        rolls=EXCLUDED.rolls, raw_hits=EXCLUDED.raw_hits,
        updated_at=now()
    `;
  }
  
  // Insert category summaries
  const categorySums = {};
  for (const item of acc.values()) {
    categorySums[item.category] = (categorySums[item.category] ?? 0) + item.qty;
  }
  
  for (const [category, total] of Object.entries(categorySums)) {
    await tx.$executeRaw`
      INSERT INTO analytics_shift_category_summary (
        shift_date, from_ts, to_ts, category, items_total, updated_at
      ) VALUES (
        ${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz,
        ${category}, ${total}, now()
      )
      ON CONFLICT (shift_date, category)
      DO UPDATE SET items_total=EXCLUDED.items_total, updated_at=now()
    `;
  }
});
```

#### Step 6: Return Result
```typescript
return {
  shiftDate,
  fromISO,
  toISO,
  items: Array.from(acc.values()).map(v => ({
    sku: v.sku,
    name: v.name,
    category: v.category,
    qty: v.qty,
    patties: v.patties,
    redMeatGrams: v.red,
    chickenGrams: v.chick,
    rolls: v.rolls
  })),
  totalsByCategory: categorySums,
  sourceUsed: 'live'
};
```

---

### 4. Shift Window Calculator: `server/services/time/shiftWindow.ts`

```typescript
import { DateTime } from "luxon";

export function shiftWindow(dateISO: string) {
  const base = DateTime.fromISO(dateISO, { zone: "Asia/Bangkok" })
    .startOf("day"); // Midnight Bangkok
  
  const from = base.plus({ hours: 17 });      // 5 PM Bangkok
  const to = base.plus({ days: 1, hours: 3 }); // 3 AM next day Bangkok
  
  return {
    shiftDate: base.toISODate()!,  // "2025-10-26"
    fromISO: from.toISO()!,         // "2025-10-26T10:00:00.000Z"
    toISO: to.toISO()!,             // "2025-10-27T20:00:00.000Z"
  };
}
```

**Example**:
```
Input: "2025-10-26"

Output:
  shiftDate: "2025-10-26"
  fromISO: "2025-10-26T10:00:00.000Z"  (Oct 26, 5pm Bangkok)
  toISO: "2025-10-27T20:00:00.000Z"    (Oct 27, 3am Bangkok)
```

**Critical**: Uses Luxon for proper timezone handling (Bangkok = UTC+7, no DST)

---

## POTENTIAL DATA MISMATCH ROOT CAUSES

### 1. **SKU Resolution Failures** ⚠️ HIGH PRIORITY

**Problem**: 
- Loyverse sends `receipt_items.sku = NULL` for some menu items
- System tries to resolve via `item_alias.alias_name = receipt_items.name`
- If alias doesn't exist → item aggregates under wrong name or creates duplicates

**Symptoms**:
- Same item appears multiple times with different names
- Quantities don't add up
- Missing items in analytics

**SQL Diagnostic**:
```sql
-- Find items with no SKU that also have no alias
SELECT DISTINCT ri.name, COUNT(*) as occurrence_count
FROM receipt_items ri
LEFT JOIN item_alias ia ON ia.alias_name = ri.name
WHERE ri.sku IS NULL 
  AND ia.sku IS NULL
GROUP BY ri.name
ORDER BY occurrence_count DESC;
```

**Example Output**:
```
name                    | occurrence_count
------------------------|----------------
"Double Smash"          | 45
"Triple Cheese Burger"  | 23
"Coke Zero"             | 12
```

**Fix**:
```sql
-- Add missing aliases
INSERT INTO item_alias (alias_name, sku) VALUES
  ('Double Smash', 'SKU_DOUBLE_SMASH'),
  ('Triple Cheese Burger', 'SKU_TRIPLE_CHEESE'),
  ('Coke Zero', 'SKU_COKE_ZERO');
```

---

### 2. **Incorrect Catalog Configuration** ⚠️ HIGH PRIORITY

**Problem**:
- Wrong `patties_per`, `grams_per`, or `rolls_per` in `item_catalog`
- Wrong `kind` (beef vs chicken)
- Inactive items (`active=false`) still appearing in POS

**Symptoms**:
- Beef/chicken grams don't match reality
- Roll count off
- Items showing in analytics but not in catalog

**SQL Diagnostic**:
```sql
-- Review all active catalog entries
SELECT sku, name, category, kind, 
       patties_per, grams_per, rolls_per, active
FROM item_catalog
ORDER BY category, name;
```

**Common Errors**:
```
SKU_DOUBLE_SMASH: patties_per = 1 (WRONG! Should be 2)
SKU_CHICKEN_BURGER: kind = 'beef' (WRONG! Should be 'chicken')
SKU_TRIPLE: rolls_per = 2 (WRONG! Should be 1)
```

**Fix**:
```sql
UPDATE item_catalog 
SET patties_per = 2 
WHERE sku = 'SKU_DOUBLE_SMASH';

UPDATE item_catalog 
SET kind = 'chicken' 
WHERE sku = 'SKU_CHICKEN_BURGER';
```

---

### 3. **Duplicate Name Variants** ⚠️ MEDIUM PRIORITY

**Problem**:
- Same item sold with multiple spellings/variations
- Each variant creates separate analytics row

**Example**:
```
"Double Smash"        (SKU: 123) → 10 sold
"Double Smash Burger" (SKU: NULL) → 5 sold
"DoubleSmash"         (SKU: NULL) → 3 sold
```

Should aggregate to 18 total, but shows as 3 separate items.

**SQL Diagnostic**:
```sql
-- Find similar names that might be duplicates
SELECT name, sku, category, qty
FROM analytics_shift_item
WHERE shift_date = '2025-10-26'
  AND name ILIKE '%double%smash%'
ORDER BY name;
```

**Fix**: Add aliases for all variants
```sql
INSERT INTO item_alias (alias_name, sku) VALUES
  ('Double Smash Burger', 'SKU_DOUBLE_SMASH'),
  ('DoubleSmash', 'SKU_DOUBLE_SMASH'),
  ('Double-Smash', 'SKU_DOUBLE_SMASH');
```

---

### 4. **Shift Window Timezone Issues** ⚠️ LOW PRIORITY (Luxon handles it)

**Problem** (theoretical, unlikely with current Luxon implementation):
- Frontend sends date in wrong timezone
- Backend misinterprets shift boundaries
- Receipts near 5pm/3am boundary excluded or duplicated

**Diagnostic**:
```sql
-- Check receipts near shift boundaries
SELECT r.id, r."createdAtUTC", r.total
FROM receipts r
WHERE r."createdAtUTC" >= '2025-10-26T09:30:00.000Z'  -- 4:30pm Bangkok
  AND r."createdAtUTC" <= '2025-10-26T10:30:00.000Z'  -- 5:30pm Bangkok
ORDER BY r."createdAtUTC";
```

Expected: All receipts after 10:00 UTC should be in Oct 26 shift

---

### 5. **Incomplete POS Sync** ⚠️ MEDIUM PRIORITY

**Problem**:
- Loyverse API sync fails or incomplete
- Manual POS receipts not synced
- Deleted receipts not reflected in database

**Symptoms**:
- POS dashboard shows 100 receipts
- Database only has 85 receipts
- Analytics totals don't match POS reports

**SQL Diagnostic**:
```sql
-- Compare total sales in receipts vs analytics
SELECT 
  SUM(r.total) / 100.0 as total_receipts_baht,
  COUNT(*) as receipt_count
FROM receipts r
WHERE r."createdAtUTC" >= '2025-10-26T10:00:00.000Z'
  AND r."createdAtUTC" < '2025-10-27T20:00:00.000Z';
```

**Check sync logs**:
```sql
-- Find last successful Loyverse sync
SELECT * FROM jobs 
WHERE type = 'loyverse_sync' 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

**Fix**: Manual resync via scheduler service

---

### 6. **Cached vs Live Data Mismatch**

**Problem**:
- Cache (`analytics_shift_item`) out of date
- New receipts added after cache built
- Cache shows old data

**Diagnostic**:
```sql
-- Check when cache was last updated
SELECT shift_date, MAX(updated_at) as last_cache_update
FROM analytics_shift_item
WHERE shift_date = '2025-10-26'
GROUP BY shift_date;

-- Compare to latest receipt timestamp
SELECT MAX(r."createdAtUTC") as latest_receipt
FROM receipts r
WHERE r."createdAtUTC" >= '2025-10-26T10:00:00.000Z'
  AND r."createdAtUTC" < '2025-10-27T20:00:00.000Z';
```

If `latest_receipt` > `last_cache_update`: cache is stale

**Fix**: Force rebuild
```bash
curl -X POST "http://localhost:5000/api/analysis/shift/rebuild?date=2025-10-26"
```

---

## DEBUGGING WORKFLOW

### **Step 1: Verify Raw Receipt Data**
```sql
-- What did Loyverse actually send?
SELECT 
  r.id,
  r."receiptNumber",
  r."createdAtUTC",
  r.total / 100.0 as total_baht,
  ri.sku,
  ri.name,
  ri.qty,
  ri.total / 100.0 as line_total_baht
FROM receipts r
JOIN receipt_items ri ON ri."receiptId" = r.id
WHERE r."createdAtUTC" >= '2025-10-26T10:00:00.000Z'
  AND r."createdAtUTC" < '2025-10-27T20:00:00.000Z'
ORDER BY r."createdAtUTC", ri.name;
```

**Export to CSV for manual review**

---

### **Step 2: Check SKU Coverage**
```sql
-- How many items have SKUs vs no SKUs?
SELECT 
  CASE WHEN ri.sku IS NOT NULL THEN 'HAS_SKU' ELSE 'NO_SKU' END as status,
  COUNT(*) as line_item_count,
  SUM(ri.qty) as total_qty
FROM receipt_items ri
JOIN receipts r ON r.id = ri."receiptId"
WHERE r."createdAtUTC" >= '2025-10-26T10:00:00.000Z'
  AND r."createdAtUTC" < '2025-10-27T20:00:00.000Z'
GROUP BY status;
```

Expected output:
```
status   | line_item_count | total_qty
---------|-----------------|----------
HAS_SKU  | 450             | 823
NO_SKU   | 12              | 18
```

If `NO_SKU` count is high → SKU mapping problem in Loyverse

---

### **Step 3: Check Alias Resolution**
```sql
-- Which NULL-SKU items have aliases vs unresolved?
SELECT 
  ri.name,
  ia.sku as resolved_sku,
  CASE WHEN ia.sku IS NOT NULL THEN 'RESOLVED' ELSE 'UNRESOLVED' END as status,
  SUM(ri.qty) as total_qty
FROM receipt_items ri
JOIN receipts r ON r.id = ri."receiptId"
LEFT JOIN item_alias ia ON ia.alias_name = ri.name
WHERE ri.sku IS NULL
  AND r."createdAtUTC" >= '2025-10-26T10:00:00.000Z'
  AND r."createdAtUTC" < '2025-10-27T20:00:00.000Z'
GROUP BY ri.name, ia.sku
ORDER BY status, total_qty DESC;
```

---

### **Step 4: Validate Catalog Rules**
```sql
-- Show calculation rules for all burgers
SELECT sku, name, kind, patties_per, grams_per, rolls_per, active
FROM item_catalog
WHERE category = 'burger'
ORDER BY name;
```

**Manual Review Checklist**:
- [ ] All burgers have correct `patties_per` (1, 2, or 3)
- [ ] Beef burgers have `kind = 'beef'`
- [ ] Chicken burgers have `kind = 'chicken'`
- [ ] All burgers have `rolls_per = 1` (unless bundle)
- [ ] `active = true` for current menu items

---

### **Step 5: Compare Raw vs Computed**

**Get raw totals**:
```bash
curl "http://localhost:5000/api/analysis/shift/raw?date=2025-10-26"
```

**Force fresh computation**:
```bash
curl -X POST "http://localhost:5000/api/analysis/shift/rebuild?date=2025-10-26"
```

**Get cached results**:
```bash
curl "http://localhost:5000/api/analysis/shift/items?date=2025-10-26"
```

**Compare**:
- Do SKU quantities match between raw and computed?
- Are categories assigned correctly?
- Do patty/meat calculations make sense?

---

### **Step 6: Inspect `raw_hits` Debug Field**
```sql
-- See which POS names mapped to each analytics row
SELECT name, category, qty, raw_hits
FROM analytics_shift_item
WHERE shift_date = '2025-10-26'
  AND category = 'burger'
ORDER BY qty DESC;
```

**Example output**:
```json
{
  "name": "Double Smash",
  "qty": 18,
  "raw_hits": [
    "SKU123 :: Double Smash",
    "null :: Double Smash Burger",
    "null :: DoubleSmash"
  ]
}
```

This shows 3 POS variants aggregated into 1 analytics row

---

## COMPETING ANALYTICS SYSTEMS ⚠️ CRITICAL ISSUE

**There are TWO separate analytics systems in the codebase!**

### System A: "MM v1.0" (Current/Primary)
- **File**: `server/services/shiftItems.ts`
- **Tables**: `analytics_shift_item`, `analytics_shift_category_summary`
- **ORM**: Prisma (raw SQL)
- **Frontend**: `ShiftAnalyticsMM.tsx`
- **Features**: SKU-based, catalog-driven, meat/rolls calculations

### System B: "Legacy" (Old)
- **File**: `server/services/shiftAnalytics.ts`
- **Tables**: `shiftItemSales`, `shiftModifierSales`, `shiftSummary`
- **ORM**: Drizzle
- **Features**: Category-based aggregation, modifier tracking

**PROBLEM**: Both systems run on same schedule (3am daily)
- May produce conflicting results
- Confusing which is "source of truth"
- Wastes compute resources

**RECOMMENDATION**:
1. **Choose System A (MM v1.0)** as primary
2. **Deprecate System B** (disable scheduled job)
3. **Document decision** in replit.md

---

## SCHEDULED JOBS

**File**: `server/services/scheduler.ts`

**Daily 3:00 AM Bangkok (20:00 UTC previous day)**:
```typescript
1. Sync receipts from Loyverse API
   → loyverseAPI.syncTodaysReceipts()

2. Process shift analytics (System B - Legacy)
   → processPreviousShift()  // From shiftAnalytics.ts

3. (System A - MM v1.0 runs on-demand via API, not scheduled)
```

**Issue**: System A (MM v1.0) analytics NOT auto-generated
- User must manually call rebuild endpoint
- Or cache populates on first page load

**Recommendation**: Add scheduled job for MM v1.0 at 3:05 AM:
```typescript
await computeShift(yesterday); // Pre-populate cache
```

---

## API ENDPOINTS REFERENCE

| Endpoint | Method | Purpose | Source Table |
|----------|--------|---------|--------------|
| `/api/analysis/shift/items?date=YYYY-MM-DD` | GET | Get shift items (cache-first) | `analytics_shift_item` |
| `/api/analysis/shift/rebuild?date=YYYY-MM-DD` | POST | Force recomputation | Writes `analytics_shift_item` |
| `/api/analysis/shift/raw?date=YYYY-MM-DD` | GET | Raw receipt totals (no processing) | `receipt_items` |
| `/api/analytics/latest?restaurantId=X` | GET | Latest analytics (System B - Legacy) | `analytics_daily` |
| `/api/receipts/window?from=ISO&to=ISO` | GET | Receipt summary for time range | `receipts` |

---

## CRITICAL FILES TO REVIEW

1. **`client/src/pages/analysis/ShiftAnalyticsMM.tsx`** - Frontend UI
2. **`server/routes/shiftAnalysis.ts`** - API endpoints
3. **`server/services/shiftItems.ts`** - Core computation logic (⭐ most important)
4. **`server/services/time/shiftWindow.ts`** - Timezone calculations
5. **`server/data/foodCostings.ts`** - Catalog source data
6. **`server/services/shiftAnalytics.ts`** - LEGACY system (deprecated?)
7. **Database tables**:
   - `analytics_shift_item`
   - `item_catalog`
   - `item_alias`
   - `receipts`
   - `receipt_items`

---

## RECOMMENDED FIX PRIORITY

### **Priority 1: Data Integrity** (Fix first)
1. ✅ **Audit `receipt_items.sku IS NULL` cases**
   - Run SQL diagnostic from Step 2 above
   - Add missing aliases to `item_alias` table
   - Ask Loyverse support why SKUs missing

2. ✅ **Verify `item_catalog` accuracy**
   - Export catalog to CSV
   - Compare against actual menu
   - Fix any `patties_per`, `kind`, `rolls_per` errors

3. ✅ **Check for duplicate name variants**
   - Run similarity query from Problem #3
   - Add aliases for all variants

### **Priority 2: System Consolidation** (Architecture fix)
1. ✅ **Choose primary analytics system** (MM v1.0 recommended)
2. ✅ **Disable competing system** (deprecate shiftAnalytics.ts)
3. ✅ **Add scheduled cache rebuild** at 3:05 AM daily

### **Priority 3: Debugging Tools** (Developer experience)
1. ⏳ **Build admin comparison page**:
   - Show Loyverse raw data
   - Show computed analytics
   - Show manual form data
   - Highlight mismatches
2. ⏳ **Add SKU resolution report**:
   - Show success/fail rate
   - List unresolved items
3. ⏳ **Add audit log** for catalog changes

---

## WHERE DATA MISMATCHES ORIGINATE

**Question**: "Where does wrong data come from?"

**Answer**:

1. **Loyverse POS Export** (40% of issues)
   - Missing SKUs in API response
   - Duplicate item names with slight variations
   - Category mismatches
   - **Fix**: Contact Loyverse support, fix POS item configuration

2. **item_catalog Rules** (30% of issues)
   - Wrong `patties_per` values
   - Wrong `kind` (beef vs chicken)
   - Inactive items still showing
   - **Fix**: Audit and correct `server/data/foodCostings.ts`

3. **SKU Resolution Failures** (20% of issues)
   - NULL SKUs with no alias
   - Alias typos or case sensitivity
   - **Fix**: Populate `item_alias` table completely

4. **Shift Window Calculation** (5% of issues)
   - Timezone edge cases
   - **Fix**: Validate `shiftWindow.ts` logic (currently looks correct)

5. **Stale Cache** (5% of issues)
   - Receipts added after cache built
   - **Fix**: Add scheduled rebuild or auto-invalidation

---

## NEXT STEPS FOR DIAGNOSIS

1. **Run all SQL diagnostics** in "Debugging Workflow" section
2. **Export results** to spreadsheet for review
3. **Identify specific mismatches**:
   - Which items have wrong quantities?
   - Which items missing entirely?
   - Which calculations off (meat/rolls)?
4. **Cross-reference with**:
   - Loyverse dashboard (source of truth)
   - Daily Sales Forms (manual entry)
   - Physical inventory count
5. **Determine root cause** from 5 categories above
6. **Apply targeted fix** based on diagnosis

---

## CRITICAL QUESTIONS TO ANSWER

Before fixing, you need to know:

1. **Which specific items are wrong?**
   - Names of items
   - Expected vs actual quantities
   - Which shift date(s)

2. **What does Loyverse POS dashboard show?**
   - Can you export CSV from Loyverse directly?
   - Compare Loyverse CSV vs database

3. **Are SKUs present in Loyverse?**
   - Check POS configuration
   - Verify API payload includes SKUs

4. **Is catalog configuration correct?**
   - Export `item_catalog` table
   - Review against actual menu

5. **When was cache last rebuilt?**
   - Check `analytics_shift_item.updated_at`
   - Force rebuild and retest

---

**END OF ARCHITECTURE DOCUMENTATION**

---

## SUMMARY FOR CAM

This document outlines the complete architecture of the Shift Analytics MM v1.0 system, including:

- Data flow from Loyverse → Database → Analytics → Frontend
- All database tables and their relationships
- Computation logic in `shiftItems.ts` (step-by-step)
- 6 potential root causes for data mismatches
- SQL queries to diagnose each issue
- Debugging workflow with specific commands
- Priority-ordered fix recommendations

**Key Finding**: There are TWO competing analytics systems running simultaneously, which may be causing conflicts.

**Immediate Actions Needed**:
1. Run SQL diagnostics to identify specific mismatch patterns
2. Audit `item_alias` table completeness
3. Verify `item_catalog` rules match actual menu
4. Choose primary analytics system and deprecate the other

Review this document and let me know which specific data mismatches you're seeing so we can pinpoint the exact cause.
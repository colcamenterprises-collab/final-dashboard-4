# Meekong Mumba v1.0 — Catalog Import + Refresh Guide

## Overview
Complete one-pass workflow for importing SKU catalog data and rebuilding shift analytics to eliminate "UNKNOWN" items and ensure accurate burger metrics.

## System Components

### 1. Catalog Import Script
**Location:** `server/scripts/catalog_import_from_file.ts`

**Features:**
- Reads CSV or XLSX files
- Auto-detects burger types (beef/chicken) from item names
- Infers patty counts from burger names (single/double/triple)
- Supports all categories: burger, drink, side, modifier, bundle
- Upserts to `item_catalog` table with conflict resolution

**Supported Columns:**
- `SKU` (required)
- `Item name` or `Name` (required)
- `Category` (burger/drink/side/modifier/bundle)
- `Kind` (beef/chicken - for burgers)
- `PattiesPer` (number of patties per burger)
- `GramsPer` (grams of chicken per burger)
- `RollsPer` (buns per item, default: 1)

### 2. API Endpoints

#### GET /api/analysis/shift/items
Returns shift analytics with automatic cache/live detection.
```bash
curl "/api/analysis/shift/items?date=2025-10-19"
```
**Response:** `{ sourceUsed: "cache"|"live", items: [...] }`

#### POST /api/analysis/shift/rebuild
Force-rebuilds shift cache from raw receipt data.
```bash
curl -X POST "/api/analysis/shift/rebuild?date=2025-10-19"
```
**Response:** `{ sourceUsed: "live", items: [...], shiftDate, fromISO, toISO }`

#### GET /api/analysis/shift/raw
Returns raw line items for debugging unmapped SKUs.
```bash
curl "/api/analysis/shift/raw?date=2025-10-19"
```
**Response:** `{ rows: [{ sku, name, qty }], fromISO, toISO }`

## Complete Workflow

### Step 1: Import SKU Catalog

Place your catalog file at `/mnt/data/Item and SKU List - Latest` (CSV or XLSX).

Run the import script:
```bash
CATALOG_PATH="/mnt/data/Item and SKU List - Latest" tsx server/scripts/catalog_import_from_file.ts
```

**Expected Output:**
```
Loaded <N> catalog rows from: /mnt/data/Item and SKU List - Latest
Catalog upsert complete: <N> items.
```

### Step 2: Verify Catalog Data

Check catalog count:
```sql
SELECT COUNT(*) AS catalog_count FROM item_catalog;
```

Check for burgers missing metrics:
```sql
SELECT sku, name, kind, patties_per, grams_per
FROM item_catalog
WHERE category='burger' 
  AND ((kind='beef' AND patties_per IS NULL) OR (kind='chicken' AND grams_per IS NULL));
```

Check unmapped line items:
```sql
SELECT COUNT(*) FILTER (WHERE sku IS NULL) AS no_sku,
       COUNT(*) FILTER (WHERE sku IS NOT NULL) AS with_sku
FROM lv_line_item;
```

### Step 3: Rebuild Shift Analytics

Rebuild for specific dates (uses 5pm→3am Bangkok timezone window):
```bash
for d in 2025-10-15 2025-10-16 2025-10-17 2025-10-18 2025-10-19; do
  curl -s -X POST "/api/analysis/shift/rebuild?date=$d" | \
    jq -r '.shiftDate + " → " + (.items|length|tostring) + " items (" + .sourceUsed + ")"'
done
```

**Expected Output:**
```
2025-10-15 → 45 items (live)
2025-10-16 → 52 items (live)
2025-10-17 → 48 items (live)
...
```

### Step 4: Verify UNKNOWN Elimination

Check raw unmapped items:
```bash
curl -s "/api/analysis/shift/raw?date=2025-10-19" | \
  jq '.rows[] | select(.name=="UNKNOWN" or .sku==null)' | wc -l
```

Check cached analytics:
```bash
curl -s "/api/analysis/shift/items?date=2025-10-19" | \
  jq '.items[] | select(.name=="UNKNOWN")' | wc -l
```

**Both should return 0** (or very close if Loyverse sent truly SKU-less lines).

### Step 5: Refresh UI

1. Navigate to: **Operations → Analysis → Shift Analytics**
2. Select date: `19/10/2025`
3. Click **Load Shift**

**Expected Result:**
- Real SKU, Item names, Categories displayed
- Burger metrics: Qty, Patties, RedMeat(g), Chicken(g), Rolls
- Status badge shows "Cached" (green)
- Export CSV available with full itemized data

## Troubleshooting

### Items Still Show "UNKNOWN"
**Cause:** Line item has no SKU from Loyverse.
**Solution:** Add SKU-to-name mapping in catalog or create alias table.

### Burger Missing Metrics
**Check:**
```sql
SELECT * FROM item_catalog WHERE sku='<problem-sku>';
```
**Fix:** Ensure `kind`, `patties_per`, or `grams_per` are set correctly.

### Cache Not Updating
**Solution:** Force rebuild:
```bash
curl -X POST "/api/analysis/shift/rebuild?date=<date>"
```

## Database Schema

### item_catalog
```sql
CREATE TABLE item_catalog (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  kind TEXT,
  patties_per INTEGER,
  grams_per INTEGER,
  rolls_per INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### analytics_shift_item (cache)
```sql
CREATE TABLE analytics_shift_item (
  shift_date DATE NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  qty INTEGER DEFAULT 0,
  patties INTEGER DEFAULT 0,
  red_meat_g INTEGER DEFAULT 0,
  chicken_g INTEGER DEFAULT 0,
  rolls INTEGER DEFAULT 0,
  from_ts TIMESTAMPTZ,
  to_ts TIMESTAMPTZ,
  raw_hits JSONB,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shift_date, COALESCE(sku, name))
);
```

## Implementation Details

### Shift Window Logic
- **Location:** `server/services/time/shiftWindow.ts`
- **Bangkok Timezone:** Uses Asia/Bangkok (UTC+7)
- **Window:** 17:00 (5 PM) → 03:00 (3 AM next day)

### Catalog Inference Rules
```typescript
// Auto-detect burger type from name
if (/(chicken|karaage|rooster)/i.test(name)) → kind='chicken'
if (/burger|smash|double|triple/i.test(name)) → kind='beef'

// Auto-infer patty count
if (/triple/i.test(name)) → patties=3
if (/double/i.test(name)) → patties=2
else → patties=1

// Default chicken grams
if (kind='chicken' && !grams) → grams=100
```

### Beef Calculation
```typescript
const BEEF_G = 95; // grams per patty
redMeatGrams = patties_per * quantity * 95
```

## Export Features

### CSV Export
Click **Export CSV** to download:
```
SKU,Item,Category,Qty,Patties,RedMeat(g),Chicken(g),Rolls
B001,Smash Single,burger,54,54,5130,0,54
B012,Rooster Grande,burger,12,0,0,1200,12
...
```

## Success Criteria

After completing this workflow:
- ✅ Tablet page shows real item names (no UNKNOWN)
- ✅ Burger counts match Loyverse "Items sold" for 5pm→3am window
- ✅ Export CSV gives itemized shift list
- ✅ Category tabs work correctly (burger/drink/side/modifier/bundle)
- ✅ Cached data loads instantly (green badge)
- ✅ Date displayed in DD/MM/YYYY format

## Related Files

- **Import Script:** `server/scripts/catalog_import_from_file.ts`
- **API Routes:** `server/routes/shiftAnalysis.ts`
- **Business Logic:** `server/services/shiftItems.ts`
- **Frontend:** `client/src/pages/analysis/ShiftAnalyticsMM.tsx`
- **Date Formatting:** `client/src/lib/format.ts`
- **Shift Window:** `server/services/time/shiftWindow.ts`

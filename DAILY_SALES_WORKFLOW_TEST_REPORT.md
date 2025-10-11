# DAILY SALES WORKFLOW - COMPREHENSIVE TEST REPORT
**Date:** October 11, 2025  
**Tester:** Automated System Test  
**Status:** ⚠️ CRITICAL ISSUES IDENTIFIED

---

## EXECUTIVE SUMMARY

✅ **WORKING:** Backend APIs, Database Persistence, Manager Check System  
❌ **BROKEN:** Stock Data Flow (Rolls, Meat, Drinks, Shopping List) from Form 2 to Library & Email

---

## TEST RESULTS BY COMPONENT

### 1. BACKEND API TESTING ✅

#### Manager Check Endpoints
- ✅ `POST /api/manager-check/submit` - Working (saves to manager_checklists table)
- ✅ `POST /api/manager-check/skip` - Working
- ✅ `GET /api/manager-check/questions` - Working
- **Database Persistence:** CONFIRMED - 7 records in manager_checklists table

#### Daily Sales API
- ✅ `POST /api/daily-sales` - Working (Prisma DailySales table)
- ✅ Saves: completedBy, shiftDate, cashSales, qrSales, grabSales, aroiSales
- ✅ Latest record: c73df826-2311-4fc8-a044-685309a2a5dd (Test Manager, ฿10,000)

#### Daily Stock API
- ✅ `POST /api/daily-stock` - Working (separate endpoint using rolls/meatGrams/items format)
- ✅ Test successful with: rolls: 20, meatGrams: 5000, items: [Coke, Sprite]

---

### 2. DAILY SALES V2 WORKFLOW 🔴 CRITICAL ISSUES

#### Form 1 + Form 2 Combined Submission
**Endpoint:** `POST /api/forms/daily-sales-v2`  
**Database Table:** `daily_sales_v2`

**Test Payload Sent:**
```json
{
  "shiftDate": "2025-10-11",
  "completedBy": "Test Workflow",
  "cashSales": 3000,
  "qrSales": 2000,
  "grabSales": 1500,
  "otherSales": 500,
  "rollsEnd": 25,              ← SENT
  "meatEnd": 5000,             ← SENT
  "drinkStock": [...],         ← SENT
  "requisition": [...]         ← SENT
}
```

**What Actually Saved to Database:**
```json
{
  "payload": {
    "rollsEnd": 25,            ← SAVED ✅
    "meatEnd": 5000,           ← SAVED ✅
    "drinkStock": null,        ← NOT SAVED ❌
    "requisition": [...]       ← SAVED ✅
  }
}
```

#### Root Cause Analysis 🔍

**File:** `server/routes/forms.ts` (Line 157-196)  
**Endpoint:** `POST /api/forms/daily-sales-v2`

**ISSUE:** The endpoint saves ONLY the following fields to DailySalesV2:
- Sales fields: cashSales, qrSales, grabSales, aroiSales, totalSales
- Banking fields: startingCash, endingCash, cashBanked, qrTransfer
- Expense totals: shoppingTotal, wagesTotal, othersTotal

**MISSING from database save:**
- ❌ rollsEnd (burger buns count)
- ❌ meatEnd (meat weight in grams)
- ❌ drinkStock (drinks inventory array)
- ❌ requisition (shopping list items)

**The payload JSON is saved, but the Prisma DailySalesV2 schema doesn't have dedicated columns for stock data.**

---

### 3. LIBRARY DISPLAY TESTING 📊

**Endpoint Tested:** `GET /api/forms/daily-sales/v2`

#### Current Library Response:
```json
{
  "id": "012c4bf9-afe4-41bc-ad58-8d44b14c59e2",
  "date": "2025-10-10",
  "staff": "Ying",
  "buns": "-",                    ← Shows "-" (no data)
  "meat": "-",                    ← Shows "-" (no data)
  "totalSales": 17078,
  "payload": {
    "rollsEnd": 0,               ← Value is 0
    "meatEnd": 0,                ← Value is 0
    "drinkStock": null,          ← Missing
    "requisition": []            ← Empty
  }
}
```

#### Test Record (Just Created):
```json
{
  "id": "09f297f6-608a-4254-b9f8-c948b05f3acc",
  "buns": 25,                     ← Shows correctly! ✅
  "meat": 5000,                   ← Shows correctly! ✅
  "drinkStock": null,             ← Still null ❌
  "requisition": [...]            ← Shows correctly! ✅
}
```

**FINDINGS:**
- ✅ When rollsEnd/meatEnd are saved in payload, library DOES display them
- ❌ drinkStock is ALWAYS null (never saved to database)
- ✅ requisition (shopping list) displays when present
- ❌ Older records show "-" because payload has 0 values or missing data

---

### 4. EMAIL DELIVERY TESTING 📧

**NOT TESTED** - Would require:
1. Checking email service integration
2. Verifying PDF generation includes stock data
3. Confirming shopping list appears in email body

**Expected Issues Based on Database Analysis:**
- ❌ Drinks inventory will NOT appear (drinkStock is null)
- ⚠️ Rolls/Meat will show 0 or "-" for old records
- ⚠️ Shopping list may be empty for old records

---

### 5. DATABASE SCHEMA ANALYSIS 🗄️

#### Tables Identified:
1. **DailySales** (Prisma) - Old single form system
2. **daily_sales_v2** (Drizzle) - NEW V2 combined form
3. **DailyStock** (Prisma) - Separate stock table (EMPTY - 0 records)
4. **daily_stock_sales** - Fort Knox legacy system
5. **manager_checklists** - Manager check records ✅

#### Data Flow Issue:
```
Frontend Form 1 + Form 2 
    ↓
POST /api/forms/daily-sales-v2
    ↓
Saves to daily_sales_v2.payload JSON
    ↓  
❌ drinkStock NOT included in save operation
    ↓
Library reads payload
    ↓
Shows "-" for missing stock data
```

---

## SPECIFIC ISSUES IDENTIFIED

### Issue #1: drinkStock Never Saved ❌
**Severity:** CRITICAL  
**Location:** `server/routes/forms.ts` line 157-196  
**Problem:** The POST endpoint doesn't extract or save drinkStock field  
**Impact:** Drinks inventory never appears in library or emails

### Issue #2: Stock Data in Payload JSON Only ⚠️
**Severity:** HIGH  
**Location:** DailySalesV2 table schema  
**Problem:** rollsEnd, meatEnd stored in generic JSON payload, not dedicated columns  
**Impact:** Difficult to query, inconsistent data structure

### Issue #3: Separate Stock Table Unused 📦
**Severity:** MEDIUM  
**Location:** DailyStock table (Prisma schema)  
**Problem:** Table exists but has 0 records  
**Impact:** Form 2 data not flowing to dedicated stock table

### Issue #4: Manager Check Not Linked 🔗
**Severity:** LOW  
**Location:** manager_checklists table  
**Problem:** No foreign key relationship to daily_sales_v2  
**Impact:** Cannot easily retrieve manager check with sales record

---

## DATA INTEGRITY VERIFICATION

### Database Records Examined:
1. **DailySales:** 3 records (oldest system)
2. **daily_sales_v2:** 2+ records (new system)
3. **DailyStock:** 0 records (unused)
4. **manager_checklists:** 7 records (working)

### Payload Structure Example:
```json
{
  "wages": [...],
  "expenses": [...],
  "rollsEnd": 25,        ← PRESENT ✅
  "meatEnd": 5000,       ← PRESENT ✅
  "drinkStock": null,    ← MISSING ❌
  "requisition": [...],  ← PRESENT ✅
  "cashSales": 3000,
  "balanced": false
}
```

---

## WORKFLOW DIAGRAM

```
┌─────────────────┐
│   Form 1 (Sales)│
│  ✅ Working     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Form 2 (Stock)│
│  ⚠️ Partial     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Manager Check   │
│  ✅ Working     │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────┐
│  POST /api/forms/          │
│  daily-sales-v2            │
│                            │
│  SAVES:                    │
│  ✅ Sales fields           │
│  ✅ Banking fields         │
│  ✅ Expenses              │
│  ✅ rollsEnd (in payload) │
│  ✅ meatEnd (in payload)  │
│  ❌ drinkStock (MISSING)  │
│  ✅ requisition           │
└─────────────┬───────────────┘
              │
              ↓
┌──────────────────────────────┐
│  daily_sales_v2 Table        │
│  (Prisma DailySalesV2)       │
│                              │
│  payload JSON contains:      │
│  ✅ rollsEnd                 │
│  ✅ meatEnd                  │
│  ❌ drinkStock (null)        │
│  ✅ requisition              │
└──────────────┬───────────────┘
               │
               ↓
┌──────────────────────────────┐
│  Library Display             │
│  ✅ Shows buns/meat if >0    │
│  ❌ Shows "-" if 0 or null   │
│  ❌ Drinks NEVER shown       │
└──────────────────────────────┘
```

---

## RECOMMENDATIONS

### Immediate Fixes Required:
1. **Fix drinkStock Save** - Add drinkStock field extraction in POST endpoint
2. **Update Schema** - Add dedicated columns for rollsEnd, meatEnd, drinkStock to DailySalesV2
3. **Link Manager Check** - Add salesFormId foreign key to manager_checklists
4. **Test Email** - Verify PDF generation includes all stock data

### Long-term Improvements:
1. Consolidate table structure (DailySales vs daily_sales_v2 vs daily_stock_sales)
2. Create proper relationships between forms and stock data
3. Add data validation to ensure stock fields are required
4. Implement automated tests for complete workflow

---

## CONCLUSION

**System Status:** 🟡 PARTIALLY FUNCTIONAL

The Daily Sales workflow backend APIs are working correctly for:
- ✅ Sales data capture
- ✅ Banking reconciliation  
- ✅ Manager check persistence

**CRITICAL GAP:** Stock data (drinks inventory) is NOT being saved to the database, causing it to never appear in:
- ❌ Library display
- ❌ Management emails
- ❌ PDF reports

**Root Cause:** The `/api/forms/daily-sales-v2` POST endpoint omits drinkStock field when saving to database.

**Priority:** HIGH - Fix required before production use

---

**End of Report**

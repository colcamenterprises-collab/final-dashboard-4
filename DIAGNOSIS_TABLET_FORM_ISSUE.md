# Diagnostic Report: Daily Sales & Stock Form Data Not Showing in Library (Tablet Mode)

**Date**: October 16, 2025  
**Issue**: Form 2 (Stock) and drinks data not displaying in Sales Library on tablet  
**Status**: 🔴 **ROOT CAUSE IDENTIFIED** - JavaScript Falsy Value Bug

---

## 🔍 Issue Summary

When users complete the Daily Sales & Stock form on tablets:
- ✅ Form 1 (Sales) data saves correctly and displays in library
- ❌ Form 2 (Stock) data saves but shows **"-"** in library columns (Rolls, Meat, Drinks)
- The modal view shows the data correctly
- **The issue affects BOTH desktop and tablet** (not tablet-specific)

---

## 🐛 Root Cause Analysis

### The Bug Location
**File**: `server/forms/dailySalesV2.ts`  
**Lines**: 273-274  
**Function**: `getDailySalesV2()`

```typescript
const records = result.rows.map((row: any) => ({
  id: row.id,
  date: row.shiftDate || row.createdAt,
  staff: row.completedBy,
  cashStart: row.payload?.startingCash || 0,
  cashEnd: row.payload?.closingCash || 0,
  totalSales: row.payload?.totalSales || 0,
  buns: row.payload?.rollsEnd || "-",        // 🔴 BUG HERE
  meat: row.payload?.meatEnd || "-",         // 🔴 BUG HERE
  status: "Submitted",
  payload: row.payload || {}
}));
```

### The Problem: JavaScript Falsy Value Handling

**JavaScript treats `0` as falsy**, so the `||` operator returns the fallback value:

```javascript
// If user enters 0 rolls:
row.payload?.rollsEnd = 0
buns: 0 || "-"  // Returns "-" ❌ (wrong!)

// If user enters 0 grams of meat:
row.payload?.meatEnd = 0
meat: 0 || "-"  // Returns "-" ❌ (wrong!)
```

**Expected behavior**: Should show "0" not "-"

---

## 📊 Data Flow Analysis

### Frontend → Backend Flow (WORKING CORRECTLY ✅)

#### Form 1 Submission:
```typescript
// client/src/pages/operations/daily-sales/Form.tsx (Line 186)
POST /api/forms/daily-sales/v3
Body: {
  completedBy: "Test",
  startingCash: 2000,
  cashSales: 2000,
  qrSales: 2000,
  grabSales: 2000,
  otherSales: 2000,
  expenses: [...],
  wages: [...],
  closingCash: 0
}
```

#### Form 2 (Stock) Submission:
```typescript
// client/src/pages/operations/DailyStock.tsx (Line 256)
PATCH /api/forms/daily-sales/v2/{shiftId}/stock
Body: {
  rollsEnd: 0,           // User entered 0
  meatEnd: 0,            // User entered 0
  drinkStock: {          // Object format
    "Coke": 0,
    "Sprite": 0,
    ...
  },
  requisition: [...]
}
```

**Database Update** (Line 342 in dailySalesV2.ts):
```sql
UPDATE daily_sales_v2 
SET payload = payload || $1  -- PostgreSQL JSONB merge
WHERE id = $2
```

This correctly merges the stock data into the existing payload JSONB column.

---

### Backend → Frontend Flow (BROKEN ❌)

#### Library Data Fetch:
```typescript
// client/src/pages/operations/daily-sales-v2/Library.tsx (Line 116)
GET /api/forms/daily-sales/v2
```

**Backend Response Mapping** (dailySalesV2.ts Line 266-277):
```typescript
{
  id: "abc-123",
  date: "2025-10-16",
  staff: "Test",
  totalSales: 8000,
  buns: 0 || "-",        // 🔴 Returns "-" when rollsEnd = 0
  meat: 0 || "-",        // 🔴 Returns "-" when meatEnd = 0
  status: "Submitted",
  payload: {
    rollsEnd: 0,         // ✅ Correct in payload
    meatEnd: 0,          // ✅ Correct in payload
    drinkStock: {...}    // ✅ Correct in payload
  }
}
```

#### Library Display (Library.tsx Line 312-317):
```tsx
<td>{rec.buns}</td>                    {/* Shows "-" instead of 0 */}
<td>{rec.meat}</td>                    {/* Shows "-" instead of 0 */}
<td>
  {(rec.payload?.drinkStock || []).length > 0 
    ? `${(rec.payload?.drinkStock || []).reduce((sum, d) => sum + (d.quantity || 0), 0)} items`
    : "-"}
</td>
```

**Drinks Column Issue**:
- Frontend expects `drinkStock` to be an **array**: `[{name: "Coke", quantity: 5}, ...]`
- Backend saves it as an **object**: `{"Coke": 5, "Sprite": 3, ...}`
- Type mismatch causes `.length` to be undefined, shows "-"

---

## 🎯 Specific Issues Identified

### Issue #1: Zero Values Display as "-" (CRITICAL)
**Location**: `server/forms/dailySalesV2.ts` lines 273-274  
**Cause**: Using `||` operator with falsy values (0)  
**Impact**: Any 0 value for rolls or meat shows as "-" in library

### Issue #2: Drinks Data Type Mismatch
**Location**: Data format inconsistency between frontend/backend  
**Frontend expects**: Array of objects `[{name, quantity, unit}]`  
**Backend saves**: Object `{drinkName: quantity}`  
**Impact**: Drinks column always shows "-" even with valid data

---

## 📸 Evidence from User Screenshots

**Screenshot 1**: Modal view showing:
- Rolls: 0 pcs ✅ (visible in modal)
- Meat: 0 grams ✅ (visible in modal)

**Screenshot 2**: Library table showing:
- Rolls column: "-" ❌
- Meat column: "-" ❌  
- Drinks column: "-" ❌

**This confirms**: Data IS in database, but display logic is broken

---

## 🔬 Testing Evidence

### Database State (What's Actually Saved):
```json
{
  "payload": {
    "completedBy": "Test",
    "cashSales": 2000,
    "qrSales": 2000,
    "totalSales": 8000,
    "rollsEnd": 0,        // ✅ Saved correctly
    "meatEnd": 0,         // ✅ Saved correctly
    "drinkStock": {       // ✅ Saved correctly (as object)
      "Coke": 0,
      "Sprite": 0,
      ...
    },
    "balanced": false
  }
}
```

### What Library Displays:
```
Date        Staff   Total Sales   Rolls   Meat   Drinks   Balanced
10/16/2025  Test    ฿8,000.00     -       -      -        Not Balanced
```

---

## ✅ Recommended Fixes

### Fix #1: Handle Zero Values Correctly (PRIORITY 1)
**File**: `server/forms/dailySalesV2.ts`  
**Lines**: 273-274

**Current code**:
```typescript
buns: row.payload?.rollsEnd || "-",
meat: row.payload?.meatEnd || "-",
```

**Corrected code**:
```typescript
buns: row.payload?.rollsEnd ?? "-",  // Use nullish coalescing
meat: row.payload?.meatEnd ?? "-",   // Returns 0 instead of "-"
```

**OR use explicit check**:
```typescript
buns: (row.payload?.rollsEnd !== null && row.payload?.rollsEnd !== undefined) 
      ? row.payload.rollsEnd 
      : "-",
meat: (row.payload?.meatEnd !== null && row.payload?.meatEnd !== undefined) 
      ? row.payload.meatEnd 
      : "-",
```

### Fix #2: Normalize Drinks Data Format (PRIORITY 2)
**Options**:

**Option A**: Convert object to array in backend response
```typescript
// In getDailySalesV2()
const drinkStockArray = row.payload?.drinkStock 
  ? Object.entries(row.payload.drinkStock).map(([name, quantity]) => ({
      name,
      quantity: quantity as number,
      unit: 'pcs'
    }))
  : [];

// Add to response:
payload: {
  ...row.payload,
  drinkStock: drinkStockArray
}
```

**Option B**: Update frontend to handle object format
```typescript
// In Library.tsx line 314-317
<td className="px-2 py-1 border-b">
  {rec.payload?.drinkStock && typeof rec.payload.drinkStock === 'object'
    ? Object.values(rec.payload.drinkStock).reduce((sum, qty) => sum + Number(qty), 0) + ' items'
    : "-"}
</td>
```

---

## 🧪 How to Verify Fixes

### Test Case 1: Zero Values
1. Complete Form 1 with all sales data
2. Complete Form 2 with:
   - Rolls: **0**
   - Meat: **0**  
   - All drinks: **0**
3. Submit and check library
4. ✅ **Expected**: Shows "0" not "-"

### Test Case 2: Non-Zero Values
1. Complete Form 2 with:
   - Rolls: **15**
   - Meat: **2500**
   - Drinks: various counts
2. ✅ **Expected**: Shows actual values

### Test Case 3: Drinks Display
1. Enter 10 Coke, 5 Sprite, 3 Fanta
2. ✅ **Expected**: Shows "18 items" in library

---

## 🎯 Summary

**Root Causes**:
1. ❌ Using `||` instead of `??` causes 0 values to show as "-"
2. ❌ Data type mismatch (object vs array) for drinks breaks display
3. ✅ Data IS being saved correctly to database
4. ✅ Data IS displayed correctly in modal view
5. ❌ Only library table display is broken

**Not a Tablet Issue**: This affects all devices equally - the bug is in the backend-to-frontend data mapping logic.

**Impact**: Users think data isn't saving when it actually is - it's just not displaying correctly in the table.

---

**Recommendation**: Apply Fix #1 immediately (nullish coalescing) to resolve the zero value issue. Fix #2 can be applied as a follow-up enhancement.

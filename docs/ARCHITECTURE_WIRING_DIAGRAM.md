# System Architecture Wiring Diagram
## Final Dashboard 4.0 — Smash Brothers Burgers
### READ-ONLY ANALYSIS DOCUMENT

**Generated:** January 28, 2026

---

## SECTION 1 — POS INGESTION (SALES DATA)

### Files Handling POS Ingestion

| File Path | Purpose |
|-----------|---------|
| `server/webhooks.ts` | Webhook endpoint for real-time Loyverse events |
| `server/services/loyverseReceipts.ts` | Primary polling/sync service via `LoyverseReceiptService.fetchAndStoreReceipts()` |
| `server/services/loyverseDataOrchestrator.ts` | Orchestration layer with `processShiftData()` and `performManualSync()` |
| `server/services/scheduler.ts` | Cron-based scheduling via `SchedulerService.syncReceiptsAndReports()` |
| `server/routes/loyverseSync.ts` | Manual sync endpoint |
| `server/loyverseAPI.ts` | Core API client for Loyverse |

### Method Used
- **Webhook**: `POST /api/webhooks/loyverse` (events: `receipt.created`, `receipt.updated`, `shift.closed`)
- **Polling**: Every 15 minutes via `scheduleIncrementalSync()` in `server/services/scheduler.ts`
- **Scheduled Sync**: Daily at 3:00 AM Bangkok time via `scheduleDailyTask()`
- **Manual Trigger**: Yes, via API

### Entry Function Names

| Function | File |
|----------|------|
| `handleReceiptWebhook(event)` | `server/webhooks.ts` |
| `handleShiftClosedWebhook(event)` | `server/webhooks.ts` |
| `fetchAndStoreReceipts()` | `server/services/loyverseReceipts.ts` |
| `processShiftData(shiftDate)` | `server/services/loyverseDataOrchestrator.ts` |
| `performManualSync()` | `server/services/loyverseDataOrchestrator.ts` |
| `syncReceiptsAndReports()` | `server/services/scheduler.ts` |

### API Routes Exposed

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/webhooks/loyverse` | POST | Webhook receiver |
| `/api/loyverse/sync` | POST | Manual date range sync |
| `/api/loyverse-enhanced/enhanced/manual-sync` | POST | Manual sync with enhanced processing |

### DB Tables Written To

| Table | Schema Location |
|-------|-----------------|
| `loyverse_receipts` | `shared/schema.ts` → `loyverseReceipts` |
| `loyverse_shift_reports` | `shared/schema.ts` → `loyverseShiftReports` |

### Explicit Answers

**Is there a manual "Sync" button?**
Yes. Multiple paths exist:
- `/api/loyverse/sync` (POST with `from`/`to` date range)
- `/api/loyverse-enhanced/enhanced/manual-sync` (POST)
- `triggerManualSync()` and `triggerPOSSync()` methods in `server/services/scheduler.ts` (lines 452-463)

**Is there already a webhook endpoint present but unused?**
No. Webhook endpoint at `/api/webhooks/loyverse` is implemented and active in `server/webhooks.ts`. It handles `receipt.created`, `receipt.updated`, `shift.opened`, and `shift.closed` events.

**Are modifiers ingested separately or inline with line items?**
Inline. Modifiers are stored within the `items` JSONB column of `loyverse_receipts` table. In webhook handler (`server/webhooks.ts`, line 101): `items: receiptData.line_items || []`. The `line_items` array contains nested `modifiers` arrays per item.

---

## SECTION 2 — POS NORMALIZATION & MODIFIERS

### Files Where Line Items Are Normalized

| File Path | Purpose |
|-----------|---------|
| `server/services/pos-ingestion/normalizer.js` | Main normalization: `normalizeReceipt()` function |
| `server/services/rma/canonicalSalesBuilder.ts` | Canonical sales builder: `buildSaleCanonicalAuthority()` |
| `server/services/shiftAnalytics.ts` | Shift processing: `processReceiptItemsAndModifiers()` |
| `server/services/loyverseParsers.ts` | CSV parsing for uploaded files |

### Files Where Modifiers Are Processed

| File Path | Function |
|-----------|----------|
| `server/services/rma/modifierResolver.ts` | `ModifierResolver.resolve()` — Applies modifier effects (ADD, REMOVE, MULTIPLY, SWAP, ZERO) |
| `server/services/rma/canonicalSalesBuilder.ts` | `extractModifierInputs()` — Extracts modifier IDs from line items |
| `server/services/shiftAnalytics.ts` | `processReceiptItemsAndModifiers()` — Separates items and modifiers |
| `server/services/receiptTruthModifierEffective.ts` | Modifier effectiveness analysis |

### Data Structures Used

**Items (from `normalizer.js`):**
```javascript
{
  providerItemId: item.id,
  sku: s(item.sku) || s(item.item_id) || s(item.handle),
  name: s(item.item_name) || s(item.name) || 'Unknown Item',
  category: s(item.category) || 'GENERAL',
  qty: item.quantity || 1,
  unitPrice: toCents(item.price),
  total: toCents(item.total_money),
  modifiers: item.line_modifiers || item.modifiers || null
}
```

**Modifiers (from `modifierResolver.ts`):**
```typescript
type ModifierEffect = {
  ingredientId: number;
  qtyDelta: number;
  unit: string;
  type: 'ADD' | 'REMOVE' | 'MULTIPLY' | 'SWAP' | 'ZERO';
};
```

### Where Modifier Attribution Happens
- **Authority Tables**: `modifier_option_authority` and `modifier_effect_authority` (schema.ts)
- **Resolution**: `server/services/rma/canonicalSalesBuilder.ts` lines 143-150: Maps POS modifier IDs to authority records
- **Application**: `server/services/rma/modifierResolver.ts` applies effects to base ingredients

### Explicit Answers

**Where are modifiers possibly being mis-counted as items?**
UNKNOWN. The `normalizer.js` file correctly separates modifiers from items (line 88: `modifiers: item.line_modifiers || item.modifiers || null`). However, if Loyverse sends modifiers as separate line items (not nested), they would appear as standalone items. Investigation needed in raw `loyverse_receipts.rawData` to confirm.

**Where are base items possibly double-counted?**
UNKNOWN. The canonical sales builder (`canonicalSalesBuilder.ts`) uses SKU matching. If the same product exists with multiple SKUs or if combos/bundles contain base items, double-counting may occur. Requires analysis of `product_recipe_authority` mappings.

---

## SECTION 3 — SALES ANALYSIS PIPELINE

### Files Computing Items Sold / Category Totals / Summaries

| File Path | Function | Purpose |
|-----------|----------|---------|
| `server/services/shiftAnalytics.ts` | `processPreviousShift()` | Aggregates items/modifiers by category |
| `server/services/shiftItems.ts` | `computeShiftAll()` | Populates `analytics_shift_item` table |
| `server/services/shiftBurgerCache.ts` | `buildAndSaveBurgerShiftCache()` | Burger-specific analytics cache |
| `server/services/receiptSummary.ts` | `buildShiftSummary()` | General shift summary |
| `server/services/jussiDailySummaryService.ts` | — | Daily summary generation |
| `server/routes/analysisDailyReview.ts` | — | Daily review endpoints |
| `server/routes/analysisShift.ts` | — | Shift analysis CSV upload |

### API Routes Feeding Analysis Page

| Route | Purpose |
|-------|---------|
| `GET /api/loyverse/shifts` | Fetch shift data |
| `GET /api/loyverse/receipts` | Fetch receipt data |
| `GET /api/operations/stats` | Dashboard statistics |
| `GET /api/jussi/latest` | Latest Jussi daily report |
| `POST /api/analysis/shift-summary/upload` | CSV file upload analysis |
| `GET /api/analysis/daily-review/:date` | Daily review data |

### Frontend Components Rendering This Data

| File Path | Component |
|-----------|-----------|
| `client/src/pages/operations/Analysis.tsx` | `Analysis` — Main analysis page |
| `client/src/pages/analysis/DailyReview.tsx` | Daily review dashboard |
| `client/src/pages/analysis/ShiftAnalyticsMM.tsx` | Menu management shift analytics |
| `client/src/pages/analysis/StockReview.tsx` | Stock review |
| `client/src/pages/analysis/StockReconciliation.tsx` | Stock reconciliation |

---

## SECTION 4 — EXPENSES MODAL (PURCHASE LODGEMENT)

### Frontend File Path for Modal
`client/src/components/operations/ExpenseLodgmentModal.tsx`

### Backend API Route It Calls

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/expensesV2` | POST | Create new expense |
| `/api/expensesV2/:id` | PUT | Update existing expense |

Backend handler: `server/routes/expensesV2Routes.ts`

### Payload Structure Sent From Frontend
```typescript
{
  date: string;        // "YYYY-MM-DD"
  supplier: string;    // e.g., "Makro"
  category: string;    // e.g., "Food & Beverage"
  description: string; // e.g., "Weekly meat purchase"
  amount: number;      // e.g., 5000
}
```

### DB Table/Model Written To
`expenses_v2` table via Prisma (`prisma.expenses_v2.create()`)

### Explicit Answers

**How meat purchases are stored:**
Via `server/routes/expenses.ts` → `POST /api/expenses/meat` which writes to `OtherExpenseV2` table (`prisma.otherExpenseV2.create()`). Label format: `"Meat ${meatType} ${weightG}g"`. Amount is 0 (tracking only, not expense).

**Why meat reappears correctly:**
Meat is queried from `meat_ledger` table which reads from `daily_sales_v2.payload->>'meatEnd'` and `purchase_tally.meat_grams`. The `meat_ledger` service (`server/services/meatLedger.ts`) correctly computes starting stock from previous day's ledger entry.

**Why rolls do NOT populate:**
UNKNOWN. The ExpenseLodgmentModal does NOT have a "rolls" option. Rolls are lodged via:
1. `StockLodgmentModal` → `/api/stock/rolls` → `stock_received_log` table
2. `StockReceivedModal` → `/api/stock/rolls` → `stock_received_log` table

The `rolls_ledger` service (`server/services/rollsLedger.ts`) queries `expenses` table for entries with `source = 'STOCK_LODGMENT'` AND item containing "bun" or "roll". If ExpenseLodgmentModal doesn't set these correctly, rolls won't appear.

**Why drinks do NOT populate:**
UNKNOWN. Same issue as rolls. Drinks are lodged via StockReceivedModal → `/api/stock/drinks` → `stock_received_log` table. There is no drinks ledger service equivalent to rolls/meat ledgers. Drinks data may be fragmented across:
- `stock_received_log` (from StockReceivedModal)
- `OtherExpenseV2` (from `POST /api/expenses/drinks`)
- `daily_sales_v2.payload` (form submission)

No unified query path identified.

---

## SECTION 5 — SHOPPING LIST LODGEMENT (SECONDARY)

### Frontend File Path
`client/src/components/purchasing/StockReceivedModal.tsx`
(Opened from `client/src/pages/ShoppingList.tsx`)

### Backend Routes

| Route | Method | Handler |
|-------|--------|---------|
| `/api/stock/rolls` | POST | `server/routes/stock/stockRoutes.ts` line 175 |
| `/api/stock/meat` | POST | `server/routes/stock/stockRoutes.ts` line 227 |
| `/api/stock/drinks` | POST | `server/routes/stock/stockRoutes.ts` line 257 |

### DB Table/Model Used
`stock_received_log` table (via raw SQL in `stockRoutes.ts`)

Schema inferred from insert statements:
```sql
INSERT INTO stock_received_log 
  (shift_date, item_type, item_name, qty, weight_g, source, paid, created_at)
```

### Explicit Answers

**Does this duplicate the expenses data?**
Partially. For **rolls only**, if `paid=true`, an expense is ALSO created in `expenses` table (lines 192-213 in stockRoutes.ts). Meat and drinks do NOT create expense entries.

**Does it write to a different table than Expenses modal?**
Yes. 
- `StockReceivedModal` → `stock_received_log` + optionally `expenses`
- `ExpenseLodgmentModal` → `expenses_v2`
- `StockLodgmentModal` → uses different routes (legacy)

These are DIFFERENT tables with DIFFERENT schemas.

---

## SECTION 6 — CORE STOCK DATA (ROLLS / MEAT / DRINKS)

### Tables/Models Holding Purchased Data

| Stock Type | Primary Table | Secondary Sources |
|------------|---------------|-------------------|
| Rolls | `stock_received_log` (item_type='rolls') | `expenses` (source='STOCK_LODGMENT', item LIKE '%bun%' OR '%roll%') |
| Meat | `stock_received_log` (item_type='meat') | `purchase_tally.meat_grams`, `daily_stock_v2.meatWeightG` |
| Drinks | `stock_received_log` (item_type='drinks') | UNKNOWN unified table |

### Tables/Models Holding End-of-Shift Counts

| Stock Type | Table | Column |
|------------|-------|--------|
| Rolls | `daily_sales_v2` | `payload->>'rollsEnd'` |
| Rolls (legacy) | `daily_stock_sales` | `burger_buns_stock` |
| Meat | `daily_sales_v2` | `payload->>'meatEnd'` |
| Drinks | UNKNOWN | No dedicated column identified |

### Files That Read These Values

| File Path | Purpose |
|-----------|---------|
| `server/services/rollsLedger.ts` | `getRollsPurchased()`, `getActualRollsEnd()`, `getRollsStart()` |
| `server/services/meatLedger.ts` | `getMeatPurchased()`, `getActualMeatEnd()`, `getMeatStart()` |
| `server/routes/rollsLedger.ts` | API endpoints for rolls ledger |
| `server/routes/meatLedger.ts` | API endpoints for meat ledger |

### Explicit Answers

**Is there a single canonical ledger?**
NO. There are TWO separate ledgers:
1. `rolls_ledger` table (per shift)
2. `meat_ledger` table (per shift)

Drinks have NO dedicated ledger.

**Or multiple partial ledgers?**
YES. The system has:
- `rolls_ledger` — Computed from `stock_received_log` + `expenses` + `analytics_shift_item`
- `meat_ledger` — Computed from `purchase_tally` + `daily_sales_v2` + `analytics_shift_item`
- `stock_received_log` — Raw input data for all three types
- `daily_sales_v2.payload` — End-of-shift counts from staff form
- `daily_stock_sales` — Legacy table, still queried as fallback

This fragmentation is likely why rolls and drinks don't populate correctly.

---

## SECTION 7 — DAILY EMAIL SUMMARY

### Files Responsible

| File Path | Purpose |
|-----------|---------|
| `server/services/email.ts` | Main email service: `sendDailyEmail()`, `sendReportEmail()` |
| `server/services/scheduler.ts` | Email scheduling: `generateJussiSummary()`, `sendDailySalesSummary()` |
| `server/services/salesEmail.ts` | Sales-specific emails |
| `server/services/shiftReportEmail.ts` | Shift report emails |
| `server/services/gmailService.ts` | Gmail transport |
| `server/services/cronEmailService.ts` | Cron-triggered emails |
| `server/services/jussiDailySummaryService.ts` | Jussi daily summary generation |

### Trigger Mechanism
- **Cron**: 8:00 AM Bangkok (Jussi summary) and 9:00 AM Bangkok (daily sales)
- Functions scheduled in `server/services/scheduler.ts`:
  - Line 34-36: `generateJussiSummary()` at 8:00 AM
  - Line 39-41: `sendDailySalesSummary()` at 9:00 AM

### Data Source Used
From `server/services/email.ts` → `sendDailyEmail()`:
- `dailySalesV2` table (staff form data)
- Loyverse shifts via `getShiftReport()`
- Loyverse receipts via `getUtilReceipts()`
- Variance calculation (hardcoded mock currently)
- Shopping list (mock data currently)

### Explicit Answers

**Does it include modifiers?**
Yes. In `email.ts` line 48-49:
```typescript
li.modifiers?.forEach((m: any) => acc[`Modifier: ${m.name}`] = (acc[`Modifier: ${m.name}`] || 0) + 1);
```

**Does it group by category?**
No explicit category grouping in the email template. Items are listed flat with `itemsSold` aggregation by item name.

---

## SUMMARY OF KEY FINDINGS

### Data Entry Points
1. **Webhook** → `loyverse_receipts`
2. **Polling/Cron** → `loyverse_receipts`, `loyverse_shift_reports`
3. **Manual Upload (CSV)** → Parsed in-memory, cross-checked with forms
4. **Staff Forms** → `daily_sales_v2`, `daily_stock_v2`
5. **Stock Modals** → `stock_received_log`, `expenses`, `expenses_v2`

### Storage Fragmentation Issues
- **3 expense tables**: `expenses`, `expenses_v2`, `OtherExpenseV2`
- **2 daily forms**: `daily_sales_v2`, `daily_stock_sales` (legacy)
- **2 ledgers**: `rolls_ledger`, `meat_ledger` (no drinks ledger)
- **1 unified stock log**: `stock_received_log` (but not fully integrated)

### Transformation Points
- Receipts → `analytics_shift_item` via `computeShiftAll()`
- Analytics → Ledgers via `computeAndUpsertRollsLedger()`, `computeAndUpsertMeatLedger()`
- Ledgers → Email summaries via `sendDailyEmail()`

### Display Endpoints
- `/api/loyverse/receipts` → Analysis page
- `/api/loyverse/shifts` → Analysis page
- `/api/analysis/daily-review/:date` → Daily Review
- `/api/stock/variance/*` → Stock variance analysis

---

## DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA ENTRY POINTS                               │
└─────────────────────────────────────────────────────────────────────────────┘
     │                    │                    │                    │
     ▼                    ▼                    ▼                    ▼
┌─────────┐        ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Webhook │        │ Polling/    │      │ Staff Forms │      │ Stock       │
│ (POS)   │        │ Cron Sync   │      │ (Shift End) │      │ Modals      │
└────┬────┘        └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
     │                    │                    │                    │
     ▼                    ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRIMARY STORAGE                                 │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ├── loyverse_receipts ────────────────┐
     ├── loyverse_shift_reports            │
     ├── daily_sales_v2 ──────────────────┐│
     ├── daily_stock_v2                   ││
     ├── stock_received_log ─────────────┐││
     ├── expenses / expenses_v2          │││
     └── purchase_tally                  │││
                                         │││
┌─────────────────────────────────────────┴┴┴────────────────────────────────┐
│                              TRANSFORMATION                                 │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ├── computeShiftAll() ──────► analytics_shift_item
     ├── computeAndUpsertRollsLedger() ──────► rolls_ledger
     ├── computeAndUpsertMeatLedger() ──────► meat_ledger
     └── buildShiftSummary() ──────► shift_summary
                                         │
┌────────────────────────────────────────┴────────────────────────────────────┐
│                              DISPLAY / OUTPUT                               │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ├── Analysis Page (frontend)
     ├── Daily Review Page (frontend)
     ├── Stock Reconciliation (frontend)
     └── Daily Email Summary (cron)
```

---

**END OF WIRING DIAGRAM**

*This document is READ-ONLY analysis. No code modifications were made during its creation.*

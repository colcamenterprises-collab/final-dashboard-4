# Receipts System Architecture - Comprehensive Documentation

## Overview
The Receipts system within the Analysis section is a multi-layered architecture with **MULTIPLE REDUNDANT SYSTEMS** that handle POS receipt data, Loyverse integration, and analytics. This document details all components, routes, endpoints, and identifies duplicate/redundant implementations.

---

## 🚨 CRITICAL: Redundant Systems Identified

### Multiple Receipt Tables (REDUNDANCY ALERT!)
The system has **FOUR different receipt-related database tables**, indicating architectural duplication:

1. **`receipts`** (Enhanced receipt management system)
   - Location: `shared/schema.ts` (Line 154)
   - Fields: `id`, `receiptId`, `items`, `modifiers`, `total`, `timestamp`, `paymentType`, `netSales`, `grossSales`, `discounts`, `taxes`, `shiftDate`, `processed`
   - Purpose: General receipt storage with comprehensive fields
   - Status: ⚠️ Legacy system, potentially redundant

2. **`loyverseReceipts`** (Loyverse-specific receipts)
   - Location: `shared/schema.ts` (Line 379)
   - Fields: `id`, `receiptId`, `receiptNumber`, `receiptDate`, `totalAmount`, `paymentMethod`, `customerInfo`, `items`, `taxAmount`, `discountAmount`, `staffMember`, `tableNumber`, `shiftDate`, `rawData`
   - Purpose: Loyverse API integration receipts
   - Status: ⚠️ Duplicate functionality

3. **`loyverse_receipts`** (Alternative Loyverse storage)
   - Location: `shared/schema.ts` (Line 1340)
   - Fields: `shiftDate` (PRIMARY KEY), `data` (JSONB)
   - Purpose: JSONB-based Loyverse receipt storage
   - Status: ⚠️ **DUPLICATE** of loyverseReceipts

4. **`posReceipt`** (pos_receipt table)
   - Location: `shared/schema.ts` (Line 1046)
   - Fields: `id`, `batchId`, `receiptId`, `datetime`, `total`, `itemsJson`, `payment`, `createdAt`
   - Purpose: POS upload batch receipts
   - Status: ✅ Active, used for manual POS uploads

---

## Frontend Architecture

### Pages & Components

#### 1. **Main Receipts Page** (`Receipts.tsx`)
- **Route**: `/operations/analysis/receipts` (registered in RouteRegistry)
- **Location**: `client/src/pages/Receipts.tsx`
- **API Endpoint**: `GET /api/receipts/jussi-summary/latest`
- **Purpose**: Display shift summary from Jussi analysis
- **Data Structure**:
  ```typescript
  interface ReceiptSummary {
    shiftDate: string;
    shiftStart: string;
    shiftEnd: string;
    firstReceipt: string;
    lastReceipt: string;
    totalReceipts: number;
    grossSales: number;
    netSales: number;
    paymentBreakdown: Record<string, { count: number; amount: number }>;
    itemsSold: Record<string, { quantity: number; total: number }>;
    drinkQuantities: Record<string, number>;
    burgerRollsUsed: number;
    meatUsedKg: number;
    modifiersSold: Record<string, { count: number; total: number }>;
    refunds: Array<{ receiptNumber: string; amount: number; date: string }>;
  }
  ```

#### 2. **POS Receipts Viewer** (`PosReceipts.tsx`)
- **Route**: Not directly registered (sub-page of Analysis)
- **Location**: `client/src/pages/analysis/PosReceipts.tsx`
- **Component Used**: `<ReceiptsViewer batchId={activeBatchId} />`
- **Purpose**: Browse individual receipts from uploaded POS data
- **Flow**:
  1. User enters batch ID
  2. Searches batch
  3. ReceiptsViewer component loads receipts

#### 3. **Receipts Viewer Component** (`ReceiptsViewer.tsx`)
- **Location**: `client/src/components/pos/ReceiptsViewer.tsx`
- **API Endpoint**: `GET /api/pos/receipts?batchId={batchId}`
- **Query Key**: `['/api/pos/receipts', batchId]`
- **Data Type**:
  ```typescript
  type PosReceipt = {
    id: string;
    receiptId: string;
    datetime: string;
    total: string;
    payment: string;
    itemsJson: any[];
  }
  ```
- **Features**:
  - Table display of receipts
  - Total amount calculation
  - Payment method badges
  - Item count display
  - Thai Baht formatting

#### 4. **Legacy/Archive Components**
- `client/src/pages/ReceiptsSummary.tsx` - ⚠️ Likely redundant
- `client/src/archive/LoyverseLive.tsx` - ⚠️ Archived Loyverse integration

---

## Backend Architecture

### API Routes & Endpoints

#### 1. **POS Receipts Router** (`posReceipts.ts`)
- **File**: `server/routes/posReceipts.ts`
- **Base Mount**: `/api/pos`
- **Endpoints**:

##### `GET /api/pos/receipts?batchId={batchId}`
- **Purpose**: Get receipts for a specific POS batch
- **Database**: `posReceipt` table (Drizzle ORM)
- **Query**: 
  ```typescript
  db.select({
    id: posReceipt.id,
    receiptId: posReceipt.receiptId,
    datetime: posReceipt.datetime,
    total: posReceipt.total,
    payment: posReceipt.payment,
    itemsJson: posReceipt.itemsJson,
  })
  .from(posReceipt)
  .where(eq(posReceipt.batchId, batchId))
  .orderBy(posReceipt.datetime);
  ```
- **Response Format**:
  ```json
  {
    "ok": true,
    "data": [...receipts],
    "count": 42
  }
  ```

#### 2. **Analytics Router** (`analytics.ts`)
- **File**: `server/routes/analytics.ts`
- **Base Mount**: `/api/receipts` (Line 3266 in routes.ts)
- **ORM**: Prisma (uses raw SQL queries)
- **Endpoints**:

##### `GET /api/receipts/latest?restaurantId={id}`
- **Purpose**: Get latest analytics data for restaurant
- **Database Tables**: 
  - `analytics_daily` (Prisma)
  - `daily_sales` (Prisma)
- **Query**: Raw SQL with Prisma `$queryRaw`
- **Response**:
  ```json
  {
    "analytics": {...analyticsData},
    "dailySales": {...dailySalesData},
    "shiftDate": "2025-10-15"
  }
  ```

##### `GET /api/receipts/window?restaurantId={id}&from={date}&to={date}`
- **Purpose**: Get receipt summary for time window
- **Database Tables**: 
  - `receipts` (Prisma)
  - `receipt_items` (Prisma)
  - `receipt_payments` (Prisma)
- **Query**: Complex JOIN with aggregation
- **Response**:
  ```json
  {
    "count": 150,
    "grossCents": 500000,
    "discountsCents": 5000,
    "netCents": 495000,
    "payments": {"Cash": 300000, "Card": 195000},
    "topItems": [{name: "...", qty: 50, revenueCents: 25000}, ...]
  }
  ```

#### 3. **Main Routes File** (`routes.ts`)
- **File**: `server/routes.ts`
- **Additional Endpoints**:

##### `GET /api/receipts/recent`
- **Line**: 3073
- **ORM**: Prisma
- **Purpose**: Get recent receipts (implementation details in routes.ts)

##### `GET /api/pos/receipts` (Duplicate!)
- **Line**: 324
- **ORM**: Prisma
- **Purpose**: Alternative POS receipts endpoint
- **Query**: 
  ```typescript
  prisma.posReceipt.findMany({
    where: { batchId: batchId as string },
    orderBy: { datetime: 'desc' }
  })
  ```
- **Status**: ⚠️ **DUPLICATE** of `/api/pos/receipts` in posReceipts.ts

##### `GET /api/loyverse/receipts`
- **Line**: 618
- **Purpose**: Pull receipts from Loyverse API
- **Integration**: External Loyverse API
- **Parameters**: `shiftDate`, `startDate`, `endDate`

#### 4. **Jussi Analysis Endpoints**
- `GET /api/pos/:batchId/analyze` (Line 339)
  - **Purpose**: Analyze shift from POS batch
  - **Service**: `analyzeShift(batchId)`
  
- `GET /api/analysis/shift?batchId={id}` (Line 350)
  - **Purpose**: Alternative Jussi analysis endpoint
  - **Status**: ⚠️ **DUPLICATE** of above endpoint

---

## Database Schema Details

### 1. `receipts` Table (Enhanced)
```sql
CREATE TABLE receipts (
  id SERIAL PRIMARY KEY,
  receipt_id TEXT NOT NULL UNIQUE,
  items JSONB NOT NULL,                    -- string[]
  modifiers JSONB DEFAULT '[]',            -- string[]
  total DECIMAL(10,2) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  payment_type TEXT,
  net_sales DECIMAL(10,2),
  gross_sales DECIMAL(10,2),
  discounts DECIMAL(10,2) DEFAULT 0,
  taxes DECIMAL(10,2) DEFAULT 0,
  shift_date DATE,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. `loyverse_receipts` Table (Detailed)
```sql
CREATE TABLE loyverse_receipts (
  id SERIAL PRIMARY KEY,
  receipt_id TEXT NOT NULL UNIQUE,
  receipt_number TEXT NOT NULL,
  receipt_date TIMESTAMP NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  customer_info JSONB,
  items JSONB NOT NULL,
  tax_amount DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  staff_member TEXT,
  table_number INTEGER,
  shift_date TIMESTAMP NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3. `loyverse_receipts` Table (Simplified - DUPLICATE!)
```sql
CREATE TABLE loyverse_receipts (
  shift_date DATE PRIMARY KEY,
  data JSONB
);
```
⚠️ **CRITICAL**: This is a DUPLICATE table with the same name but different structure!

### 4. `pos_receipt` Table (Active)
```sql
CREATE TABLE pos_receipt (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id VARCHAR NOT NULL REFERENCES pos_batch(id),
  receipt_id TEXT NOT NULL,
  datetime TIMESTAMP NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  items_json JSONB DEFAULT '[]',
  payment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Services & Integration

### 1. **Loyverse API Services**
- `server/services/loyverseReceipts.ts` - Loyverse receipt fetching
- `server/services/enhancedLoyverseAPI.ts` - Enhanced Loyverse integration
- `server/services/liveReceiptService.ts` - Live receipt streaming
- `server/loyverseAPI.ts` - Main Loyverse API client
- `server/loyverseAPI_old.ts` - ⚠️ Old/deprecated Loyverse API

### 2. **POS Ingestion Service**
- `server/services/pos-ingestion/loyverse.js` - POS data ingestion from Loyverse

### 3. **AI Analysis Service**
- `server/jussi/analysis.ts` - Jussi AI shift analysis
- API: `analyzeShift(batchId)` - Returns AI-generated shift report

---

## Route Registry & Navigation

### Registered Routes (RouteRegistry.ts)
```typescript
RECEIPTS: "/operations/analysis/receipts"
```

### App.tsx Routing
```tsx
<Route path="receipts" element={<Receipts />} />
<Route path={ROUTES.RECEIPTS} element={<Guard><Receipts /></Guard>} />
```

---

## Key Data Flows

### Flow 1: Manual POS Upload → Receipt Viewing
1. User uploads POS file via POS Upload page
2. System creates `posBatch` record
3. Receipts extracted and stored in `posReceipt` table
4. User navigates to POS Receipts page
5. Enters batch ID
6. `ReceiptsViewer` fetches via `GET /api/pos/receipts?batchId={id}`
7. Displays receipt table

### Flow 2: Loyverse Integration → Receipt Summary
1. Scheduled job pulls receipts from Loyverse API
2. Stores in `loyverseReceipts` or `loyverse_receipts` (duplicate!)
3. Main Receipts page fetches via `GET /api/receipts/jussi-summary/latest`
4. Displays shift summary with analytics

### Flow 3: Jussi AI Analysis
1. User requests analysis for POS batch
2. System calls `GET /api/pos/:batchId/analyze`
3. `analyzeShift()` processes receipts from batch
4. Returns AI-generated shift analysis
5. Displayed on analysis pages

---

## Redundancy Analysis & Recommendations

### 🔴 CRITICAL REDUNDANCIES

1. **Duplicate Receipt Tables**
   - `loyverseReceipts` vs `loyverse_receipts` - **MERGE REQUIRED**
   - `receipts` vs `posReceipt` - **CONSOLIDATE**

2. **Duplicate API Endpoints**
   - `/api/pos/receipts` (posReceipts.ts) vs `/api/pos/receipts` (routes.ts) - **REMOVE ONE**
   - `/api/pos/:batchId/analyze` vs `/api/analysis/shift` - **REMOVE ONE**

3. **Duplicate Services**
   - `loyverseAPI.ts` vs `loyverseAPI_old.ts` - **DELETE OLD**
   - Multiple Loyverse receipt services - **CONSOLIDATE**

4. **Unused/Archive Files**
   - `client/src/pages/ReceiptsSummary.tsx` - **VERIFY & REMOVE**
   - `client/src/archive/LoyverseLive.tsx` - **ARCHIVE CLEANUP**

### ✅ RECOMMENDED ARCHITECTURE

**Single Source of Truth:**
- **Primary Receipt Table**: `pos_receipt` (for uploaded POS data)
- **Loyverse Table**: `loyverse_receipts` (detailed structure, remove duplicate)
- **Analytics Cache**: Separate table for pre-calculated summaries

**Unified API Layer:**
- `/api/receipts/*` - All receipt endpoints under one router
- `/api/pos/*` - POS-specific operations only
- Remove duplicate endpoints in main routes.ts

**Clean Service Layer:**
- Single `loyverseService.ts` - All Loyverse operations
- Single `receiptAnalyticsService.ts` - All analytics
- Remove legacy/old files

---

## Dependencies & External Integrations

### External APIs
- **Loyverse POS API** - Receipt data sync
- **OpenAI API** - Jussi AI analysis (if applicable)

### Database
- **PostgreSQL** (Neon)
- **ORMs**: Drizzle + Prisma (dual ORM setup)

### Frontend Libraries
- React Query (`@tanstack/react-query`) - Data fetching
- Axios - HTTP requests
- shadcn/ui - UI components

---

## Environment Variables
```env
LOYVERSE_TOKEN=<token>        # Loyverse API authentication
DATABASE_URL=<postgres-url>   # PostgreSQL connection
```

---

## Summary Statistics

**Frontend Files**: 6+ pages/components
**Backend Routes**: 4+ routers/files  
**API Endpoints**: 10+ endpoints (with duplicates)
**Database Tables**: 4 receipt-related tables (2+ redundant)
**Services**: 5+ service files (2+ redundant)

**Total Redundancy Score**: ⚠️ **HIGH** - Requires architectural cleanup

---

*Last Updated: October 15, 2025*  
*Document Version: 1.0*

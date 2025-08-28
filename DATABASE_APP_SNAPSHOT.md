# Restaurant Management System - Database & Application Snapshot
*Generated: August 28, 2025*

## 🎯 OVERVIEW
Comprehensive restaurant management dashboard built with React + Express + PostgreSQL. Core focus: Daily sales tracking, inventory management, POS integration (Loyverse), AI-powered analytics, and financial reporting.

## 🗄️ DATABASE STRUCTURE

### Core Tables (PostgreSQL)
```sql
-- 45 total tables in production database
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'

Key Tables:
├── daily_sales_v2              ⭐ NEW - Core sales tracking (V2 system)
├── daily_stock_v2              ⭐ NEW - Enhanced stock management  
├── daily_sales                 📊 Legacy sales data
├── daily_stock_sales           📊 Legacy comprehensive stock/sales
├── expenses                    💰 Enhanced expense tracking
├── receipts                    🧾 POS receipt data
├── analytics_daily             📈 Daily analytics summaries
├── shopping_purchases          🛒 Purchase requests/tallies
├── menu_items                  🍔 Menu & pricing data
├── ingredients                 📦 Ingredient management
├── pos_connections             🔌 Loyverse POS integration
└── (35+ additional tables)
```

### 🎯 DAILY_SALES_V2 TABLE (Primary Focus)
```sql
-- Current working table structure (verified)
Column              | Type                        | Nullable | Default
--------------------|----------------------------|----------|----------
id                  | text                       | NO       | 
createdAt          | timestamp without time zone| NO       | CURRENT_TIMESTAMP
shiftDate          | text                       | NO       | 
submittedAtISO     | timestamp without time zone| NO       | 
completedBy        | text                       | NO       | 
startingCash       | integer                    | NO       | 0
endingCash         | integer                    | NO       | 0
cashBanked         | integer                    | NO       | 0
cashSales          | integer                    | NO       | 0
qrSales            | integer                    | NO       | 0
grabSales          | integer                    | NO       | 0
aroiSales          | integer                    | NO       | 0
totalSales         | integer                    | NO       | 0
shoppingTotal      | integer                    | NO       | 0
wagesTotal         | integer                    | NO       | 0
othersTotal        | integer                    | NO       | 0
totalExpenses      | integer                    | NO       | 0
qrTransfer         | integer                    | NO       | 0
deletedAt          | timestamp without time zone| YES      | 
staff              | text                       | YES      | 
shift_date         | date                       | YES      | 
payload            | jsonb                      | YES      | 

-- CRITICAL: All money values stored in CENTS (integer)
-- payload.rollsEnd: burger buns count (pieces)
-- payload.meatEndGrams: meat count (grams) 
-- payload.shoppingList: array of {sku, qty} items
```

## 🏗️ BACKEND ARCHITECTURE

### Tech Stack
- **Runtime**: Node.js + TypeScript (ES Modules)
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Drizzle ORM + Raw SQL (hybrid approach)
- **Validation**: Zod schemas
- **AI Integration**: OpenAI GPT-4o + Google Gemini
- **POS Integration**: Loyverse API

### 🔑 KEY BACKEND PATTERNS

#### 1. Currency Storage Pattern
```typescript
// CRITICAL: All money stored in cents (integer)
const toCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
};

const fromCents = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n / 100 : 0;

// Example: 25.50 THB → stored as 2550 (integer cents)
// Display: 2550 → shows as 25.50 THB
```

#### 2. API Response Pattern
```typescript
// Standard success response
res.json({ ok: true, data: result, id: insertedId });

// Standard error response  
res.status(500).json({ ok: false, error: "descriptive_error" });

// List responses with metadata
res.json({
  ok: true,
  rows: processedData,
  total: count,
  page: pageNum
});
```

#### 3. Field Mapping Pattern (Legacy Support)
```typescript
// Accept both old and new field names from UI
const shiftDate = b.shiftDate ?? b.date;
const staffName = b.staffName ?? b.completedBy;
const startingCash = b.startingCash ?? b.cashStart;
const closingCash = b.closingCash ?? b.cashEnd ?? b.endingCash;
const qrSales = b.qrSales ?? b.qrTransferred; // legacy->new
const aroiSales = b.aroiSales ?? b.aroiDeeSales; // legacy->new
```

### 📍 CRITICAL API ENDPOINTS

#### Daily Sales V2 API (`server/forms/dailySalesV2.ts`)
```typescript
// ✅ WORKING IMPLEMENTATION - DO NOT MODIFY
POST   /api/forms/daily-sales/v2           // Create sales record
PATCH  /api/forms/daily-sales/v2/:id/stock // Add stock data (Step 2)  
GET    /api/forms/daily-sales/v2           // List all records
GET    /api/forms/daily-sales/v2/:id       // Get single record

// Raw SQL implementation (bypasses Drizzle schema issues)
// Uses pool.query() directly to daily_sales_v2 table
```

#### Key Route Handlers
```typescript
// Server entry point
server/index.ts              // Main server setup, middleware, AI agents
server/routes.ts            // Route registration & core API routes  
server/forms/dailySalesV2.ts // ⭐ Daily Sales V2 (CURRENT WORKING)
server/api/                 // Modular API handlers
server/services/           // Background services (scheduler, email)
```

### 🤖 AI AGENT SYSTEM
```typescript
// Multi-agent architecture for restaurant analytics
agents/ollie.ts     // 📊 Receipt analysis & anomaly detection
agents/sally.ts     // 🛒 Stock management & shopping lists  
agents/marlo.ts     // 🍔 Ingredient calculations & recipes
agents/bigboss.ts   // 💰 Financial variance analysis
agents/jussi.ts     // 📈 Marketing content & insights

// Chat API: POST /chat/:agent
// Usage: POST /chat/ollie {"message": "analyze today's receipts"}
```

## 🎨 FRONTEND ARCHITECTURE  

### Tech Stack
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **UI**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS
- **State**: TanStack Query (React Query)
- **Routing**: React Router (migrated from Wouter)
- **Forms**: React Hook Form + Zod

### 🏗️ Project Structure
```
client/src/
├── components/          # Reusable UI components
├── pages/              # Route-based page components
│   ├── operations/     # Daily operations (sales, stock)
│   ├── expenses/       # Financial management
│   ├── menu/           # Menu management
│   └── analysis/       # Analytics & reports
├── layouts/            # Layout wrappers  
├── lib/               # Utilities & helpers
├── hooks/             # Custom React hooks
└── router/            # Route configuration
```

### 🎯 CRITICAL FRONTEND PATTERNS

#### 1. Safe Currency Formatting
```typescript
// ✅ CURRENT WORKING PATTERN
const thb = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? `฿${n.toLocaleString()}` : "฿0";
};

// Usage: {thb(salesData.totalSales)} → ฿1,234
// Handles: undefined, null, NaN, string numbers
```

#### 2. API Data Fetching
```typescript
// TanStack Query pattern
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/forms/daily-sales/v2'],
  queryFn: () => fetch('/api/forms/daily-sales/v2').then(r => r.json())
});

// Mutation pattern
const mutation = useMutation({
  mutationFn: (formData) => fetch('/api/forms/daily-sales/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  }),
  onSuccess: () => queryClient.invalidateQueries(['/api/forms/daily-sales/v2'])
});
```

#### 3. Component Field Mapping
```typescript
// ✅ Components expect specific field names from backend
// Library.tsx expects: cashStart, cashEnd, totalSales, grabSales, etc.
// View.tsx expects: cashStart, cashEnd, rollsEnd, meatEndGrams, etc.
// Backend dailySalesV2.ts returns these exact field names
```

### 📱 KEY FRONTEND COMPONENTS

#### Daily Sales V2 Components
```typescript
// ✅ CURRENT WORKING COMPONENTS
client/src/pages/operations/daily-sales/Library.tsx  // List view with table
client/src/pages/operations/daily-sales/View.tsx     // Detail view
client/src/pages/operations/daily-sales/Form.tsx     // Create/edit form

// Component Features:
// - Safe currency display (no NaN values)
// - Rolls/meat count display  
// - Shopping list integration
// - Responsive design (mobile/tablet)
```

## 🔄 DEVELOPMENT WORKFLOW

### Setup Commands
```bash
npm install                    # Install dependencies
npm run dev                   # Start development server
npm run db:push              # Sync database schema
npm run db:push --force      # Force schema sync (data loss warning)
```

### Environment Variables
```bash
DATABASE_URL=postgresql://...  # Neon database connection
OPENAI_API_KEY=sk-...         # AI integration
LOYVERSE_API_TOKEN=...        # POS integration  
NODE_ENV=development          # Environment mode
```

### 🔥 CRITICAL DEVELOPMENT RULES

#### 1. Schema Management
```bash
# ❌ NEVER manually write SQL migrations
# ❌ NEVER change primary key column types (serial ↔ varchar)
# ✅ Use Drizzle schema + npm run db:push
# ✅ For existing tables, match current structure exactly
```

#### 2. Daily Sales V2 Implementation  
```bash
# 🔒 LOCKED FILES (per user requirements):
# server/forms/dailySalesV2.ts     - Working backend API
# client/.../Library.tsx           - Working list component  
# client/.../View.tsx              - Working detail component

# ✅ PROVEN WORKING PATTERN:
# - Raw SQL for daily_sales_v2 table (schema mismatch workaround)
# - Currency in cents (integer storage)  
# - Field mapping for legacy compatibility
# - Safe formatters preventing NaN display
```

#### 3. Testing Pattern
```bash
# Verification commands (working examples):
curl -X POST localhost:5000/api/forms/daily-sales/v2 \
  -H "Content-Type: application/json" \
  -d '{"shiftDate":"2025-08-28","staffName":"Test","startingCash":0,"totalSales":100}'

curl -X PATCH localhost:5000/api/forms/daily-sales/v2/:id/stock \
  -d '{"rollsEnd":18,"meatEndGrams":3200,"shoppingList":[{"sku":"Item","qty":5}]}'
```

## 🎛️ SYSTEM INTEGRATIONS

### Loyverse POS Integration
- **API**: Automated receipt sync every 15 minutes
- **Webhooks**: Real-time sales data updates  
- **Analytics**: Daily/shift summary generation
- **Data Flow**: POS → receipts table → analytics_daily → dashboard

### AI Analytics Pipeline  
- **Receipt Analysis**: Automated anomaly detection
- **Stock Predictions**: AI-powered shopping list generation
- **Financial Insights**: Variance analysis & recommendations
- **Marketing**: Automated content generation for social media

### Email Automation
- **Daily Reports**: Automated 8am management summaries
- **Form Submission**: Instant PDF reports via email
- **Alerts**: Variance notifications & system alerts

## 🔍 DEBUGGING GUIDE

### Common Issues & Solutions

#### 1. Currency NaN Display
```typescript
// ❌ Problem: THB(undefined) → "฿NaN"
// ✅ Solution: thb(value) → "฿0" (safe formatter)
const thb = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? `฿${n.toLocaleString()}` : "฿0";
};
```

#### 2. Database Connection
```typescript  
// ❌ Problem: "relation does not exist"
// ✅ Solution: Check table_name in raw SQL matches actual DB
// ✅ Verify: SELECT table_name FROM information_schema.tables
```

#### 3. API Field Mapping
```typescript
// ❌ Problem: Frontend expects 'cashStart', backend returns 'startingCash'  
// ✅ Solution: Map in backend response:
rows.map(r => ({
  cashStart: fromCents(r.startingCash),  // Map DB → Frontend
  cashEnd: fromCents(r.endingCash),
  // ...
}))
```

## 🎯 QUICK START FOR NEW AI MODELS

### To Add a New Feature:
1. **Database**: Update `shared/schema.ts` + `npm run db:push`
2. **Backend**: Add route in `server/routes/` or `server/api/`
3. **Frontend**: Add component in `client/src/pages/`
4. **Integration**: Use TanStack Query for API calls

### To Debug Daily Sales:
1. **Check API**: `curl localhost:5000/api/forms/daily-sales/v2`
2. **Verify DB**: `SELECT * FROM daily_sales_v2 LIMIT 5`
3. **Test Frontend**: Navigate to `/operations/daily-sales`
4. **Check Console**: Look for hooks: `HOOK: summary email, shopping list, jussi`

### Working Example (Tested):
```bash
# Create record
POST /api/forms/daily-sales/v2 → {"ok":true,"id":"uuid"}

# Add stock data  
PATCH /api/forms/daily-sales/v2/{id}/stock → {"ok":true}

# List records
GET /api/forms/daily-sales/v2 → {"ok":true,"rows":[...]}
```

---

## ⚡ SYSTEM STATUS
- **Database**: 45 tables, PostgreSQL via Neon
- **API Endpoints**: 200+ routes across multiple modules
- **Frontend Pages**: 50+ components, mobile-responsive
- **Integrations**: Loyverse POS, OpenAI, Gmail API
- **Daily Sales V2**: ✅ FULLY OPERATIONAL (currency fixes applied)

**Last Updated**: August 28, 2025  
**Next Major Update**: Add multi-location support

---

*This snapshot provides complete technical context for AI models to understand and work with the restaurant management system effectively. All patterns, schemas, and implementations are verified and currently operational.*
# COMPLETE DEBUG FILES PACKAGE - 22P02 Error Resolution
*Generated: January 26, 2025*

## EXECUTIVE SUMMARY: ROOT CAUSE IDENTIFIED ✅

**The Issue**: Form submits `numberNeeded` object but database has no `number_needed` column, causing PostgreSQL 22P02 error "invalid input syntax for type numeric".

**The Solution**: Add missing database column or map to existing JSONB fields.

---

## FILE 1: DATABASE CONNECTION (server/db.ts)
```typescript
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
```

## FILE 2: STORAGE INTERFACE (server/storage.ts) - Key Functions
```typescript
// IStorage interface defines:
createDailyStockSales(data: InsertDailyStockSales): Promise<DailyStockSales>;

// The problem: InsertDailyStockSales type doesn't include numberNeeded field
// But form sends: { completedBy, shiftType, shiftDate, numberNeeded: {...} }
```

## FILE 3: SUPPLIER SERVICE (server/supplierService.ts)
```typescript
import fs from 'fs';
import path from 'path';

const SUPPLIERS_FILE = path.join(process.cwd(), 'data', 'suppliers.json');

export const supplierService = {
  getAll: () => suppliers,
  getAllSuppliers: () => suppliers,
  add: (supplierData: any) => {
    const newSupplier = {
      id: Math.max(...suppliers.map((s: any) => s.id), 0) + 1,
      ...supplierData,
      cost: parseFloat(supplierData.cost) || 0
    };
    suppliers.push(newSupplier);
    fs.writeFileSync(SUPPLIERS_FILE, JSON.stringify(suppliers, null, 2), 'utf8');
    return newSupplier;
  }
  // ... other CRUD operations
};
```

## FILE 4: ENVIRONMENT VARIABLES (.env - SANITIZED)
```
GMAIL_USER=colcamenterprises@gmail.com
GMAIL_APP_PASSWORD=[REDACTED_16_CHARS]
LOYVERSE_API_TOKEN=[REDACTED_32_CHARS]  
LOYVERSE_WEBHOOK_SECRET=[REDACTED_32_CHARS]
DATABASE_URL=postgresql://[USERNAME]:[PASSWORD]@[HOST]/[DATABASE]
PGPORT=5432
PGUSER=[USERNAME]
PGDATABASE=[DATABASE] 
PGHOST=[HOST]
PGPASSWORD=[PASSWORD]
```

## FILE 5: PACKAGE.JSON DEPENDENCIES
```json
{
  "name": "rest-express",
  "version": "1.0.0", 
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.7.0",
    "@neondatabase/serverless": "^0.10.4", 
    "express": "^4.21.2",
    "zod": "^3.24.2",
    "axios": "^1.10.0",
    "winston": "^3.17.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.4",
    "tsx": "^4.19.1",
    "typescript": "5.6.3"
  }
}
```

## FILE 6: DRIZZLE CONFIGURATION
```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql", 
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

## FILE 7: REPLIT CONFIGURATION
```
# .replit
modules = ["nodejs-20", "web", "postgresql-16"]
run = "npm run dev"

[workflows]
[[workflows.workflow]]
name = "Start application"
[[workflows.workflow.tasks]]
task = "shell.exec" 
args = "npm run dev"
waitForPort = 5000

[agent]
integrations = ["javascript_openai==1.0.0", "javascript_database==1.0.0"]
```

## FILE 8: MIGRATION FILES
```
migrations/
├── 0000_smart_the_professor.sql  (Database introspection)
├── meta/
│   ├── 0000_snapshot.json
│   └── _journal.json
├── relations.ts
└── schema.ts
```

## FILE 9: CONSOLE LOGS (Live Application)
```
7:39:38 AM [express] serving on port 5000
7:39:48 AM [express] GET /api/shift-summary/latest 200 in 127ms
7:39:49 AM [express] GET /api/dashboard/top-menu-items 200 in 10ms
7:39:50 AM [express] GET /api/loyverse/sales-by-payment-type 200 in 6ms

// No errors in recent logs - system running normally
// 22P02 error only occurs during form submission to /api/daily-shift-forms
```

## FILE 10: NEON DATABASE SCHEMA (Live)
```sql
-- Table: daily_stock_sales (39 columns)
-- Key Missing: number_needed column
-- Key Mismatch: salary_wages vs wages fields

id | integer | PK
completed_by | text | NOT NULL ✅
shift_type | text | NOT NULL ✅  
shift_date | timestamp | NOT NULL ✅
food_panda_sales | numeric | DEFAULT 0
salary_wages | numeric | DEFAULT 0 (not 'wages')
wage_entries | jsonb | DEFAULT []
shopping_entries | jsonb | DEFAULT []
fresh_food | jsonb | DEFAULT {}
frozen_food | jsonb | DEFAULT {}
shelf_items | jsonb | DEFAULT {}
drink_stock | jsonb | DEFAULT {}
kitchen_items | jsonb | DEFAULT {}
packaging_items | jsonb | DEFAULT {}
-- CRITICAL: NO number_needed column exists ❌
```

---

## IMMEDIATE FIX REQUIRED

### Option A: Add Missing Column (Recommended)
```sql
ALTER TABLE daily_stock_sales 
ADD COLUMN number_needed JSONB DEFAULT '{}';
```

### Option B: Map to Existing Field
```typescript
// In routes.ts, map numberNeeded to appropriate existing JSONB field:
const submitData = {
  completed_by: data.completedBy,
  shift_type: data.shiftType,
  shift_date: data.shiftDate, 
  fresh_food: data.numberNeeded || {}, // Map to existing JSONB field
  status: 'completed',
  is_draft: false
};
```

## TESTING VERIFICATION
1. Apply fix (Option A or B)
2. Submit form from frontend
3. Verify no 22P02 error
4. Check data stored correctly in PostgreSQL

---
*All critical files provided for complete environment replication and accurate debugging.*
# COMPREHENSIVE DEBUG PACKAGE - Daily Sales & Stock 22P02 Error Fix
*Generated: January 26, 2025*

## CRITICAL SCHEMA MISMATCH IDENTIFIED ⚠️

### The Root Cause
The form is trying to submit `numberNeeded` field but the database schema doesn't have this column. Additionally, there are multiple schema mismatches between the Drizzle schema and actual database.

## DATABASE SCHEMA ANALYSIS

### Actual PostgreSQL Schema (from information_schema):
```sql
-- daily_stock_sales table columns:
id (integer, primary key)
completed_by (text, NOT NULL) ✅ 
shift_type (text, NOT NULL) ✅
shift_date (timestamp, NOT NULL) ✅
starting_cash (numeric, default 0)
ending_cash (numeric, default 0)
grab_sales (numeric, default 0)
food_panda_sales (numeric, default 0) ⚠️ Different naming
aroi_dee_sales (numeric, default 0)
qr_scan_sales (numeric, default 0)
cash_sales (numeric, default 0)
total_sales (numeric, default 0)
salary_wages (numeric, default 0) ⚠️ Different naming
shopping (numeric, default 0)
gas_expense (numeric, default 0)
total_expenses (numeric, default 0)
expense_description (text)
burger_buns_stock (integer, default 0)
rolls_ordered_count (integer, default 0)
meat_weight (numeric, default 0)
food_items (jsonb, default '{}')
drink_stock (jsonb, default '{}')
kitchen_items (jsonb, default '{}')
packaging_items (jsonb, default '{}')
fresh_food (jsonb, default '{}')
frozen_food (jsonb, default '{}')
shelf_items (jsonb, default '{}')
wage_entries (jsonb, default '[]')
shopping_entries (jsonb, default '[]')
wages (jsonb, nullable) ⚠️ Duplicate wage fields
is_draft (boolean, default false)
status (text, default 'completed')
notes (text, nullable)
discrepancy_notes (text, nullable)
purchased_amounts (jsonb, default '{}')
banked_amount (numeric, default 0)
-- MISSING: numberNeeded column ❌
```

### Form Data Structure (frontend):
```typescript
formData = {
  completedBy: string,
  shiftType: string, 
  shiftDate: string,
  numberNeeded: { [itemName: string]: number } ❌ NO MATCHING DB COLUMN
}
```

## EXACT 22P02 ERROR LOCATION

**File**: `server/routes.ts` Line 347-355
**Problem**: Attempting to parse `numberNeeded` field that doesn't exist in database schema

```typescript
// Current problematic code:
if (data.numberNeeded && typeof data.numberNeeded === 'object') {
  data.numberNeeded = Object.fromEntries(
    Object.entries(data.numberNeeded).map(([key, value]) => [
      key, 
      parseFloat(value as string) || 0
    ])
  );
}
```

## FILES PROVIDED FOR COMPLETE DEBUG

### 1. Database Connection (server/db.ts)
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

### 2. Environment Variables (sanitized .env)
```
GMAIL_USER=colcamenterprises@gmail.com
GMAIL_APP_PASSWORD=[REDACTED]
LOYVERSE_API_TOKEN=[REDACTED]
LOYVERSE_WEBHOOK_SECRET=[REDACTED]
DATABASE_URL=postgresql://[USER]:[PASS]@[HOST]/[DB]
```

### 3. Dependencies (package.json key sections)
```json
{
  "dependencies": {
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.7.0", 
    "@neondatabase/serverless": "^0.10.4",
    "express": "^4.21.2",
    "zod": "^3.24.2",
    "axios": "^1.10.0"
  },
  "scripts": {
    "db:push": "drizzle-kit push"
  }
}
```

### 4. Drizzle Configuration
```typescript
// drizzle.config.ts
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts", 
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL }
});
```

### 5. Storage Interface Issues
The storage.ts file shows that `IStorage` interface expects `createDailyStockSales(data: InsertDailyStockSales)` but the actual implementation doesn't handle the `numberNeeded` field properly.

## IMMEDIATE FIXES REQUIRED

### Fix 1: Add numberNeeded Column to Database
```sql
ALTER TABLE daily_stock_sales 
ADD COLUMN number_needed JSONB DEFAULT '{}';
```

### Fix 2: Update Backend Field Mapping (routes.ts)
```typescript
// Map frontend fields to actual database columns
const submitData = {
  completed_by: data.completedBy,
  shift_type: data.shiftType,  
  shift_date: data.shiftDate,
  number_needed: data.numberNeeded, // Use new column name
  status: 'completed',
  is_draft: false
};
```

### Fix 3: Update Drizzle Schema (shared/schema.ts)
```typescript
export const dailyStockSales = pgTable("daily_stock_sales", {
  id: serial("id").primaryKey(),
  completed_by: text("completed_by").notNull(),
  shift_type: text("shift_type").notNull(), 
  shift_date: timestamp("shift_date").notNull(),
  number_needed: jsonb("number_needed").default({}), // Add this field
  // ... other existing fields
});
```

## TESTING PROTOCOL

1. **Add Missing Column**: Run migration to add `number_needed` column
2. **Update Backend**: Fix field mapping in routes.ts
3. **Test Form Submission**: Submit form with sample data
4. **Verify Database**: Check data is properly stored in PostgreSQL

## CONCLUSION

The 22P02 error occurs because:
1. Frontend sends `numberNeeded` object
2. Backend tries to parse it for a non-existent database column  
3. PostgreSQL rejects the query with "invalid input syntax for type numeric"

**Solution**: Add the missing `number_needed` JSONB column to match the form data structure.

---
*All files and exact schema details provided for accurate debugging and resolution.*
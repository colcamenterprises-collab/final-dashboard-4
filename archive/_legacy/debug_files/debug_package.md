# Database Error Debug Package

## Problem Summary
PostgreSQL Error 22P02: "invalid input syntax for type numeric" occurs during form submission because there's a mismatch between:
1. The Drizzle schema definition in `shared/schema.ts`
2. The actual database table structure
3. The data being sent from the frontend

## Key Issue Found
The database schema (actual table) has different column names than what's defined in the Drizzle schema:

### Database Actual Columns:
- `food_panda_sales` (numeric)
- `salary_wages` (numeric) 
- `shopping` (numeric)
- `wage_entries` (jsonb)
- `shopping_entries` (jsonb)

### Drizzle Schema Defines:
- `aroiDeeSales` (aroi_dee_sales)
- `wages` (jsonb)
- `shopping` (jsonb)

## Database Connection
```
DATABASE_URL=postgresql://[username]:[password]@[host]/[database]
PGPORT=5432
PGUSER=[user]
PGDATABASE=[database]
PGHOST=[host]
PGPASSWORD=[password]
```

## Current Database Schema
```sql
-- Key problematic columns in daily_stock_sales:
food_panda_sales numeric DEFAULT '0'::numeric,
salary_wages numeric DEFAULT '0'::numeric, 
shopping numeric DEFAULT '0'::numeric,
wage_entries jsonb DEFAULT '[]'::jsonb,
shopping_entries jsonb DEFAULT '[]'::jsonb,
aroi_dee_sales numeric DEFAULT '0'::numeric,
wages jsonb,
```

## Fix Required
Either:
1. Update the database schema to match the Drizzle definitions
2. Update the backend mapping to use correct field names that match the actual database
3. Run a migration to align schema with code

## Files Included
- server/routes.ts (API endpoints)
- shared/schema.ts (Drizzle schema - mismatched)
- client/src/pages/DailyShiftForm.tsx (frontend form)
- Database schema output (actual structure)
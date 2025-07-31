# Replit Project Access Information

## Replit Project Link
**Public URL**: https://replit.com/@cameronbass/Restaurant-Management-Dashboard

## Project Structure
- **Language**: Node.js/TypeScript full-stack
- **Database**: PostgreSQL (Neon)
- **Frontend**: React + Vite + shadcn/ui
- **Backend**: Express.js + Drizzle ORM

## Database Connection Details
The project uses environment variables for database connection:
- DATABASE_URL (provided via Replit environment)
- PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE (auto-set)

## Error Context
- Error: PostgreSQL 22P02 "invalid input syntax for type numeric"
- Location: Daily Shift Form submission endpoint `/api/daily-shift-forms`
- Root Cause: Schema mismatch between Drizzle definitions and actual database structure

## Critical Files to Review
1. `server/routes.ts` - API endpoint with submission logic
2. `shared/schema.ts` - Drizzle schema definitions (mismatched)
3. `client/src/pages/DailyShiftForm.tsx` - Frontend form
4. Database actual schema (see SQL output in previous messages)

## Issue Summary
The Drizzle schema defines fields like `aroiDeeSales` but the actual database has `aroi_dee_sales`, `food_panda_sales`, `wage_entries`, `shopping_entries`, etc. The backend needs to map frontend camelCase to database snake_case.
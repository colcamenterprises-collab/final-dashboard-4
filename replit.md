# Restaurant Management Dashboard + Public Website

## Overview
This project is a comprehensive restaurant management dashboard designed to streamline operations, enhance efficiency, and boost profitability. It includes a public-facing website layer and leverages AI-powered analytics and real-time insights by integrating with external POS systems and AI services. The platform provides automated sales analysis, inventory management, and marketing tools, aiming to be a centralized, data-driven solution for restaurant decision-making.

## User Preferences
Preferred communication style: Simple, everyday language.
Tablet-first design rule (MANDATORY): Every new page must be designed and built tablet-first (768px primary). Default Tailwind classes (no prefix) must look correct on a tablet. Use `sm:` and `md:` to adapt for mobile and desktop. Mobile and desktop are secondary concerns. Grid columns: default for tablet (e.g. `grid-cols-3 md:grid-cols-5 lg:grid-cols-7`), not mobile-first (do not default to 1 col and scale up).
Code isolation policy: Once functionality is working and tested, isolate it to prevent breaking when updating other sections.
Testing requirement: Always test changes in isolation before making additional modifications.
Documentation requirement: When creating comprehensive project documentation, include all operational details someone would need to rebuild the system from scratch.
Agent execution policy: CRITICAL - Execute ONLY exact commands provided. NEVER add, remove, or modify features unless explicitly approved with 'Yes, implement [specific change]'. NEVER run database migrations, schema changes, or destructive operations unless specifically instructed. If unsure, ask for clarification. This policy is absolute and non-negotiable.
MANDATORY FULL WORKFLOW TESTING: All changes, enhancements, and modifications MUST be tested through the complete frontend-to-backend workflow before being presented as fixed or solved. No claiming solutions work without conducting actual end-to-end testing. No shortcuts, no assumptions - verify the entire user flow works correctly before marking tasks complete.
Date Format Standard (Gradual Migration): App standard is DD/MM/YYYY for all displayed dates. Use utilities from `client/src/lib/format.ts`: `formatDateDDMMYYYY()` for dates, `formatDateTimeDDMMYYYY()` for datetime. HTML `<input type="date">` uses browser format but display converted DD/MM/YYYY alongside. New pages must use DD/MM/YYYY format; legacy pages will be migrated gradually.
Testing requirement: All enhancements must at all times be tested prior to advising a job as completed. Testing includes UI, system files, front end, mobile and tablet responsiveness. All tests must be completed prior to release.
Data integrity policy: NEVER use fake, mock, placeholder, or synthetic data. Always use authentic data from the database or authorized sources. Creating fake data for testing or demonstrations is strictly prohibited.
Email automation requirement: Every completed daily shift form must automatically send email to management with PDF attachment.

## System Architecture
### Frontend Architecture
- **Frameworks**: React 18 with TypeScript (Vite), shadcn/ui (Radix UI), Tailwind CSS.
- **State Management**: TanStack Query (React Query).
- **Routing**: React Router.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Tablet-first design, 12px font sizes, 4px border radius, touch-optimized, dark theme, expanded sidebar, consolidated tabbed navigation. Golden standard styling reference: `/finance/expenses-import`.

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript, ES modules).
- **API Design**: RESTful, type-safe endpoints.
- **Database**: PostgreSQL with Drizzle ORM (primary) and Prisma ORM (specific interactions).
- **Session Management**: PostgreSQL-based sessions (connect-pg-simple).
- **Shift Logic**: 5 PM to 3 AM Bangkok timezone shift window.

### Feature Specifications
- **Core Operations**: Daily Shift Form (sales, expenses, cash, inventory), Recipe Management, Inventory Management, Comprehensive Daily Forms System.
- **AI-Powered Features**: Multi-agent system for receipt analysis, anomaly detection, ingredient calculation, stock recommendations, financial variance analysis, marketing content generation.
- **Bob Orchestrator System**: Manages AI processes, onboarding context via `GET /api/ai-ops/bob/onboarding-context`. `BOB_WRITE_ALLOWLIST` restricts write access to specific analysis and email trigger endpoints.
- **Self-Healing Analysis Build**: `server/services/analysisBuildOrchestrator.ts` ensures daily usage data is built, checks last 3 BKK dates on server start, and tracks build lifecycle in `analysis_build_status`. Build failures are logged to `issue_register`.
- **Analysis Adjustments System**: `analysis_adjustments` table stores AI-generated amendments with UI for manager review.
- **Canonical Agent Read Surface (`/api/agent/read`)**: Governed, shift-window-aware read endpoints for agents with shared auth middleware and structured responses including `blockers`, `warnings`, `status`.
- **Bob Canonical Read Layer (`/api/ai-ops/bob`)**: Provides shift window details and canonical shift snapshots from all sources. Includes a strict allowlist proxy.
- **Work Register (ai_tasks)**: Enhanced task management with areas, priorities, assignees, and API for archiving/restoring.
- **Monitoring Engine**: `server/services/monitorEngine.ts` performs daily checks and logs events to `monitor_events`.
- **Staff Access System**: Owner-only access with Staff Directory and Role Permissions matrix. Login uses email and PIN.
- **Analytics & Reporting**: Sales Heatmap, Email Notifications, Data-Driven Dashboard, F&B Analysis, Stock Reconciliation & Security.
- **Management Tools**: Manager Checklist System (locked schema and API), Source-Based Expense Management, Banking Reconciliation, Online Ordering, Membership, Rolls & Meat Ledger.
- **Shift Financial Control**: `GET /api/analysis/financial-control?date=YYYY-MM-DD` returns 5-section financial snapshot: receipt count check (staff vs POS per channel), register cash position (POS-sourced expected vs staff closing), banking position (cash + QR), pay-in/pay-out control, and Loyverse sales summary. Frontend `FinancialControlCards.tsx` rendered above Drinks in Analysis V2. Uses `pos_shift_report` (primary) and `lv_receipt` aggregation (fallback). Staff-entered sales totals are NOT used — POS is the truth source.
- **Theft-Control Issue Register**: `issue_register` table with CRUD API and auto-detection logic for discrepancies.
- **Security & Accountability Layer (SA-1)**: Refund logging, manager shift sign-off, stock baseline seeding, stock snapshots, and variance engine.
- **Canonical Data Architecture**: Centralized `purchasing_items` for purchasing, canonical `recipe` and `recipe_ingredient` for recipes, decoupled `ingredient_authority` for ingredients, and `stock_received_log` for unified stock logging.
- **Staff Operations Module (Phase 2)**: Comprehensive multi-business/multi-location staff management with 14 new database tables, 8 enums, 40+ API endpoints, and 7 UI pages for managing staff, rosters, cleaning tasks, and attendance. Fully configurable with `businessLocationId` defaulting to 1.
- **Shift Task System**: `cleaningTaskTemplates` extended with `timing` (start_shift|during_shift|end_shift), `role` (manager|cashier|kitchen|all), and `required` (boolean) columns. 57 default tasks seeded across 3 timing groups (19 start/12 during/26 end). `DailyCleaningTasks.tsx` groups tasks by timing with colour-coded section headers. `StaffOpsSettings.tsx` Daily Cleaning tab manages templates with timing/role/required fields and "Seed Default Tasks" button. Duplicate prevention: `generateCleaningTasksForRoster` deletes existing tasks before regenerating. Seed endpoint: `POST /api/operations/staff/cleaning/templates/seed` (idempotent).
- **Fort Knox Locked Systems**: Daily Sales & Stock form, Manager Checklist System, and core file structure (daily_sales_form_locked.html, daily_sales_schema.py, daily_sales_validation.py, server/data/foodCostings.ts) are locked and require explicit approval for modifications.

## External Dependencies
- **AI Services**: OpenAI API (GPT-4o), Google Gemini.
- **POS Integration**: Loyverse POS.
- **Database Services**: Neon Database (Serverless PostgreSQL).
- **Email Service**: Gmail API.
- **PDF Generation**: jsPDF.
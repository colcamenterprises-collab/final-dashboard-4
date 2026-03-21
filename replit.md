# Restaurant Management Dashboard

## Overview
This project is a comprehensive restaurant management dashboard designed to streamline operations, enhance efficiency, and boost profitability through AI-powered analytics and real-time insights. It integrates with external POS systems and AI services to provide automated sales analysis, inventory management, and marketing tools. The core vision is to offer a centralized, data-driven platform for restaurant decision-making.

## User Preferences
Preferred communication style: Simple, everyday language.
Code isolation policy: Once functionality is working and tested, isolate it to prevent breaking when updating other sections.
Testing requirement: Always test changes in isolation before making additional modifications.
Documentation requirement: When creating comprehensive project documentation, include all operational details someone would need to rebuild the system from scratch.
Agent execution policy: CRITICAL - Execute ONLY exact commands provided. NEVER add, remove, or modify features unless explicitly approved with 'Yes, implement [specific change]'. NEVER run database migrations, schema changes, or destructive operations unless specifically instructed. If unsure, ask for clarification. This policy is absolute and non-negotiable.
**MANDATORY FULL WORKFLOW TESTING**: All changes, enhancements, and modifications MUST be tested through the complete frontend-to-backend workflow before being presented as fixed or solved. No claiming solutions work without conducting actual end-to-end testing. No shortcuts, no assumptions - verify the entire user flow works correctly before marking tasks complete.
**Date Format Standard (Gradual Migration)**: App standard is DD/MM/YYYY for all displayed dates. Use utilities from `client/src/lib/format.ts`: `formatDateDDMMYYYY()` for dates, `formatDateTimeDDMMYYYY()` for datetime. HTML `<input type="date">` uses browser format but display converted DD/MM/YYYY alongside. New pages must use DD/MM/YYYY format; legacy pages will be migrated gradually.
Testing requirement: All enhancements must at all times be tested prior to advising a job as completed. Testing includes UI, system files, front end, mobile and tablet responsiveness. All tests must be completed prior to release.
Data integrity policy: NEVER use fake, mock, placeholder, or synthetic data. Always use authentic data from the database or authorized sources. Creating fake data for testing or demonstrations is strictly prohibited.
Email automation requirement: Every completed daily shift form must automatically send email to management with PDF attachment.
Fort Knox Locked Form System: Daily Sales & Stock form structure is LOCKED under Cam's direct approval. Form contains exact 13-section ordering, includes approved Other Sales field (renamed from Aroi Dee Sales), implements Burger Buns & Meat Count under Cash Management, and uses snake_case field names matching Pydantic schema. NO modifications allowed without explicit Cam approval. Located at /daily-stock-sales with clean minimal UI, Poppins font, and proper email integration to smashbrothersburgersth@gmail.com.
Fort Knox File Structure: Core locked files include daily_sales_form_locked.html (frontend UI), daily_sales_schema.py (Pydantic validation), daily_sales_validation.py (runtime validation), and server/data/foodCostings.ts (TypeScript source of truth for all menu and stock items, replacing CSV). TypeScript file must be referenced for Menu Management and Ingredients List. No field modifications, renaming, or reordering allowed without Cam approval. All system emails locked to smashbrothersburgersth@gmail.com.
Manager Checklist System (Fort Knox Locked): Golden database schema and API endpoints locked under Cam approval. No modifications allowed without explicit authorization.
  - cleaning_tasks table: (id SERIAL PRIMARY KEY, zone TEXT NOT NULL, taskName TEXT NOT NULL, taskDetail TEXT, shiftPhase TEXT NOT NULL, active BOOLEAN DEFAULT TRUE)
  - manager_checklists table: (id SERIAL PRIMARY KEY, shiftId TEXT NOT NULL, managerName TEXT NOT NULL, tasksAssigned JSONB NOT NULL, tasksCompleted JSONB NOT NULL, signedAt TIMESTAMP DEFAULT NOW())
  - API endpoints: /api/checklists/random, /api/checklists/complete, /api/checklists/history (server-side validation enforced)
  - Frontend: ManagerChecklistModal.tsx locked - enforces completion before shift closure
Layout Protection: Clean app shell architecture (App.tsx + Sidebar.tsx) with automated prebuild validation preventing margin-left hacks. Layout uses proper flex-1 min-w-0 structure with 256px → 78px collapsible sidebar.
Accordion Navigation: Advanced grouped sidebar with collapsible sections (Dashboard, Operations, Finance, Menu Management, Marketing) featuring emerald pill active states, monochrome SVG icons, and smooth expand/collapse animations with chevron indicators.

## System Architecture
### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite.
- **UI Framework**: shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with custom restaurant-specific design tokens.
- **State Management**: TanStack Query (React Query) for server state.
- **Routing**: React Router for modern navigation.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Tablet-first design, 12px font sizes, 4px border radius, touch-optimized interactions, consistent button styling, responsive design, dark theme, expanded sidebar default, consolidated navigation with tabbed interfaces.
- **BANNED COLORS**: Light blue backgrounds (bg-blue-50, bg-slate-50 for backgrounds, bg-gray-50 for backgrounds) are STRICTLY FORBIDDEN. Use bg-white for all card and section backgrounds. This is a permanent rule - never use pale/light blue tinted backgrounds.
- **Style Guide (Golden Standard)**: Reference `/finance/expenses-import` for canonical styling: Typography (`text-xs`, `text-sm`, `text-3xl`), Colors (`text-emerald-600`, `text-slate-600`, `slate-50/100`, `border-slate-200`), Border Radius (`rounded-[4px]`), Spacing (`p-4`, `gap-3`, `space-y-4`), Components (shadcn/ui Card, Button, Input, Table, Badge, Tabs), Table styles, Button styles, Status Indicators.

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful API with centralized route handling and type-safe endpoints.
- **Database**: PostgreSQL with Drizzle ORM (primary) and Prisma ORM (specific dual-form interactions).
- **Session Management**: PostgreSQL-based sessions with connect-pg-simple.
- **Shift Logic**: Handles 5 PM to 3 AM Bangkok timezone shift window.

### Feature Specifications
- **Core Operations**: Daily Shift Form (sales, expenses, cash, inventory), Recipe Management (costing, PDF), Inventory Management (tracking, shopping list), Comprehensive Daily Forms System (dual-form with draft/submit).
- **AI-Powered Features**: Multi-agent system for receipt analysis, anomaly detection, ingredient calculation, stock recommendations, financial variance analysis, and marketing content generation.
- **Bob Orchestrator System**: CEO Charter stored in `bob_documents` table, prepended to every outbound message. Process Registry (`process_registry` table, 9 seeded entries) gives Bob a living map of all app workflows. System Map UI at `/operations/ai-ops-control` (collapsible section). Onboarding context endpoint at `GET /api/ai-ops/bob/onboarding-context`. Bob is governed to OBSERVE shopping list — never duplicate it.
- **Bob Write Boundary (enforced in code)**: `BOB_WRITE_ALLOWLIST` in `aiOpsControl.ts` restricts Bob-token write access to `/bob/analysis`, `/bob/adjustments`, `/bob/email/trigger`, `/bob/run-analysis` only. Any write attempt outside this list returns 403. Source-of-truth tables (`daily_sales_v2`, `daily_stock_v2`, `expenses_v2`, `receipt_truth_line`, `lv_receipt` etc.) are never reachable via Bob write routes.
- **Analysis Adjustments System**: `analysis_adjustments` table stores Bob's analysis-layer amendments (uuid PK, FK to `analysis_reports`, source_table/field, original/adjusted values, reason, review_status). API: `POST /api/ai-ops/bob/adjustments` (token-gated), `GET /api/ai-ops/bob/adjustments/:date`, `PATCH /api/ai-ops/bob/adjustments/:id/review`. UI: adjustments panel in `SalesShiftAnalysis.tsx` with approve/reject/reset manager actions.
- **Bob Email Trigger**: `POST /api/ai-ops/bob/email/trigger` composes and sends a full HTML analysis report (issues, adjustments, POS/form data) via `workingEmailService` to `smashbrothersburgersth@gmail.com`. Logs `email_sent` metadata back into `analysis_reports.data_json`. Delivery status shown in the Analysis page.
- **Bob CSV Export**: `GET /api/ai-ops/bob/analysis-csv/:date` streams a CSV file of Bob's analysis data for any shift date. Includes report metadata, POS/form figures, issues, and all adjustments. Downloadable from the Analysis page header.
- **Work Register (ai_tasks)**: Upgraded from simple task list to a full Work Register. `ai_tasks` now has `area` (operations/finance/purchasing/marketing/dev/compliance) and `deleted_at` (soft archive) columns. Priority expanded to include `critical`. Status expanded to include `archived`, `completed`, `in_review`. Assignees expanded to include `cam` and `staff`. API: archive (`POST /api/ai-ops/tasks/:id/archive`), restore (`POST /api/ai-ops/tasks/:id/restore`), filters by priority/area/includeArchived. Task detail page at `/operations/tasks/:id` with edit, comments, activity tabs.
- **Monitoring Engine**: `server/services/monitorEngine.ts` runs 4 daily checks (Form 1 missing, Form 2 missing, stock variance breach, Loyverse receipts missing). Writes dedup-protected events to `monitor_events` table. Scheduled daily at 13:00 Asia/Bangkok. Trigger on-demand via `POST /api/ai-ops/monitors/run`. Results at `GET /api/ai-ops/monitors`.
- **POS Integration**: Loyverse POS for daily receipt sync, shift reports, and webhook handling.
- **Analytics & Reporting**: Sales Heatmap, Email Notifications, Data-Driven Dashboard (real-time snapshot, variance, payment data), F&B Analysis Enhanced Metrics, Stock Reconciliation & Security.
- **Management Tools**: Manager Checklist System, Source-Based Expense Management, Banking Reconciliation System, Online Ordering System, Membership System, Rolls & Meat Ledger System.
- **Security**: Production-Grade Security with multi-layer protection and layout integrity protection.
- **Security & Accountability Layer (SA-1)**: Refund logging system (`refund_logs` table, POST /api/refunds/log, GET /api/refunds). Manager sign-off (`shift_review` table, POST/GET /api/shift-review). Stock baseline seeding (`stock_baseline` table, POST /api/stock/baseline). Stock snapshots (`stock_snapshot` table, POST /api/stock/snapshot). Variance engine (`stock_variance` table, POST /api/stock/variance/compute) with Buns threshold >5 warn/>10 critical and Meat threshold >500g warn/>1000g critical. Variance Monitor page at `/operations/variance-monitor`. Log Refund modal on Home page. Prisma model fixes: removed non-existent `supplier` and `packCost` fields from PurchasingItem model — Form 2 sync now working correctly (62 items, 10 drinks).
- **Canonical Data Architecture**:
    - **Purchasing Flow**: `purchasing_items` as single source of truth, linked to `daily_stock_v2` and `purchasing_shift_items`.
    - **Recipe Architecture**: Canonical system (`recipe` + `recipe_ingredient` tables) with `pos_item_recipe_map`. Costs computed from `purchasing_items.unit_cost`. `server/services/recipeAuthority.ts` handles recipe logic.
    - **Ingredient Management**: Decoupled canonical ingredients table (`base_unit`, `unit_cost_per_base`, `source_purchasing_item_id`) with one-way sync from purchasing items.
    - **Unified Stock Logging**: Consolidated stock logging via `StockReceivedModal` into Shopping List with tabs for Rolls, Meat, Drinks, stored in `stock_received_log` table.
    - **Ingredient Authority System (ADMIN-ONLY, ISOLATED)**: Versioned admin-only ingredient approval system completely isolated from recipe builder. Database tables: `ingredient_authority` (master records), `ingredient_authority_versions` (full audit trail). API: `/api/admin/ingredient-authority/*`. UI: `/menu-management/ingredient-authority`. Recipe builder must NEVER reference this system - any integration requires explicit owner approval.

## External Dependencies
- **AI Services**: OpenAI API (GPT-4o), Google Gemini.
- **POS Integration**: Loyverse POS.
- **Database Services**: Neon Database (Serverless PostgreSQL).
- **Email Service**: Gmail API.
- **PDF Generation**: jsPDF.

## 🔒 SYSTEM LOCKDOWN — JAN 28, 2026

The following are LOCKED:
- POS ingestion contract
- Core stock (Rolls / Meat / Drinks)
- Navigation structure
- Recipe builder ingredient flow
- Ingredient Authority boundaries

Changes require explicit owner approval.
Unauthorized refactors are prohibited.
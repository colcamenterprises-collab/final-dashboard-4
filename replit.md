# Restaurant Management Dashboard + Public Website

## Overview
This project is a comprehensive restaurant management dashboard designed to streamline operations, enhance efficiency, and boost profitability. It also includes a public-facing website layer (black/yellow Smash Brothers brand) at the root URL. It leverages AI-powered analytics and real-time insights by integrating with external POS systems and AI services. The platform provides automated sales analysis, inventory management, and marketing tools, aiming to be a centralized, data-driven solution for restaurant decision-making.

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
- **Frameworks**: React 18 with TypeScript (Vite), shadcn/ui (Radix UI), Tailwind CSS.
- **State Management**: TanStack Query (React Query).
- **Routing**: React Router.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Tablet-first design, 12px font sizes, 4px border radius, touch-optimized, dark theme, expanded sidebar, consolidated tabbed navigation. Banned colors: Light blue backgrounds. Golden standard styling reference: `/finance/expenses-import`.

### Backend Architecture
- **Runtime**: Node.js with Express.js (TypeScript, ES modules).
- **API Design**: RESTful, type-safe endpoints.
- **Database**: PostgreSQL with Drizzle ORM (primary) and Prisma ORM (specific interactions).
- **Session Management**: PostgreSQL-based sessions (connect-pg-simple).
- **Shift Logic**: 5 PM to 3 AM Bangkok timezone shift window.

### Feature Specifications
- **Core Operations**: Daily Shift Form (sales, expenses, cash, inventory), Recipe Management (costing, PDF), Inventory Management (tracking, shopping list), Comprehensive Daily Forms System.
- **AI-Powered Features**: Multi-agent system for receipt analysis, anomaly detection, ingredient calculation, stock recommendations, financial variance analysis, marketing content generation.
- **Bob Orchestrator System**: CEO Charter in `bob_documents`, Process Registry in `process_registry`, System Map UI at `/operations/ai-ops-control`. Onboarding context via `GET /api/ai-ops/bob/onboarding-context`. Bob observes shopping list, does not duplicate.
- **Bob Write Boundary**: `BOB_WRITE_ALLOWLIST` restricts write access to specific analysis and email trigger endpoints. Core data tables are protected from direct Bob writes.
- **Patch 4.0 — Self-Healing Analysis Build**: `server/services/analysisBuildOrchestrator.ts` is the core self-healing layer. `ensureAnalysisForDate(date, triggerSource)` auto-builds daily usage (receipts truth first if also missing) when data is missing. `runStartupCatchup()` checks last 3 BKK dates on every server start. Build lifecycle tracked in `analysis_build_status` table (UNIQUE per date+build_type). Build failures write to `issue_register` with `MISSING_USAGE_BUILD` type and `source_ref = MISSING_USAGE_BUILD::YYYY-MM-DD` for dedup. `GET /api/analysis/build-status?date=YYYY-MM-DD` returns per-date build status. The daily-usage GET and Bob stock-usage endpoints both auto-build on missing data instead of returning dead errors.
- **Analysis Adjustments System**: `analysis_adjustments` table stores AI-generated amendments, with API for adjustments and UI for manager review in `SalesShiftAnalysis.tsx`.
- **Bob Email Trigger**: `POST /api/ai-ops/bob/email/trigger` sends detailed analysis reports via email.
- **Bob CSV Export**: `GET /api/ai-ops/bob/analysis-csv/:date` for downloading analysis data.
- **Canonical Agent Read Surface (`/api/agent/read`)**: 6 governed, shift-window-aware read endpoints for agents. Shared auth middleware (`server/middleware/agentAuth.ts`) reuses `agent_tokens` SHA-256 hash + `BOB_READONLY_TOKEN` fallback. All responses use `AgentEnvelope<T>` with `blockers[]`, `warnings[]`, `status`. Endpoints: `shift-summary` (form+POS+issues), `daily-operations` (sales+stock forms), `receipt-summary` (lv_receipt+receipt_truth_line), `purchasing-summary` (purchase_tally+drinks+expenses), `finance-summary` (sales+expenses+wages+metrics), `reconciliation-summary` (form vs POS variance+issues+stock). Mounted at `/api/agent/read`, added to `API_PUBLIC_PREFIXES` (no session required). Governance: `.openclaw/workspace/core/APP_READ_SURFACE.md`.
- **Bob Canonical Read Layer (`/api/ai-ops/bob`)**: Additive canonical endpoints mounted after aiOpsControl (zero conflict). Files: `server/routes/bobCanonicalRead.ts` (routes) + `server/services/bobCanonicalReadService.ts` (aggregator). Three endpoints: `GET /shift-window?date=YYYY-MM-DD` (no auth, returns BKK shift window 17:00→03:00), `GET /read/shift-canonical?date=YYYY-MM-DD` (Bearer auth, full canonical snapshot from all sources with per-source status), `GET /read/proxy?path=<allowlisted>&...` (Bearer auth, strict allowlist proxy—denied paths return PROXY_PATH_DENIED). Canonical snapshot aggregates: `daily_sales_v2`, `expenses`, `lv_receipt+receipt_truth_line`, `purchase_tally+purchase_tally_drink`, `receipt_truth_daily_usage`, `purchasing_items`. Missing sources are reported explicitly with reasons; no silent failures.
- **Work Register (ai_tasks)**: Enhanced task management with areas (operations, finance, etc.), priority levels, and assignee tracking. API for archiving/restoring tasks and task detail pages.
- **Monitoring Engine**: `server/services/monitorEngine.ts` performs daily checks (missing forms, stock variance, missing receipts) and logs events to `monitor_events`.
- **Staff Access System (Rebuilt)**: Owner-only access. Two-section UI: (1) Staff Directory table capturing Name, Email, Contact Number, Photo, Role; (2) Role Permissions matrix where Owner sets per-role access. Login changed from "select name → PIN" to "enter email → PIN". New `role_permissions` DB table stores permissions per role. `internal_users` extended with `email` and `contact_number` columns. Roles: Owner, Manager, Cashier, Kitchen Staff.
- **POS Integration**: Loyverse POS for receipt sync, shift reports, and webhooks.
- **Analytics & Reporting**: Sales Heatmap, Email Notifications, Data-Driven Dashboard, F&B Analysis, Stock Reconciliation & Security.
- **Management Tools**: Manager Checklist System, Source-Based Expense Management, Banking Reconciliation, Online Ordering, Membership, Rolls & Meat Ledger.
- **Theft-Control Issue Register**: `issue_register` table with CRUD API and auto-detection logic for various discrepancies (e.g., BUNS_VARIANCE, MEAT_VARIANCE). UI at `/operations/issue-register`.
- **Security & Accountability Layer (SA-1)**: Refund logging, manager shift sign-off, stock baseline seeding, stock snapshots, and a variance engine with specific thresholds for buns and meat.
- **Canonical Data Architecture**:
    - **Purchasing Flow**: `purchasing_items` as source of truth.
    - **Recipe Architecture**: Canonical system (`recipe` + `recipe_ingredient` tables) with costs derived from `purchasing_items`.
    - **Ingredient Management**: Decoupled canonical ingredients table (`ingredient_authority`).
    - **Unified Stock Logging**: `StockReceivedModal` logs into `stock_received_log`.
    - **Ingredient Authority System**: Admin-only, versioned approval system, isolated from recipe builder.

## External Dependencies
- **AI Services**: OpenAI API (GPT-4o), Google Gemini.
- **POS Integration**: Loyverse POS.
- **Database Services**: Neon Database (Serverless PostgreSQL).
- **Email Service**: Gmail API.
- **PDF Generation**: jsPDF.
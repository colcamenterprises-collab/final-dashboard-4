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
- **Daily Shift Form**: Comprehensive form for sales, expenses, cash management, and inventory.
- **AI-Powered Features**: Multi-agent system for receipt analysis, anomaly detection, ingredient calculation, stock recommendations, financial variance analysis, and marketing content generation.
- **Loyverse POS Integration**: Automated daily receipt sync, shift reports, and webhook handling with timezone-aware processing.
- **Recipe Management**: System for ingredient portion selection, cost calculation, and PDF generation.
- **Inventory Management**: Tracking supplier items, stock levels, and automated shopping list generation.
- **Sales Heatmap**: Visual analytics for hourly sales patterns.
- **Email Notifications**: Automated daily management reports.
- **Form Management**: Soft delete, archived view, and robust validation.
- **Database-Driven Ingredient System**: Dynamic ingredient management based on TypeScript data sync.
- **Comprehensive Daily Forms System**: Dual-form system (/daily-sales, /daily-stock) with draft/submit status.
- **POS Ingestion & Analytics System**: Backend modules for POS data ingestion, normalization, analytics, AI summaries, and scheduled tasks.
- **Production-Grade Security**: Multi-layer security with HTTP method blocking, ORM write protection, database-level constraints, read-only database user, security middleware, and safety script detection.
- **Layout Integrity Protection**: Automated prebuild check to prevent layout hacks.
- **Source-Based Expense Management**: System for categorizing expenses as direct or shift-related.
- **Data-Driven Dashboard**: Real-time analytics display showing snapshot data, purchases-aware variance, authentic payment data, and top-selling items.
- **Purchases + Audit Fields System**: Implementation with expense types and line items for stock accountability.
- **Banking Reconciliation System**: Real-time balance checking with visual indicators and automated calculations.
- **Enhanced Email Reporting**: Daily management emails with detailed breakdowns.
- **Manager Checklist System**: Standalone modal with database, API, and React component for shift closing procedures.
- **Online Ordering System**: VEV replica design with centered headings, tight margins, category tabs, modifier support, cart management, and database-driven menu (CRUD via `/marketing/menu-admin`, public at `/order`).
- **Membership System**: Complete customer membership platform at `/membership` with digital card generation, barcode support, spend tracking, and optional Loyverse Customers API integration.
- **F&B Analysis Enhanced Metrics**: Shift analytics page displays receipt count, payment type breakdown, and top 5 items by category.
- **Rolls & Meat Ledger System**: Integrated audit trail for inventory tracking at `/operations/analysis/shift-items` with manual amendment support and historical data rebuild.

### Database Schema (Core Tables)
- Users, Daily Sales, Shift Reports, Loyverse Receipts, Recipes, Ingredients, Expenses, Shopping List, Marketing, Chat Logs.
- Restaurant, PosConnection, Receipt, ReceiptItem, ReceiptPayment, MenuItem, Expense, AnalyticsDaily, Job, PosSyncLog, IngestionError for POS, analytics, and job management.
- DailySalesV2, DailyStockV2, ShoppingPurchaseV2, WageEntryV2, OtherExpenseV2 for enhanced data models.
- Normalized POS tables: lv_receipt, lv_line_item, lv_modifier.
- Item catalog and analytics cache tables: item_catalog, analytics_shift_item, analytics_shift_category_summary.
- Manager checklist tables: cleaning_tasks, manager_checklists.
- Inventory ledger tables: rolls_ledger, meat_ledger.
- Online ordering tables: menu_categories_online, menu_items_online, modifier_groups_online, modifier_options_online, orders_online, order_lines_online.
- Purchasing flow tables: `purchasing_items`, `daily_stock_v2`, `purchasing_shift_items`.
- Recipe tables: `recipe`, `recipe_ingredient`, `pos_item_recipe_map`.

### Canonical Data Architecture
- **Purchasing Flow**: `purchasing_items` as single source of truth for all purchasable items, linked to `daily_stock_v2` and `purchasing_shift_items`.
- **Recipe Architecture**: New canonical system (`recipe` + `recipe_ingredient` tables with Drizzle ORM) with explicit `pos_item_recipe_map`. Recipe costs computed fresh from `purchasing_items.unit_cost`. Legacy recipe pages are read-only.
- **Key APIs**: `/api/purchasing-items`, `/api/purchasing-shift-log`, `/api/purchasing-analytics`, `/api/recipes`.
- **PHASE E: Recipe & POS Unification**: `server/services/recipeAuthority.ts` as canonical recipe service. Guard statuses for `UNMAPPED_POS_ITEM`, `RECIPE_INCOMPLETE`. Debug endpoints available.
- **PHASE F: System Recovery Patch (Dec 27, 2025)**: All 500 errors eliminated with defensive error handling. Fixed /api/data-confidence, /api/ingredients/master, /api/reports/list. All pages verified: Purchasing List (73), Recipes (44), Ingredients (70). All endpoints return 200.
- **PATCH R1: Ingredient Canonical Layer (Jan 7, 2026)**: Decouples recipes from purchasing items via canonical ingredients table. New fields: `base_unit` (grams|ml|each), `unit_cost_per_base`, `source_purchasing_item_id`. One-way sync from purchasing → ingredients via `ingredientSync.service.ts`. API endpoints: `/api/ingredients/canonical`, `/api/ingredients/sync/:id`, `/api/ingredients/sync-all`. Uses raw SQL for database operations to avoid Drizzle ORM column naming mismatches (mixed camelCase/snake_case columns).
- **PATCH R1.1: Recipe Cutover to Canonical Ingredients (Jan 7, 2026)**: Complete decoupling of recipes from purchasing. RecipeEditModal now uses `/api/ingredients/canonical` endpoint. Cost formula: `unitCostPerBase × portionQty` (no conversions). Recipe ingredients support both `ingredientId` (canonical) and `purchasingItemId` (legacy). UI shows only: Ingredient name, Portion qty, Base unit, Cost. No purchasing references in recipe UI.

## External Dependencies
- **AI Services**: OpenAI API (GPT-4o), Google Gemini.
- **POS Integration**: Loyverse POS.
- **Database Services**: Neon Database (Serverless PostgreSQL).
- **Email Service**: Gmail API.
- **PDF Generation**: jsPDF.
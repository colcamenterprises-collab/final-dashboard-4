# Restaurant Management Dashboard

## Overview
This comprehensive restaurant management dashboard streamlines operations with AI-powered analytics and real-time insights. It integrates with external POS systems, AI services, and provides automated sales analysis, inventory management, and marketing. The business vision is to enhance operational efficiency and profitability for restaurants by providing a centralized system for data-driven decision making.

## User Preferences
Preferred communication style: Simple, everyday language.
Code isolation policy: Once functionality is working and tested, isolate it to prevent breaking when updating other sections.
Testing requirement: Always test changes in isolation before making additional modifications.
Documentation requirement: When creating comprehensive project documentation, include all operational details someone would need to rebuild the system from scratch.
Agent execution policy: CRITICAL - Execute ONLY exact commands provided. NEVER add, remove, or modify features unless explicitly approved with 'Yes, implement [specific change]'. NEVER run database migrations, schema changes, or destructive operations unless specifically instructed. If unsure, ask for clarification. This policy is absolute and non-negotiable.
Form 1 → Form 2 Navigation: RESOLVED (Aug 17, 2025) - Fixed Form 1 submit bug with immediate navigation to Form 2. Backend returns consistent `{ ok: true, shiftId }` format, both `/api/daily-sales` and `/api/forms/daily-sales` endpoints work seamlessly with redirect, and success modal replaced with direct navigation for reliability.
Testing requirement: All enhancements must at all times be tested prior to advising a job as completed. Testing includes UI, system files, front end, mobile and tablet responsiveness. All tests must be completed prior to release.
Data integrity policy: NEVER use fake, mock, placeholder, or synthetic data. Always use authentic data from the database or authorized sources. Creating fake data for testing or demonstrations is strictly prohibited.
Email automation requirement: Every completed daily shift form must automatically send email to management with PDF attachment.
Fort Knox Locked Form System: Daily Sales & Stock form structure is LOCKED under Cam's direct approval. Form contains exact 13-section ordering, includes approved Aroi Dee Sales field, implements Burger Buns & Meat Count under Cash Management, and uses snake_case field names matching Pydantic schema. NO modifications allowed without explicit Cam approval. Located at /daily-stock-sales with clean minimal UI, Poppins font, and proper email integration to smashbrothersburgersth@gmail.com.
Fort Knox File Structure: Core locked files include daily_sales_form_locked.html (frontend UI), daily_sales_schema.py (Pydantic validation), daily_sales_validation.py (runtime validation), and Food Costings - Supplier - Portions - Prices v1.0 05.08.25.csv (source of truth for all menu and stock items). CSV file must be referenced for Menu Management and Ingredients List. No field modifications, renaming, or reordering allowed without Cam approval. All system emails locked to smashbrothersburgersth@gmail.com.
Layout Protection: Clean app shell architecture (App.tsx + Sidebar.tsx) with automated prebuild validation preventing margin-left hacks. Layout uses proper flex-1 min-w-0 structure with 256px → 78px collapsible sidebar.
Accordion Navigation: Advanced grouped sidebar with collapsible sections (Dashboard, Operations, Finance, Menu Management, Marketing) featuring emerald pill active states, monochrome SVG icons, and smooth expand/collapse animations with chevron indicators.

## System Architecture
### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite.
- **UI Framework**: shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with custom restaurant-specific design tokens.
- **State Management**: TanStack Query (React Query) for server state.
- **Routing**: React Router (migrated from Wouter) for modern navigation with clean sidebar layout.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Consistent button styling, responsive design, rounded corners, dark theme, expanded sidebar default, consolidated navigation with tabbed interfaces.

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful API with centralized route handling and type-safe endpoints.
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations. Prisma ORM is also used for specific dual-form system interactions.
- **Session Management**: PostgreSQL-based sessions with connect-pg-simple.
- **Shift Logic**: Handles 5 PM to 3 AM Bangkok timezone (Asia/Bangkok) shift window.

### Key Features
- **Daily Shift Form**: Comprehensive form for sales, expenses, cash management, and inventory.
- **AI-Powered Features**: Multi-agent system (Ollie, Sally, Marlo, Big Boss) leveraging GPT-4o for receipt analysis, anomaly detection, ingredient calculation, stock recommendations, financial variance analysis, and marketing content generation.
- **Loyverse POS Integration**: Automated daily receipt sync, shift reports, and webhook handling.
- **Recipe Management**: System for ingredient portion selection, cost calculation, and PDF generation.
- **Inventory Management**: Tracking supplier items, stock levels, and automated shopping list generation.
- **Sales Heatmap**: Visual analytics for hourly sales patterns.
- **Email Notifications**: Automated daily management reports.
- **Form Management**: Soft delete, archived view, and robust validation.
- **Database-Driven Ingredient System**: Dynamic ingredient management based on CSV sync.
- **Comprehensive Daily Forms System**: Dual-form system (/daily-sales, /daily-stock) with draft/submit status.
- **POS Ingestion & Analytics System**: Backend modules for POS data ingestion, normalization, analytics (sales, top sellers, stock variance), AI summaries, and scheduled tasks.
- **Production-Grade Security**: Multi-layer security with HTTP method blocking, ORM write protection, database-level constraints, read-only database user, security middleware, and safety script detection.
- **Layout Integrity Protection**: Automated prebuild check (`scripts/deny-layout-hacks.js`) that prevents margin-left hacks from being reintroduced, ensuring clean flex-based layout architecture.
- **Source-Based Expense Management**: System for categorizing expenses as direct or shift-related, with tabbed interfaces for separation.
- **Data-Driven Dashboard**: Real-time analytics display showing snapshot data, purchases-aware variance, authentic payment data, and top-selling items.
- **Purchases + Audit Fields System**: Full implementation with expense types and line items for comprehensive stock accountability and variance analysis.
- **Restaurant Analytics & AI Summary System**: Integration with Loyverse POS for detailed analytics and automated daily operational reports.

### Database Schema (Core Tables)
- Users, Daily Sales, Shift Reports, Loyverse Receipts, Recipes, Ingredients, Expenses, Shopping List, Marketing, Chat Logs.
- Restaurant, PosConnection, Receipt, ReceiptItem, ReceiptPayment, MenuItem, Expense, AnalyticsDaily, Job, PosSyncLog, IngestionError for POS, analytics, and job management.
- **V2 Models Added (Aug 16, 2025)**: DailySalesV2, DailyStockV2, ShoppingPurchaseV2, WageEntryV2, OtherExpenseV2 - additive schema enhancement preserving all existing data.

## External Dependencies
- **AI Services**: OpenAI API (GPT-4o), Google Gemini.
- **POS Integration**: Loyverse POS.
- **Database Services**: Neon Database (Serverless PostgreSQL), Drizzle ORM, Prisma ORM.
- **Email Service**: Gmail API.
- **PDF Generation**: jsPDF.
# Restaurant Management Dashboard

## Overview

This is a comprehensive restaurant management dashboard application designed to streamline restaurant operations through intelligent automation and real-time insights. It provides AI-powered analytics, integrating with external services like Loyverse POS, OpenAI, and Google Gemini for automated sales analysis, inventory management, and marketing. The system's business vision is to enhance operational efficiency and profitability for restaurants.

## User Preferences

Preferred communication style: Simple, everyday language.
Code isolation policy: Once functionality is working and tested, isolate it to prevent breaking when updating other sections.
Testing requirement: Always test changes in isolation before making additional modifications.
Documentation requirement: When creating comprehensive project documentation, include all operational details someone would need to rebuild the system from scratch.
Agent execution policy: CRITICAL - Execute ONLY exact commands provided. NEVER add, remove, or modify features unless explicitly approved with 'Yes, implement [specific change]'. NEVER run database migrations, schema changes, or destructive operations unless specifically instructed. If unsure, ask for clarification. This policy is absolute and non-negotiable.
Testing requirement: All enhancements must at all times be tested prior to advising a job as completed. Testing includes UI, system files, front end, mobile and tablet responsiveness. All tests must be completed prior to release.
Data integrity policy: NEVER use fake, mock, placeholder, or synthetic data. Always use authentic data from the database or authorized sources. Creating fake data for testing or demonstrations is strictly prohibited.
Email automation requirement: Every completed daily shift form must automatically send email to management with PDF attachment.
Fort Knox Locked Form System: Daily Sales & Stock form structure is LOCKED under Cam's direct approval. Form contains exact 13-section ordering, includes approved Aroi Dee Sales field, implements Burger Buns & Meat Count under Cash Management, and uses snake_case field names matching Pydantic schema. NO modifications allowed without explicit Cam approval. Located at /daily-stock-sales with clean minimal UI, Poppins font, and proper email integration to smashbrothersburgersth@gmail.com.
Fort Knox File Structure: Core locked files include daily_sales_form_locked.html (frontend UI), daily_sales_schema.py (Pydantic validation), daily_sales_validation.py (runtime validation), and Food Costings - Supplier - Portions - Prices v1.0 05.08.25.csv (source of truth for all menu and stock items). CSV file must be referenced for Menu Management and Ingredients List. No field modifications, renaming, or reordering allowed without Cam approval. All system emails locked to smashbrothersburgersth@gmail.com.

## Recent Changes

**August 9, 2025 - Bulletproof Loyverse API Integration - COMPLETE**
- Unified token resolution with fallback support (LOYVERSE_API_TOKEN || LOYVERSE_ACCESS_TOKEN)
- Added store filtering for multi-outlet support (LOYVERSE_STORE_ID)
- Implemented hard-loop pagination to prevent short-circuits and ensure complete data fetch
- Added precise Bangkok→UTC timezone conversion for API calls
- Enhanced logging with UTC window display and sample timestamp debugging
- Eliminated mock data fallbacks - requires real token for production use
- Fixed Loyverse API field mapping: receipt_number as externalId, proper item/payment field mapping
- Database upsert fully operational: receipts, items, and payments successfully persisting
- Created one-shot incremental sync script with configurable time windows
- All automated operations running: 15-min sync, 3:30 AM analytics, 8:00 AM emails
- Verification tools ready for ongoing data validation and CSV comparison
- **STATUS: Production-ready POS integration with real-time data sync capability**

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite.
- **UI Framework**: shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with custom restaurant-specific design tokens.
- **State Management**: TanStack Query (React Query) for server state management.
- **Routing**: Wouter for lightweight client-side routing.
- **Forms**: React Hook Form with Zod validation.
- **UI/UX Decisions**:
    - Consistent button styling (Primary: dark blue/black, Outline: light background with border, Current Page: gray background).
    - Responsive design across breakpoints for consistent sizing and spacing.
    - Rounded corners for all buttons (rounded-md standard).
    - Dark theme implementation with proper color transitions.
    - Sidebar defaults to expanded with an option to minimize.
    - Consolidated navigation for key operational areas (e.g., Reports & Analysis, Purchasing) using tabbed interfaces.

### Backend Architecture
- **Runtime**: Node.js with Express.js framework.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful API with centralized route handling and type-safe endpoints.
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations.
- **Session Management**: PostgreSQL-based sessions with connect-pg-simple.
- **Shift Logic**: Handles 5 PM to 3 AM Bangkok timezone (Asia/Bangkok) shift window.

### Key Features
- **Daily Shift Form**: Comprehensive form for sales, expenses, cash management, and inventory tracking with real-time calculations and dynamic entry management.
- **AI-Powered Features**:
    - **Multi-Agent System**: Four specialized AI agents (Ollie, Sally, Marlo, Big Boss) leveraging GPT-4o for operations, finance, marketing, and strategic oversight.
    - **Receipt Analysis**: GPT-4o integration for parsing receipt images and extracting data.
    - **Anomaly Detection**: Automated detection of unusual sales patterns and cash discrepancies.
    - **Ingredient Calculation**: Smart ingredient usage tracking from sales data.
    - **Stock Recommendations**: AI-driven inventory reordering suggestions.
    - **Financial Variance Analysis**: Automated comparison between POS and manual reports.
    - **Marketing Content Generation**: AI-powered creation of food descriptions, headlines, and advertising copy for delivery partners and social media.
- **Loyverse POS Integration**: Automated daily receipt sync, shift reports, and webhook handling for real-time data.
- **Recipe Management**: Comprehensive system with ingredient portion selection, automatic cost calculation, and PDF generation.
- **Inventory Management**: Tracking of supplier items, stock levels, and automated shopping list generation based on inventory needs.
- **Sales Heatmap**: Visual analytics for hourly sales patterns.
- **Email Notifications**: Automated daily management reports.
- **Form Management**: Soft delete functionality for forms, archived view, and robust validation middleware.
- **Database-Driven Ingredient System**: Dynamic ingredient management based on CSV sync, with categorized display and editable quantities.
- **Comprehensive Daily Forms System**: Dual-form system (/daily-sales, /daily-stock) with Prisma ORM, draft/submit status, and categorized ingredient management.
- **POS Ingestion & Analytics System**: Backend modules for automated restaurant operations, including POS data ingestion, data normalization, analytics processing (sales, top sellers, stock variance), Jussi AI summary system, and scheduled tasks for POS sync, analytics, and email reports.

### Database Schema (Core Tables)
- **Users**: Authentication and user management.
- **Daily Sales**: Staff-reported sales and operational data.
- **Shift Reports**: Daily shift summaries.
- **Loyverse Receipts**: Archived Loyverse POS receipt data.
- **Recipes**: Menu item recipes with ingredient details and cost per serving.
- **Ingredients**: Ingredient master data with pricing and units.
- **Expenses**: Business expense categorization.
- **Shopping List**: Procurement tracking.
- **Marketing**: Quick notes and calendar events.
- **Chat Logs**: Records of AI agent interactions.
- **Restaurant, PosConnection, Receipt, ReceiptItem, ReceiptPayment, MenuItem, Expense, AnalyticsDaily, Job, PosSyncLog, IngestionError**: For comprehensive POS, analytics, and job management.

## External Dependencies

- **AI Services**:
    - **OpenAI API**: GPT-4o model for various AI-powered features.
    - **Google Gemini**: Alternative AI provider for multimodal analysis.
- **POS Integration**:
    - **Loyverse POS**: For sales data import and real-time transaction feeds.
- **Database Services**:
    - **Neon Database**: Serverless PostgreSQL.
    - **Drizzle ORM**: For type-safe database operations and migrations.
    - **Prisma ORM**: For database interactions in dual-form system.
- **Email Service**:
    - **Gmail API**: For automated email notifications.
- **PDF Generation**:
    - **jsPDF**: For client-side PDF recipe generation.
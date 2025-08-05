# Restaurant Management Dashboard

## Overview

This is a comprehensive restaurant management dashboard application designed to streamline restaurant operations through intelligent automation and real-time insights. It provides AI-powered analytics, integrating with external services like Loyverse POS, OpenAI, and Google Gemini for automated sales analysis, inventory management, and marketing. The system's business vision is to enhance operational efficiency and profitability for restaurants.

## User Preferences

Preferred communication style: Simple, everyday language.
Code isolation policy: Once functionality is working and tested, isolate it to prevent breaking when updating other sections.
Testing requirement: Always test changes in isolation before making additional modifications.
Documentation requirement: When creating comprehensive project documentation, include all operational details someone would need to rebuild the system from scratch.
Agent execution policy: Execute only exact commands provided. Do not add, remove, or modify features unless explicitly approved with 'Yes, implement [specific change]'. Log all actions with timestamp and description. If unsure, ask for clarification.
Testing requirement: All enhancements must at all times be tested prior to advising a job as completed. Testing includes UI, system files, front end, mobile and tablet responsiveness. All tests must be completed prior to release.
Data integrity policy: NEVER use fake, mock, placeholder, or synthetic data. Always use authentic data from the database or authorized sources. Creating fake data for testing or demonstrations is strictly prohibited.
Email automation requirement: Every completed daily shift form must automatically send email to management with PDF attachment.
Email system status (Aug 2025): Fully operational and enhanced with professional formatting. Gmail App Password authentication confirmed working with bulletproof delivery. System includes company logo, structured HTML/plaintext multipart emails, THB currency formatting, comprehensive PDF attachments, and professional styling without emojis. Both /api/send-form-summary and /api/send-last-form-summary endpoints operational with confirmed delivery to smashbrothersburgersth@gmail.com. Enhanced with proper calculations (total sales, wages, shopping, net revenue, cash differences) and comprehensive section formatting matching business requirements. Ready for production integration.
Fort Knox Locked Form System (Aug 4, 2025): Daily Sales & Stock form structure is LOCKED under Cam's direct approval. Form contains exact 13-section ordering, includes approved Aroi Dee Sales field, implements Burger Buns & Meat Count under Cash Management, and uses snake_case field names matching Pydantic schema. NO modifications allowed without explicit Cam approval. Located at /daily-stock-sales with clean minimal UI, Poppins font, and proper email integration to smashbrothersburgersth@gmail.com.

Fort Knox File Structure (Aug 5, 2025): Core locked files include daily_sales_form_locked.html (frontend UI), daily_sales_schema.py (Pydantic validation), daily_sales_validation.py (runtime validation), and Food Costings - Supplier - Portions - Prices v1.0 05.08.25.csv (source of truth for all menu and stock items). CSV file must be referenced for Menu Management and Ingredients List. No field modifications, renaming, or reordering allowed without Cam approval. All system emails locked to smashbrothersburgersth@gmail.com.

Form Library Updates (Aug 5, 2025): Enhanced form library with submission date headers replacing Form IDs, and soft delete functionality that removes forms from frontend view while preserving them in database for future recovery. Added deletedAt timestamp field to database schema and implemented /api/daily-stock-sales/:id/soft DELETE endpoint. Database queries updated to use raw SQL with correct column names matching actual database structure.

Archived View System (Aug 5, 2025): Implemented complete archived view functionality with toggle between Active and Archived forms. Added /api/daily-stock-sales/archived GET endpoint and /api/daily-stock-sales/:id/restore POST endpoint. Frontend includes toggle button, restore functionality with confirmation dialogs, and context-aware UI messaging. Forms can be archived (soft deleted) and restored seamlessly while maintaining data integrity.

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
- **Email Notifications**: Automated daily management reports via Gmail API.

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

## External Dependencies

- **AI Services**:
    - **OpenAI API**: GPT-4o model for various AI-powered features.
    - **Google Gemini**: Alternative AI provider for multimodal analysis.
- **POS Integration**:
    - **Loyverse POS**: For sales data import and real-time transaction feeds.
- **Database Services**:
    - **Neon Database**: Serverless PostgreSQL.
    - **Drizzle ORM**: For type-safe database operations and migrations.
- **Email Service**:
    - **Gmail API**: For automated email notifications.
- **PDF Generation**:
    - **jsPDF**: For client-side PDF recipe generation.
```
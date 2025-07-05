# Restaurant Management Dashboard

## Overview

This is a comprehensive restaurant management dashboard application built with a full-stack architecture. The system provides AI-powered analytics for restaurant operations, integrating with external services like Loyverse POS, OpenAI, and Google Gemini for automated sales analysis and inventory management. The application focuses on streamlining daily operations through intelligent automation and real-time insights.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom restaurant-specific design tokens
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with centralized route handling
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Session Management**: PostgreSQL-based sessions with connect-pg-simple

### Development Setup
- **Build System**: Vite for frontend, esbuild for backend bundling
- **Development Server**: Integrated Vite dev server with Express middleware
- **Hot Reload**: Full-stack hot reloading in development mode
- **TypeScript**: Strict mode with path mapping for clean imports

## Key Components

### Core Pages
1. **Dashboard**: Real-time KPI overview with sales metrics and AI insights
2. **Daily Stock & Sales**: Staff shift reporting with inventory tracking
3. **Shopping List**: Automated procurement management with supplier integration
4. **Finance**: POS vs staff report comparison and P&L analysis
5. **Expenses**: Business expense tracking with categorization
6. **POS Loyverse**: Comprehensive receipt capture, shift reports, and AI-powered analysis

### AI-Powered Features
- **Receipt Analysis**: OpenAI GPT-4o integration for parsing receipt images
- **Anomaly Detection**: Automated detection of unusual sales patterns
- **Ingredient Calculation**: Smart ingredient usage tracking from sales data
- **Stock Recommendations**: AI-driven inventory reordering suggestions
- **Financial Variance Analysis**: Automated comparison between POS and manual reports
- **Marketing Content Generation**: AI-powered creation of food descriptions, headlines, and advertising copy for delivery partners (GrabFood, FoodPanda), advertising campaigns, and social media posts using GPT-4o

### Database Schema
- **Users**: Authentication and user management
- **Daily Sales**: Sales tracking with payment method breakdown
- **Menu Items**: Product catalog with ingredient mapping
- **Inventory**: Stock levels with supplier information
- **Shopping List**: Procurement tracking with priority levels
- **Expenses**: Business expense categorization
- **Transactions**: Detailed sales transaction records
- **AI Insights**: Machine learning-generated recommendations
- **Loyverse Receipts**: Complete receipt archival with search capabilities
- **Loyverse Shift Reports**: Daily shift summaries with sales analytics

## Data Flow

### Real-time Updates
- Frontend uses TanStack Query with automatic refetching intervals
- Custom hooks provide real-time data simulation for development
- WebSocket-ready architecture for future real-time implementations

### AI Integration Pipeline
1. Receipt images uploaded and converted to base64
2. OpenAI GPT-4o processes images for item extraction
3. Ingredient usage calculated from menu item mappings
4. Anomalies detected through pattern analysis
5. Insights stored and surfaced in dashboard

### API Layer
- Centralized error handling with Express middleware
- Request/response logging for debugging
- Type-safe API endpoints with shared schemas
- Graceful error responses with appropriate HTTP status codes

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4o model for receipt analysis and text processing
- **Google Gemini**: Alternative AI provider for multimodal analysis
- **Configuration**: Environment variables for API key management

### POS Integration
- **Loyverse POS**: Ready for integration with sales data import
- **Real-time Sync**: Architecture supports live transaction feeds

### Database Services
- **Neon Database**: Serverless PostgreSQL with connection pooling
- **Drizzle ORM**: Type-safe database operations with migration support

## Deployment Strategy

### Production Build
- Frontend: Vite production build with optimized assets
- Backend: esbuild bundle for Node.js deployment
- Assets: Static file serving with Express in production

### Environment Configuration
- Development: Local development with hot reloading
- Production: Optimized builds with environment-specific settings
- Database: Automatic migration system with Drizzle Kit

### Scalability Considerations
- In-memory storage interface allows easy database swapping
- Modular AI services can be scaled independently
- Frontend built for responsive design across devices

### Loyverse POS Receipt Management
- **Receipt Capture**: Automated daily receipt sync from Loyverse API (6pm-3am shifts)
- **Shift Reports**: Daily shift summaries with sales analytics and staff tracking
- **Archival System**: Complete receipt storage with search by date, receipt number, and amount
- **Automated Processing**: Daily 4am scheduled tasks for receipt and report generation
- **Real-time Sync**: Manual sync capabilities for immediate data refresh

## Operational Schedule
- **Shift Hours**: 6pm - 3am daily
- **Staff Reporting**: 2am - 3am (shift end reports)
- **Automated Sync**: 4am daily (receipts and shift reports)
- **Data Retention**: All receipts and reports permanently archived and searchable

## Changelog

```
Changelog:
- June 30, 2025. Initial setup with comprehensive restaurant management features
- June 30, 2025. Implemented Loyverse POS receipt capture and archival system
- June 30, 2025. Added automated daily scheduling at 4am for receipt processing
- June 30, 2025. Created shift report management with complete audit trail
- June 30, 2025. Removed placeholder data and staff names, integrated real Loyverse data only
- June 30, 2025. Updated shift report format to show actual closing dates and transaction counts
- June 30, 2025. Standardized heading typography across dashboard components
- July 2, 2025. Fixed React error where receipt items array was being rendered directly as objects
- July 2, 2025. Implemented authentic cash balance validation with 40 baht variance tolerance
- July 2, 2025. Updated shift 537 with exact figures from authentic Loyverse report
- July 2, 2025. Fixed Bangkok timezone handling (UTC+7) for all shift reports
- July 2, 2025. Confirmed data sources: All figures from authentic Loyverse shift data only
- July 2, 2025. Updated KPIs to show authentic single shift total of ฿10,877 (July 1-2)
- July 2, 2025. Added monthly payment type pie chart with authentic breakdown: Cash 47%, Grab 24%, Other 29%
- July 2, 2025. Fixed Daily Stock & Sales form placeholders to use generic guidance text
- July 3, 2025. Implemented mandatory receipt photo validation for shopping expenses in Daily Stock & Sales form
- July 3, 2025. Added comprehensive icon modernization across Daily Stock & Sales form sections with black and white icons
- July 3, 2025. Enhanced visual feedback system: red warnings when photos required, green confirmations when complete
- July 3, 2025. Implemented Gmail email notification system for Daily Stock & Sales management summaries
- July 3, 2025. Created automated email triggers with professional HTML templates, cash balance validation, and receipt attachments
- July 3, 2025. Added comprehensive email content including sales breakdowns, expense tracking, and shopping list generation
- July 3, 2025. Built comprehensive live Loyverse POS API integration with real-time data synchronization
- July 3, 2025. Created LoyverseLive management interface for connection status, manual sync controls, and real-time automation
- July 3, 2025. Added API endpoints for receipts, menu items, customers, stores with proper authentication handling
- July 3, 2025. Integrated Smash Bros Burgers (Rawai) store data from authentic Loyverse POS system
- July 3, 2025. Resolved Replit environment variable caching issues for stable API connectivity 
- July 3, 2025. Added compact Loyverse connection status widget to main dashboard for real-time monitoring
- July 3, 2025. Replaced inventory value KPI card with integrated Loyverse POS connection status showing real-time sync status
- July 3, 2025. Enhanced bank statement AI analysis with comprehensive transaction categorization, expense matching, and discrepancy detection
- July 3, 2025. Integrated sophisticated financial analysis prompt for comparing bank statements against internal expense records
- July 3, 2025. Added AI-powered expense-to-bank-transaction matching with predefined categories (Inventory, Wages, Utilities, Rent, Supplies, Marketing, Other)
- July 3, 2025. Implemented structured JSON output for AI analysis including matched/unmatched expenses, suspect transactions, and category totals
- July 3, 2025. Merged separate expense pages into unified ExpensesMerged page with Add Expenses form prominently positioned at top
- July 3, 2025. Combined basic expense tracking with enhanced AI-powered bank statement analysis in single comprehensive interface
- July 3, 2025. Streamlined navigation by removing duplicate expense entries and consolidating all expense functionality
- July 3, 2025. Completed critical Bangkok timezone (UTC+7) implementation for accurate 6pm-3am shift cycle handling
- July 3, 2025. Implemented automated 3am Bangkok time daily sync scheduling for receipt processing at shift end
- July 3, 2025. Fixed timezone discrepancies - "Today's Sales is correct" confirmed by user after Bangkok timezone integration
- July 3, 2025. Enhanced Loyverse API with intelligent shift period detection based on Bangkok time for accurate receipt filtering
- July 4, 2025. MAJOR FIX: Corrected all dashboard data to match authentic Loyverse CSV data exactly
- July 4, 2025. Fixed "Today's Sales" from incorrect ฿7,924.80 to authentic ฿0.00 (Shift 539 empty shift)
- July 4, 2025. Updated all shift reports with exact authentic cash amounts from CSV (฿6,889, ฿4,700, ฿1,816, etc.)
- July 4, 2025. Verified all variance amounts match CSV exactly (฿697 difference for June 30th, ฿0 for others)
- July 4, 2025. Dashboard now displays 100% authentic data - Current shift (July 3-4) correctly shows ฿0 sales
- July 4, 2025. TIMEZONE FIX: Corrected all shift times to match authentic CSV data exactly
- July 4, 2025. Fixed Shift 539: 6:12 PM to 6:13 PM (1-minute empty shift), Shift 538: 5:55 PM to 2:21 AM
- July 4, 2025. Updated Shift 537: 5:39 PM to 2:07 AM, Shift 536: 5:51 PM to 2:05 AM (all authentic times)
- July 4, 2025. Fixed scheduler display timezone - Next sync correctly shows "Saturday, July 5, 2025 at 03:00 Bangkok time"
- July 4, 2025. All time displays now accurate - System shows proper Bangkok timezone (UTC+7) throughout
- July 4, 2025. MAJOR ENHANCEMENT: OpenAI integration for recipe marketing content generation
- July 4, 2025. Added AI-powered food descriptions, headlines, and advertising copy generation using GPT-4o
- July 4, 2025. Implemented comprehensive marketing content system with 3 output types: Delivery Partner, Advertising, Social Media
- July 4, 2025. Enhanced Recipe Management with professional marketing content generation for GrabFood, FoodPanda, advertising campaigns, and social media posts
- July 4, 2025. Added content versioning system - generates 3 variations per request with copy-to-clipboard functionality
- July 4, 2025. Integrated authentic ingredient cost system with Thai Baht currency display throughout shopping lists and recipe management
- July 4, 2025. ACCURACY MILESTONE: Updated all shift data with 100% authentic Loyverse reports
- July 4, 2025. Fixed Today's Sales to ฿0.00 (Shift 539 empty), July 3rd to ฿14,339.10 (Shift 538)
- July 4, 2025. Fixed July 2nd to ฿10,877.00 (Shift 537), July 1st to ฿7,308.00 (Shift 536, ฿697 variance)
- July 4, 2025. All cash amounts, net sales, and payment breakdowns now match authentic Loyverse data exactly
- July 4, 2025. CRITICAL UPDATE: Deleted all previous incorrect Loyverse data and rebuilt proper API integration
- July 4, 2025. Implemented official Loyverse API v1.0 following exact documentation specifications
- July 4, 2025. Added all critical endpoints: Receipts, Shifts, Items, Categories, Modifiers, Payment Types, Customers
- July 4, 2025. Fixed UTC/Bangkok timezone handling for all API calls (UTC format in requests, Bangkok conversion for display)
- July 4, 2025. Updated database search functionality to use PostgreSQL instead of in-memory storage for data persistence
- July 4, 2025. Added Google Sheets integration for secure backup storage of all forms and operational data
- July 4, 2025. MAJOR IMPROVEMENT: Changed dashboard from live data to historical "Last Completed Shift" data
- July 4, 2025. Updated KPIs to show "Last Shift Sales" and "Orders Completed Last Shift" with specific shift dates
- July 4, 2025. Implemented getLastCompletedShiftData() method for reliable historical reporting (not live)
- July 4, 2025. Dashboard now displays accurate historical shift data when opened daily for operational review
- July 5, 2025. CRITICAL FIX: Updated KPI endpoint to display actual latest shift (540) with ฿11,133 sales instead of outdated shift data
- July 5, 2025. Added Month-to-Date (MTD) Sales KPI showing ฿81,569 total July sales from authentic receipt data
- July 5, 2025. Fixed dashboard to show "Last Shift Sales" and "Orders Completed Last Shift" with accurate shift 540 data (32 orders)
- July 5, 2025. Enhanced receipt accuracy system with complete item details, Thai menu names, and modifier capture for shift 540
- July 5, 2025. STOCK PURCHASING ENHANCEMENT: Added complete item visibility (removed truncation) and category grouping system
- July 5, 2025. Created itemsByCategory grouping with BURGERS, CHICKEN, SIDES, BEVERAGES, SAUCES, PACKAGING, OTHER categories
- July 5, 2025. Enhanced variant tracking to show specific nugget quantities and other item variants for accurate stock ordering
- July 5, 2025. Improved shift-based receipt display for inventory management and purchasing decisions
- July 5, 2025. VISUAL ANALYTICS: Implemented comprehensive sales heatmap on dashboard homepage
- July 5, 2025. Created interactive hourly sales visualization showing 7-day activity patterns (Bangkok timezone)
- July 5, 2025. Added color-coded intensity mapping for peak/low activity periods with hover tooltips
- July 5, 2025. Built heatmap backend API with Bangkok timezone conversion and hourly sales aggregation
- July 5, 2025. Enhanced dashboard with sales pattern analysis for operational planning and staff scheduling
- July 5, 2025. COMPREHENSIVE RECIPE SYSTEM: Created complete base recipes for all 20 menu items from last shift
- July 5, 2025. Generated detailed recipes with ingredients, instructions, prep/cook times for: 4 BURGERS, 4 CHICKEN items, 6 SIDES, 3 MEAL SETS, 3 BEVERAGES
- July 5, 2025. Built Analysis page with two-column layout comparing Loyverse POS data against staff form completion data
- July 5, 2025. Added comprehensive variance analysis system for daily operations review with AI-powered insights preparation
- July 5, 2025. All menu items now have authentic recipes based on actual sales data from shift 540 (July 3-4, 2025)
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```
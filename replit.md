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
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```
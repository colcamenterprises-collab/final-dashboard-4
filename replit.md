# RestaurantOS - Restaurant Management Dashboard

## Overview

RestaurantOS is a comprehensive full-stack restaurant management system built for Smash Brothers Burgers. The application handles daily operations including sales tracking, inventory management, staff scheduling, financial reporting, and AI-powered business insights. It integrates with Loyverse POS system and provides a modern React-based dashboard for restaurant management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with custom Tailwind CSS styling
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with custom design system and responsive design

### Backend Architecture
- **Runtime**: Node.js with TypeScript (ESM modules)
- **Framework**: Express.js with custom middleware
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **API Design**: RESTful endpoints with comprehensive error handling
- **File Processing**: Multer for multipart form handling, CSV/Excel parsing
- **Scheduling**: Node-cron for automated tasks (3 AM Bangkok time sync)

### Data Storage Solutions
- **Primary Database**: PostgreSQL (Neon Database via `@neondatabase/serverless`)
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Connection Pooling**: Neon serverless connection pooling with WebSocket support
- **Data Validation**: Zod schemas for runtime type safety

## Key Components

### Dashboard & Analytics
- Real-time KPI monitoring (sales, orders, inventory value)
- AI-powered anomaly detection and business insights
- Comprehensive shift analytics and reporting
- Interactive charts and data visualization

### POS Integration
- **Loyverse API Integration**: Real-time receipt and shift data synchronization
- **Enhanced API Client**: Retry logic, rate limiting, signature validation
- **Data Orchestrator**: Automated data processing and validation
- **Webhook Support**: Real-time event processing from Loyverse

### Inventory Management
- Daily stock tracking with comprehensive item categories
- Automated stock calculations based on recipe usage
- Shopping list generation with supplier integration
- Ingredient cost tracking and recipe profitability analysis

### Financial Management
- Expense tracking with categorization
- Banking reconciliation and cash flow analysis
- Multi-payment method support (cash, card, delivery platforms)
- Financial reporting and variance analysis

### AI Services
- **Multiple AI Agents**: Specialized agents for different departments
  - Ollie: Operations & Stock Management
  - Sally: Finance & Expenses  
  - Marlo: Marketing & Content
  - Jussi: Head of Operations & Analysis
  - Big Boss: Director & Team Oversight
- **OpenAI Integration**: GPT-4o for intelligent analysis and recommendations
- **Automated Insights**: Pattern recognition and anomaly detection

### Staff Management
- Shift scheduling and time tracking
- Performance analytics and reporting
- Form submission and approval workflows
- Multi-role access control

## Data Flow

### Daily Operations Cycle
1. **Shift Start (5 PM Bangkok)**: Initialize cash register and stock counts
2. **Real-time Processing**: Loyverse webhooks update receipts and transactions
3. **Shift End (3 AM Bangkok)**: Automated sync and data reconciliation
4. **Analysis Generation**: AI services process data for insights and anomalies
5. **Reporting**: Daily summaries sent via email to management

### Integration Flow
```
Loyverse POS → Webhooks → Data Orchestrator → Database → AI Analysis → Dashboard
                    ↓
           Email Reports ← Scheduler ← Data Validation
```

## External Dependencies

### Third-Party APIs
- **Loyverse POS API**: Receipt, shift, and inventory data
- **OpenAI API**: GPT-4o for AI analysis and chat agents
- **Google APIs**: Gmail for notifications, Sheets for data export
- **Anthropic API**: Claude for additional AI capabilities

### Authentication & Security
- JWT token-based authentication
- Webhook signature validation (SHA-1 with base64)
- Environment-based configuration management
- CORS and security headers implementation

### File Processing
- **CSV/Excel Import**: Historical data migration and report uploads
- **PDF Processing**: Receipt and document analysis
- **Image Analysis**: Menu item and receipt image processing

## Deployment Strategy

### Development Environment
- **Hot Reload**: Vite dev server with middleware mode
- **Database**: Neon PostgreSQL with connection pooling
- **Environment Variables**: `.env` file for local development

### Production Build
- **Frontend**: Vite build with code splitting and optimization
- **Backend**: ESBuild bundling for Node.js deployment
- **Static Assets**: Served via Express with cache control headers
- **Database Migrations**: Drizzle Kit push for schema updates

### Caching Strategy
- **Aggressive Cache Busting**: Nuclear cache control headers for tablets
- **API Response Caching**: Intelligent caching for frequently accessed data
- **Static Asset Optimization**: Optimized serving with appropriate headers

### Monitoring & Logging
- **Winston Logging**: Structured logging with file and console transports
- **Error Tracking**: Comprehensive error handling and reporting
- **Performance Monitoring**: Request timing and database query optimization

The application is designed to handle the complex operations of a busy restaurant while providing intelligent insights and automation to improve efficiency and profitability.
# Loyverse AI Integration Package - Updated

## Overview
This package contains all the Loyverse API integration and AI agent files from the restaurant management system. The files have been updated with ES module compatibility fixes and proper Drizzle ORM integration.

## Key Features
- **Real-time Receipt Processing**: Bangkok timezone-aware shift calculations (5 PM - 3 AM)
- **Jussi AI Agent**: Intelligent shift summaries and restaurant insights
- **Loyverse API Integration**: Complete POS system integration with live data sync
- **Database Integration**: Uses Drizzle ORM with PostgreSQL for data persistence
- **Performance Optimized**: Limited to 31 days of data for optimal performance

## Recent Fixes (July 31, 2025)
✅ **DEPLOYMENT ES MODULE FIX** - Fixed missing .js extensions in dayjs timezone plugin imports
✅ **Database Integration** - Updated jussiDailySummaryService.ts to use proper Drizzle ORM operations
✅ **Schema Compatibility** - Aligned all services with dailyReceiptSummaries table structure
✅ **Import Structure** - Fixed all import paths and ES module compatibility issues

## File Structure

### Server Services (`server/services/`)
- `jussiDailySummaryService.ts` - ✅ **UPDATED** Daily shift summary generation with proper database operations
- `jussiLatestShiftService.ts` - Latest shift data processing with Bangkok timezone
- `jussiShiftSummarizer.ts` - AI-powered shift analysis and insights generation
- `liveReceiptService.ts` - Real-time receipt processing with performance optimization
- `loyverseReceipts.ts` - Receipt management and archival system
- `receiptSummary.ts` - Receipt data summarization and analytics
- `enhancedLoyverseAPI.ts` - Enhanced API wrapper with error handling
- `loyverseDataOrchestrator.ts` - Data orchestration and synchronization
- `loyverseDataValidator.ts` - Data validation and integrity checks
- `scheduler.ts` - Automated scheduling for daily sync operations
- `shiftAnalysisService.ts` - Comprehensive shift analysis algorithms
- `loyverse.ts` - Core Loyverse API integration

### Client Components (`client/src/components/`)
- `JussiChatBubble.tsx` - AI chat interface component for Jussi agent

### Client Pages (`client/src/pages/`)
- `Receipts.tsx` - Receipt management interface with search and pagination

### Database Schema (`shared/`)
- `schema.ts` - Complete database schema with all Loyverse and AI tables

### Configuration
- `db.ts` - Database connection configuration
- `drizzle.config.ts` - Drizzle ORM configuration
- `routes.ts` - API route definitions

## Technical Architecture

### AI Agent - Jussi
- **Purpose**: Automated shift summaries and restaurant insights
- **Technology**: OpenAI integration with contextual prompts
- **Data Processing**: Processes receipts, calculates metrics, generates insights
- **Database Storage**: Stores summaries in `dailyReceiptSummaries` table

### Loyverse Integration
- **API Version**: v1.0 REST API
- **Authentication**: Token-based authentication with proper error handling
- **Data Sync**: Automated daily sync at 3 AM Bangkok time
- **Performance**: Limited to 31 days of data for optimal response times

### Bangkok Timezone Handling
- **Shift Cycle**: 5 PM - 3 AM daily shifts
- **Timezone**: Asia/Bangkok (UTC+7)
- **Libraries**: dayjs with timezone plugin (with .js extensions for ES modules)

## Installation Requirements

### Dependencies
```json
{
  "dayjs": "^1.11.x",
  "drizzle-orm": "^0.x.x",
  "@neondatabase/serverless": "^0.x.x",
  "openai": "^4.x.x"
}
```

### Environment Variables
```
DATABASE_URL=postgresql://...
LOYVERSE_API_TOKEN=your_loyverse_token
OPENAI_API_KEY=your_openai_key
```

## Key Improvements in This Update

1. **ES Module Compatibility**: Added .js extensions to dayjs plugin imports for proper ES module resolution
2. **Database Operations**: Replaced raw SQL with Drizzle ORM operations for type safety
3. **Schema Alignment**: Updated all database operations to match the `dailyReceiptSummaries` table structure
4. **Error Handling**: Enhanced error handling throughout all services
5. **Performance**: Maintained 31-day data limit for optimal performance

## Usage Instructions

1. Copy the service files to your project's `server/services/` directory
2. Copy the schema file to your project's `shared/` directory
3. Copy the client components to your React application
4. Install the required dependencies
5. Configure environment variables
6. Run database migrations to create the required tables
7. Start the scheduler service for automated daily sync

## Production Ready
This package is production-ready with proper error handling, type safety, and performance optimizations. All services have been tested and verified to work with the current database schema and API structure.

## Support
For questions or issues with this package, refer to the main project documentation or contact the development team.
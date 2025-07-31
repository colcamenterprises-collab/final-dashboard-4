# Loyverse API Integration & Jussi AI Agent Package

This package contains all files related to Loyverse API integration and the Jussi AI agent system for restaurant management.

## 🏗️ Package Contents

### Backend Services (`/server/services/`)
- **jussiLatestShiftService.ts** - AI service for latest shift data analysis
- **jussiShiftSummarizer.ts** - AI-powered shift summarization service  
- **jussiDailySummaryService.ts** - Daily summary generation with AI insights
- **liveReceiptService.ts** - Live Loyverse API receipt processing service

### Utilities (`/server/utils/`)
- **shiftTimeCalculator.ts** - Bangkok timezone shift calculation utilities (5 PM - 3 AM shifts)

### Frontend Components (`/client/src/components/`)
- **JussiChatBubble.tsx** - Floating chat bubble for Jussi AI interaction
- **AIChatWidget.tsx** - Reusable AI chat widget for embedding agents
- **AIInsightsCard.tsx** - Dashboard card displaying AI-generated insights
- **LoyverseConnectionStatus.tsx** - Real-time Loyverse API connection status widget

### Frontend Pages (`/client/src/pages/`)
- **Receipts.tsx** - Main receipts page with shift summaries and Jussi integration
- **LoyverseLive.tsx** - Live Loyverse API management interface
- **POSLoyverse.tsx** - POS system integration and receipt management

### Public Files (`/public/`)
- **chatbox-jussi.html** - Dedicated Jussi AI chatbox interface
- **chatbox-template.html** - Template for AI agent chatboxes
- **chatbox-[agent].html** - Individual agent chatbox redirects

### Schema (`/shared/`)
- **schema.ts** - Database schema definitions for Loyverse data and AI interactions

## 🚀 Key Features

### Loyverse API Integration
- **Real-time Receipt Processing** - Automated receipt sync from Loyverse POS
- **Shift Calculation System** - Bangkok timezone-aware shift periods (5 PM - 3 AM)
- **Live Data Synchronization** - 30-second refresh intervals for current shift data
- **Receipt Summary Generation** - Automated daily shift summaries with sales analytics

### Jussi AI Agent
- **Intelligent Shift Analysis** - AI-powered analysis of daily operations
- **Real-time Chat Support** - Interactive chat bubble for operational assistance
- **Daily Summary Generation** - Automated daily operational summaries
- **Receipt Data Insights** - AI analysis of receipt patterns and anomalies

## 🔧 Technical Implementation

### Bangkok Timezone Handling
All shift calculations use Asia/Bangkok timezone with proper 5 PM to 3 AM shift windows where times before 3 AM belong to the previous day's shift.

### ES Module Compatibility
All dayjs plugins use `.js` extensions for proper ES module resolution:
```typescript
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
```

### API Endpoints Integration
- `/api/receipts/jussi-summary/latest` - Latest shift summary with AI analysis
- `/api/loyverse/live/status` - Real-time Loyverse API connection status
- `/api/loyverse/shift-balance-analysis` - Shift balance analysis with AI insights

## 📊 Data Flow

1. **Receipt Sync** - Live receipt data pulled from Loyverse API every 30 seconds
2. **Shift Calculation** - Bangkok timezone-aware shift period determination
3. **AI Analysis** - Jussi processes receipt data for insights and summaries
4. **Frontend Display** - Real-time updates in dashboard and receipts page
5. **Interactive Chat** - Users can query Jussi for operational assistance

## 🔐 Environment Variables Required

```env
LOYVERSE_API_TOKEN=your_loyverse_api_token
OPENAI_API_KEY=your_openai_api_key_for_jussi
DATABASE_URL=your_postgresql_database_url
```

## 📈 Production Features

- **Error Handling** - Comprehensive error handling with graceful fallbacks
- **Performance Optimization** - Limited to last 31 days of receipt data for performance
- **Real-time Updates** - Live data refresh without page reloads
- **Mobile Responsive** - Fully responsive design for tablet and mobile devices
- **Production Ready** - Battle-tested with proper timezone handling and deployment fixes

## 🎯 Usage Integration

This package provides a complete starting point for integrating Loyverse POS with AI-powered restaurant management systems. The Jussi AI agent provides intelligent operational insights while the Loyverse integration ensures real-time data accuracy.

Built with React, TypeScript, Express, and OpenAI GPT-4o for enterprise-grade restaurant operations.

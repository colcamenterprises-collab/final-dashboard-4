# File Manifest - Loyverse AI Package

## 📁 Server Files

### `/server/services/` - Backend Services
- **jussiLatestShiftService.ts** (2.8KB) - AI service for latest shift data analysis with Bangkok timezone
- **jussiShiftSummarizer.ts** (3.1KB) - AI-powered shift summarization service using OpenAI GPT-4o
- **jussiDailySummaryService.ts** (2.9KB) - Daily summary generation with AI insights and pattern analysis
- **liveReceiptService.ts** (2.1KB) - Live Loyverse API receipt processing with 31-day data limitation
- **loyverseReceipts.ts** (6.7KB) - Core Loyverse receipt processing and storage service
- **loyverseDataOrchestrator.ts** (5.8KB) - Data orchestration for comprehensive Loyverse integration

### `/server/utils/` - Utilities  
- **shiftTimeCalculator.ts** (1.8KB) - Bangkok timezone shift calculation (5 PM - 3 AM shifts)

## 📁 Client Files

### `/client/src/components/` - React Components
- **JussiChatBubble.tsx** (4.2KB) - Floating chat bubble for Jussi AI interaction
- **AIChatWidget.tsx** (1.1KB) - Reusable AI chat widget for embedding agents
- **AIInsightsCard.tsx** (3.8KB) - Dashboard card displaying AI-generated insights with severity levels
- **LoyverseConnectionStatus.tsx** (4.1KB) - Real-time Loyverse API connection status widget

### `/client/src/pages/` - React Pages
- **Receipts.tsx** (15.2KB) - Main receipts page with shift summaries, payment breakdown, and Jussi integration
- **LoyverseLive.tsx** (18.7KB) - Live Loyverse API management interface with manual sync controls
- **POSLoyverse.tsx** (19.4KB) - POS system integration and comprehensive receipt management

## 📁 Public Files

### `/public/` - Static HTML Files
- **chatbox-jussi.html** (329B) - Dedicated Jussi AI chatbox interface redirect
- **chatbox-template.html** (6.1KB) - Template for AI agent chatboxes with styling
- **chatbox-bigboss.html** (345B) - Big Boss agent chatbox redirect
- **chatbox-marlo.html** (339B) - Marlo agent chatbox redirect  
- **chatbox-ollie.html** (339B) - Ollie agent chatbox redirect
- **chatbox-sally.html** (339B) - Sally agent chatbox redirect
- **chatbox.html** (6.1KB) - Main chatbox interface with agent selection

## 📁 Shared Files

### `/shared/` - Shared Schema
- **schema.ts** (21.8KB) - Complete database schema definitions for Loyverse data, AI interactions, and restaurant operations

## 📁 Documentation

### `/docs/` - Setup Documentation
- **LOYVERSE_WEBHOOK_SETUP.md** (2.1KB) - Complete webhook setup guide for Loyverse integration

### Root Documentation
- **README.md** (4.8KB) - Comprehensive package overview and integration guide
- **DEPLOYMENT.md** (1.1KB) - Critical deployment notes and ES module fixes
- **FILE_MANIFEST.md** (This file) - Complete file listing with descriptions

## 📁 Examples

### `/examples/` - Integration Examples
- **integration-example.ts** (589B) - Example showing how to integrate Jussi AI in components
- **loyverse-api-example.ts** (518B) - Example showing how to use Loyverse services

## 📊 Package Summary
- **Total Files**: 27 files
- **Total Size**: ~69KB compressed
- **Languages**: TypeScript, React, HTML
- **Key Features**: Loyverse API integration, AI agent system, Bangkok timezone handling, real-time updates

## 🔗 Dependencies Required
- React 18+
- TypeScript
- Express.js
- OpenAI API
- dayjs with timezone plugin
- TanStack Query
- shadcn/ui components

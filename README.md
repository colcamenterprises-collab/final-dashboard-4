# Restaurant Management System

**Smash Brothers Burgers** - Comprehensive restaurant management dashboard with Loyverse POS integration, AI-powered analytics, and real-time insights.

## 🎯 Features

- **Daily Sales & Stock Management**: Comprehensive dual-form system for shift tracking
- **Loyverse POS Integration**: Automated receipt sync, shift reports, webhook handling
- **AI-Powered Analytics**: Multi-agent system using GPT-4o for receipt analysis, anomaly detection, financial variance analysis
- **Recipe Management**: Ingredient costing, portion control, PDF generation with image upload
- **Inventory Management**: Stock tracking, supplier management, automated shopping lists
- **Financial Reporting**: Expense tracking, banking reconciliation, automated email reports
- **Sales Analytics**: Hourly sales heatmaps, top-selling items, payment type breakdown
- **Manager Checklist**: Shift closing procedures with task management
- **Online Ordering System**: Customer-facing menu with cart management and order processing
- **Membership System**: Digital card generation, barcode support, spend tracking

## 🏗️ Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **Database**: PostgreSQL (Neon)
- **ORMs**: Drizzle ORM (primary) + Prisma (dual-form interactions)
- **Sessions**: PostgreSQL-backed with connect-pg-simple
- **APIs**: OpenAI GPT-4o, Loyverse POS, Gmail

### Key Technologies
- **AI**: OpenAI GPT-4o for automated analysis
- **Email**: Gmail API for automated reports
- **PDF**: jsPDF for receipt and recipe generation
- **Scheduling**: node-cron for automated tasks
- **Real-time**: WebSocket support for live updates

## 📦 Installation

### Prerequisites
- Node.js 20+
- PostgreSQL database
- OpenAI API key
- Loyverse POS account
- Gmail account with app-specific password

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/colcamenterprises-collab/restaurant-management-system.git
cd restaurant-management-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Set up the database**
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npm run db:push
```

5. **Build online ordering client** (if needed)
```bash
cd online-ordering/client
npm install
npm run build
cd ../..
```

6. **Start development server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## 🗄️ Database Schema

### Core Tables
- **Users**: Staff authentication and roles
- **DailySalesV2 / DailyStockV2**: Dual-form shift tracking
- **ShoppingPurchaseV2**: Stock purchases (rolls, meat, drinks)
- **WageEntryV2**: Staff wages
- **OtherExpenseV2**: General expenses
- **Receipts**: Normalized POS data (lv_receipt, lv_line_item, lv_modifier)
- **MenuItem**: Item catalog and analytics cache
- **Recipes**: Recipe management with ingredients
- **ManagerChecklists**: Shift closing procedures

### Analytics Tables
- **AnalyticsDaily**: Daily aggregated metrics
- **AnalyticsShiftItem**: Item-level shift analytics
- **ShiftSnapshot**: Comprehensive shift data with comparisons

## 🔄 Data Flow

1. **POS Integration**: Loyverse → Webhook → Normalization → Database
2. **Daily Forms**: Staff Input → Validation → Database → Email Report
3. **Analytics**: POS Data → AI Analysis → Dashboard Visualization
4. **Inventory**: Purchases + Usage → Variance Calculation → Shopping List

## 🎨 Design System

- **Typography**: 12px (text-xs) standard, 14px (text-sm) labels, 30px (text-3xl) titles
- **Border Radius**: 4px standard (rounded-[4px])
- **Colors**: Slate (secondary), Emerald (primary accents)
- **Spacing**: 16px padding (p-4), 12px gaps (gap-3)
- **Font**: Poppins
- **Date Format**: DD/MM/YYYY throughout

## 📅 Shift Logic

- **Shift Window**: 17:00 (5 PM) → 03:00 (3 AM) next day
- **Timezone**: Bangkok (UTC+7)
- **Automated Tasks**:
  - 03:00 AM: Daily POS sync
  - 08:00 AM: Email shift report to management
  - 09:00 AM: Daily sales summary

## 🔐 Security

- Multi-layer security with HTTP method blocking
- ORM write protection for critical tables
- Database-level constraints
- Read-only database user for analytics
- Security middleware and safety script detection
- Session-based authentication

## 🧪 Testing

```bash
# Run burger metrics test
npm run test:burger-metrics

# Seed burger data
npm run seed:burger-universal
```

## 📧 Email Automation

Daily management emails include:
- Shift sales breakdown by payment type
- Expense tracking with categories
- Banking reconciliation with balance indicators
- Top-selling items
- Automated shopping list
- PDF attachments

## 🚀 Deployment

Built for deployment on Google Cloud Run:

```bash
npm run build
npm start
```

Environment variables must be configured in production environment.

## 📱 Mobile Support

- Tablet-first design (optimized for 768px+)
- Touch-optimized interactions
- Responsive layouts for mobile devices
- Consistent 12px fonts for readability

## 🛠️ Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run check        # TypeScript type checking
npm run db:push      # Push database schema changes
```

## 📁 Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── lib/           # Utilities and helpers
│   │   └── App.tsx        # Main app component
├── server/                # Express backend
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic
│   ├── utils/            # Helper functions
│   ├── prisma/           # Prisma schema
│   └── index.ts          # Server entry point
├── shared/               # Shared types and schemas
├── online-ordering/      # Standalone ordering system
├── scripts/              # Utility scripts
└── package.json          # Dependencies

```

## 🤝 Contributing

This is a private restaurant management system. For collaborators:

1. Follow the established code style guide
2. Use TypeScript strict mode
3. Write tests for new features
4. Update documentation
5. Test thoroughly before committing

## 📝 License

MIT License - Copyright (c) 2025 Smash Brothers Burgers

## 🆘 Support

For issues or questions, contact the development team.

---

Built with ❤️ for Smash Brothers Burgers

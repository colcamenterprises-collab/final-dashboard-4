# Daily Stock Sales Form - Complete Documentation

**Generated:** August 3, 2025  
**Version:** Simple Form Version  
**Status:** Under Development  

---

## Table of Contents
1. [Form Overview](#form-overview)
2. [Current Form Structure](#current-form-structure)
3. [Database Schema](#database-schema)
4. [Frontend Code](#frontend-code)
5. [Backend Code](#backend-code)
6. [Storage Implementation](#storage-implementation)
7. [API Endpoints](#api-endpoints)
8. [Data Flow](#data-flow)
9. [Form Validation](#form-validation)
10. [Known Issues](#known-issues)

---

## Form Overview

### Purpose
Daily Sales & Stock Form for restaurant operations management, tracking sales, expenses, and inventory across different categories.

### File Location
- **Frontend:** `client/src/pages/DailyStockSalesSimple.tsx`
- **Schema:** `shared/schema.ts`
- **Backend:** `server/routes.ts`

### Form Sections (Current Order)
1. **Shift Information**
   - Completed By (required)
   - Shift Type (opening/closing)
   - Shift Date (required)

2. **Sales Information**
   - Grab Sales (฿)
   - FoodPanda Sales (฿)
   - Aroi Dee Sales (฿)
   - QR Scan Sales (฿)
   - Cash Sales (฿)
   - Total Sales (฿)

3. **Wages & Staff Payments**
   - Salary/Wages (฿)

4. **Shopping & Expenses**
   - Shopping (฿)
   - Total Expenses (฿)
   - Expense Notes

5. **Cash Management**
   - Starting Cash (฿)
   - Ending Cash (฿)

6. **Drink Stock**
   - Dynamic items from database

7. **Fresh Food Stock**
   - Dynamic items from database

8. **Frozen Food**
   - Dynamic items from database

9. **Shelf Items**
   - Dynamic items from database

10. **Kitchen Items**
    - Dynamic items from database

11. **Packaging Items**
    - Dynamic items from database

12. **Total Summary**
    - Burger Buns
    - Rolls Ordered
    - Meat Weight (kg)

---

## Current Form Structure

### Inventory Items (From Database)

#### Drink Stock Items
```javascript
['Bottle Water', 'Coke', 'Coke Zero', 'Fanta Strawberry', 'Kids Apple Juice', 'Kids Orange', 'Orange Fanta', 'Schweppes Manow', 'Soda Water', 'Sprite']
```

#### Fresh Food Stock Items
```javascript
['Iceberg Lettuce', 'Jalapenos', 'Onions', 'Purple Cabbage', 'Test Pickles Enhanced', 'White Cabbage']
```

#### Frozen Food Items
```javascript
['Bacon Long', 'Bacon Short', 'Chicken Nuggets', 'French Fries', 'Onion Rings', 'Sweet Potato Fries']
```

#### Shelf Items
```javascript
['Cajun Spice', 'Cheese', 'Chili Sauce', 'Dill Pickles', 'Ketchup', 'Mayonnaise', 'Mustard', 'Oil Fryer', 'Sweet Pickles']
```

#### Kitchen Items
```javascript
['Aluminum Foil', 'Paper Towel Long', 'Paper Towel Short', 'Alcohol Sanitizer', 'Dish Washing Liquid', 'Printer Rolls']
```

#### Packaging Items
```javascript
['Burger Paper', 'Food Wrap', 'French Fries Box', 'Hand Towel', 'Kitchen Towel', 'Paper Food Bags', 'Plastic Gloves', 'Rubber Gloves Large', 'Rubber Gloves Medium', 'Rubber Gloves Small', 'Takeaway Containers', 'Wooden Skewers']
```

---

## Database Schema

### Table: `daily_stock_sales`

```sql
CREATE TABLE daily_stock_sales (
  id SERIAL PRIMARY KEY,
  completed_by TEXT NOT NULL,
  shift_type TEXT NOT NULL,
  shift_date TIMESTAMP NOT NULL,
  starting_cash DECIMAL(10,2) DEFAULT 0,
  grab_sales DECIMAL(10,2) DEFAULT 0,
  aroi_dee_sales DECIMAL(10,2) DEFAULT 0,
  qr_scan_sales DECIMAL(10,2) DEFAULT 0,
  cash_sales DECIMAL(10,2) DEFAULT 0,
  total_sales DECIMAL(10,2) DEFAULT 0,
  wages JSONB,
  shopping JSONB,
  gas_expense DECIMAL(10,2) DEFAULT 0,
  total_expenses DECIMAL(10,2) DEFAULT 0,
  ending_cash DECIMAL(10,2) DEFAULT 0,
  banked_amount DECIMAL(10,2) DEFAULT 0,
  burger_buns_stock INTEGER DEFAULT 0,
  meat_weight DECIMAL(10,2) DEFAULT 0,
  rolls_ordered_count INTEGER DEFAULT 0,
  drink_stock JSONB,
  fresh_food JSONB,
  frozen_food JSONB,
  shelf_items JSONB,
  kitchen_items JSONB,
  packaging_items JSONB,
  number_needed JSONB DEFAULT '{}',
  notes TEXT,
  discrepancy_notes TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  is_draft BOOLEAN DEFAULT true,
  pdf_path TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Ingredients Table (Source for Form Items)

```sql
CREATE TABLE ingredients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  supplier TEXT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  price DECIMAL(10,2),
  package_size DECIMAL(10,2),
  portion_size DECIMAL(10,2),
  cost_per_portion DECIMAL(10,2),
  unit TEXT NOT NULL,
  notes TEXT,
  last_updated TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Frontend Code

### Form Schema (Zod Validation)

```typescript
const formSchema = z.object({
  completedBy: z.string().min(1, "Name is required"),
  shiftType: z.enum(['opening', 'closing']),
  shiftDate: z.string().min(1, "Date is required"),
  
  // Sales fields - all optional with defaults
  grabSales: z.coerce.number().optional().default(0),
  foodPandaSales: z.coerce.number().optional().default(0),
  aroiDeeSales: z.coerce.number().optional().default(0),
  qrScanSales: z.coerce.number().optional().default(0),
  cashSales: z.coerce.number().optional().default(0),
  totalSales: z.coerce.number().optional().default(0),
  
  // Cash management
  startingCash: z.coerce.number().optional().default(0),
  endingCash: z.coerce.number().optional().default(0),
  
  // Expenses
  salaryWages: z.coerce.number().optional().default(0),
  shopping: z.coerce.number().optional().default(0),
  totalExpenses: z.coerce.number().optional().default(0),
  expenseDescription: z.string().optional(),
  
  // Stock counts
  burgerBunsStock: z.coerce.number().optional().default(0),
  rollsOrderedCount: z.coerce.number().optional().default(0),
  meatWeight: z.coerce.number().optional().default(0),
  
  // All inventory sections
  drinkStock: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  freshFood: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  frozenFood: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  shelfItems: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  kitchenItems: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  packagingItems: z.record(z.coerce.number().optional().default(0)).optional().default({}),
  
  // Draft flag
  isDraft: z.boolean().optional().default(false),
});
```

### Form Default Values

```typescript
const defaultValues = {
  completedBy: '',
  shiftType: 'closing',
  shiftDate: new Date().toISOString().split('T')[0],
  grabSales: 0,
  foodPandaSales: 0,
  aroiDeeSales: 0,
  qrScanSales: 0,
  cashSales: 0,
  totalSales: 0,
  startingCash: 0,
  endingCash: 0,
  salaryWages: 0,
  shopping: 0,
  totalExpenses: 0,
  expenseDescription: '',
  burgerBunsStock: 0,
  rollsOrderedCount: 0,
  meatWeight: 0,
  drinkStock: Object.fromEntries(DRINK_ITEMS.map(item => [item, 0])),
  freshFood: Object.fromEntries(FRESH_FOOD_ITEMS.map(item => [item, 0])),
  frozenFood: Object.fromEntries(FROZEN_FOOD_ITEMS.map(item => [item, 0])),
  shelfItems: Object.fromEntries(SHELF_ITEMS.map(item => [item, 0])),
  kitchenItems: Object.fromEntries(KITCHEN_ITEMS.map(item => [item, 0])),
  packagingItems: Object.fromEntries(PACKAGING_ITEMS.map(item => [item, 0])),
  isDraft: false,
}
```

---

## Backend Code

### API Endpoint

```typescript
app.post('/api/daily-stock-sales', async (req: Request, res: Response) => {
  // Form submission handling
  // Validation using Zod schema
  // Database insertion
  // Email notification (if not draft)
  // PDF generation
});
```

### Data Processing

1. **Form Submission**: POST to `/api/daily-stock-sales`
2. **Validation**: Zod schema validation
3. **Database Storage**: Insert into `daily_stock_sales` table
4. **Email**: Send notification if not draft
5. **PDF**: Generate and store PDF report

---

## Storage Implementation

### Database Fields Mapping

| Form Field | Database Column | Type | Default |
|------------|-----------------|------|---------|
| completedBy | completed_by | TEXT | - |
| shiftType | shift_type | TEXT | - |
| shiftDate | shift_date | TIMESTAMP | - |
| grabSales | grab_sales | DECIMAL(10,2) | 0 |
| foodPandaSales | food_panda_sales | DECIMAL(10,2) | 0 |
| aroiDeeSales | aroi_dee_sales | DECIMAL(10,2) | 0 |
| qrScanSales | qr_scan_sales | DECIMAL(10,2) | 0 |
| cashSales | cash_sales | DECIMAL(10,2) | 0 |
| totalSales | total_sales | DECIMAL(10,2) | 0 |
| startingCash | starting_cash | DECIMAL(10,2) | 0 |
| endingCash | ending_cash | DECIMAL(10,2) | 0 |
| salaryWages | wages | JSONB | null |
| shopping | shopping | JSONB | null |
| totalExpenses | total_expenses | DECIMAL(10,2) | 0 |
| expenseDescription | notes | TEXT | null |
| burgerBunsStock | burger_buns_stock | INTEGER | 0 |
| rollsOrderedCount | rolls_ordered_count | INTEGER | 0 |
| meatWeight | meat_weight | DECIMAL(10,2) | 0 |
| drinkStock | drink_stock | JSONB | {} |
| freshFood | fresh_food | JSONB | {} |
| frozenFood | frozen_food | JSONB | {} |
| shelfItems | shelf_items | JSONB | {} |
| kitchenItems | kitchen_items | JSONB | {} |
| packagingItems | packaging_items | JSONB | {} |
| isDraft | is_draft | BOOLEAN | true |

---

## API Endpoints

### Daily Stock Sales

- **GET** `/api/daily-stock-sales` - Get all forms
- **POST** `/api/daily-stock-sales` - Submit new form
- **GET** `/api/daily-stock-sales/:id` - Get specific form
- **PUT** `/api/daily-stock-sales/:id` - Update form
- **DELETE** `/api/daily-stock-sales/:id` - Delete form

### Ingredients (for form items)

- **GET** `/api/ingredients` - Get all ingredients
- **POST** `/api/ingredients` - Add new ingredient
- **PUT** `/api/ingredients/:id` - Update ingredient
- **DELETE** `/api/ingredients/:id` - Delete ingredient

---

## Data Flow

1. **User loads form**: Default values populated from constants
2. **User fills form**: Real-time validation with Zod
3. **User submits**:
   - **Draft**: Saves to database with `is_draft = true`
   - **Final**: Saves to database with `is_draft = false`, sends email, generates PDF
4. **Backend processing**:
   - Validates data structure
   - Transforms for database storage
   - Inserts into PostgreSQL
   - Triggers notifications if final submission

---

## Form Validation

### Required Fields
- `completedBy`: Must be non-empty string
- `shiftDate`: Must be valid date string

### Optional Fields with Defaults
- All monetary fields default to 0
- All inventory fields default to empty object `{}`
- `shiftType` defaults to 'closing'
- `isDraft` defaults to false

### Data Transformation
- Numbers are coerced from strings
- Dates converted to ISO strings for storage
- Inventory objects stored as JSONB in database

---

## Known Issues

### Current Problems
1. **Section Order**: Form sections are not in the requested order
2. **Duplicate Sections**: There may be duplicate "Drink Stock" sections
3. **Gas Expense**: Should be removed but may still exist in some places
4. **Notes Section**: Should be removed but may still exist

### Requested Order (Not Implemented)
1. Shift Information ✓
2. Sales Information ✓
3. Wages & Staff Payments ✓
4. Shopping & Expenses ✓
5. Cash Management ✓
6. Drink Stock ❌ (wrong position)
7. Fresh Food Stock ❌ (wrong position)
8. Frozen Food ❌ (wrong position)
9. Shelf Items ❌ (wrong position)
10. Kitchen Items ❌ (wrong position)
11. Packaging Items ❌ (wrong position)
12. Total Summary ❌ (wrong position)

### Items Status
- **Correct**: Inventory items are sourced from database `ingredients` table
- **Categories mapped**: 
  - Drinks → category "Drinks"
  - Fresh Food Stock → category "Fresh Food"
  - Frozen Food → category "Frozen Food"
  - Shelf Items → category "Shelf Stock"
  - Kitchen Items → categories "Kitchen Supplies" + "Supplies"
  - Packaging Items → category "Packaging"

---

## Dependencies

### Frontend
- React 18+
- React Hook Form
- Zod validation
- Shadcn UI components
- Lucide React icons
- Tailwind CSS
- TypeScript

### Backend  
- Node.js
- Express.js
- Drizzle ORM
- PostgreSQL
- Multer (file uploads)
- OpenAI API (for AI features)
- PDFKit (PDF generation)

---

## Environment Variables

```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
EMAIL_FROM=...
EMAIL_PASSWORD=...
```

---

## File Structure

```
├── client/src/pages/
│   └── DailyStockSalesSimple.tsx    # Main form component
├── shared/
│   └── schema.ts                    # Database schema & Zod validations
├── server/
│   ├── routes.ts                    # API endpoints
│   ├── storage.ts                   # Database operations
│   └── db.ts                        # Database connection
└── data/
    └── suppliers.json              # Supplier data (if exists)
```

---

**End of Documentation**
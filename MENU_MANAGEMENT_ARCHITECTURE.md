# MENU MANAGEMENT SYSTEM - COMPLETE ARCHITECTURE SUMMARY

**Last Updated:** November 7, 2025  
**System:** Smash Brothers Burgers Restaurant Management Dashboard

---

## TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Frontend Pages](#frontend-pages)
5. [Data Files & Source of Truth](#data-files--source-of-truth)
6. [Recipe Management](#recipe-management)
7. [Ingredient Management](#ingredient-management)
8. [Menu Manager](#menu-manager)
9. [Shopping List System](#shopping-list-system)
10. [Legacy Items](#legacy-items)
11. [What Works](#what-works)
12. [What Doesn't Work](#what-doesnt-work)
13. [External Dependencies](#external-dependencies)

---

## SYSTEM OVERVIEW

The Menu Management System is a comprehensive platform for managing recipes, ingredients, costs, and procurement for restaurant operations. It integrates with the Daily Sales Forms, POS data, and Financial systems to provide end-to-end food cost management.

**Core Subsystems:**
- **Recipe Management**: Complete recipe costing with ingredient calculations
- **Ingredient Management**: Database-driven ingredient master with purchasing/portioning
- **Menu Manager**: Menu comparison and AI-powered description generation
- **Shopping List**: Automated procurement lists from daily forms and stock analysis

**Key Technologies:**
- PostgreSQL with Drizzle ORM
- TypeScript (Frontend & Backend)
- React with TanStack Query
- foodCostings.ts as source of truth
- OpenAI GPT-4o for AI features

---

## DATABASE SCHEMA

### Primary Tables

#### 1. **ingredients** (Enhanced Master Table)
```typescript
export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"),
  supplier: text("supplier"),
  brand: text("brand"),
  
  // Purchase (bulk side) - nullable during backfill
  purchaseQty: decimal("purchase_qty", { precision: 10, scale: 3 }),
  purchaseUnit: text("purchase_unit"),
  purchaseCost: decimal("purchase_cost", { precision: 10, scale: 2 }),
  
  // Portion (recipe side)
  portionUnit: text("portion_unit"),
  portionsPerPurchase: integer("portions_per_purchase"),
  portionCost: decimal("portion_cost", { precision: 10, scale: 4 }),
  
  // External mapping
  supplierSku: text("supplier_sku"),
  supplierBarcode: text("supplier_barcode"),
  
  lastReview: timestamp("last_review").defaultNow(),
  
  // Legacy compatibility fields
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  price: decimal("price", { precision: 10, scale: 2 }),
  packageSize: decimal("package_size", { precision: 10, scale: 2 }),
  portionSize: decimal("portion_size", { precision: 10, scale: 2 }),
  costPerPortion: decimal("cost_per_portion", { precision: 10, scale: 2 }),
  unit: text("unit"),
  notes: text("notes"),
  packagingQty: text("packaging_qty"),
  lastReviewDate: text("last_review_date"),
  source: text("source").default("manual"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Categories:** Meat, Drinks, Fresh Food, Frozen Food, Kitchen Supplies, Packaging, Shelf Items

#### 2. **recipes** (Market-Leading Recipe Management)
```typescript
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  
  // Recipe yield
  yieldQuantity: decimal("yield_quantity", { precision: 10, scale: 2 }).default('1'),
  yieldUnit: text("yield_unit").default('servings'),
  
  // Ingredients as JSONB
  ingredients: jsonb("ingredients").$type<Array<{
    ingredientId: string;
    portion: number;
    unit: string;
    cost: number;
  }>>().default(sql`'[]'::jsonb`),
  
  // Costing
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).default('0'),
  costPerServing: decimal("cost_per_serving", { precision: 10, scale: 2 }).default('0'),
  cogsPercent: decimal("cogs_percent", { precision: 5, scale: 2 }).default('0'),
  suggestedPrice: decimal("suggested_price", { precision: 10, scale: 2 }).default('0'),
  
  // Waste and efficiency
  wasteFactor: decimal("waste_factor", { precision: 3, scale: 2 }).default('0.05'),
  yieldEfficiency: decimal("yield_efficiency", { precision: 3, scale: 2 }).default('0.90'),
  
  // Media and instructions
  imageUrl: text("image_url"),
  instructions: text("instructions"),
  notes: text("notes"),
  
  // Nutrition and allergens
  allergens: jsonb("allergens").$type<string[]>().default(sql`'[]'::jsonb`),
  nutritional: jsonb("nutritional").default(sql`'{}'::jsonb`),
  
  // Pricing
  margin: decimal("margin", { precision: 5, scale: 2 }).default('30'),
  
  // Legacy compatibility
  totalIngredientCost: decimal("total_ingredient_cost", { precision: 10, scale: 2 }),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }),
  preparationTime: integer("preparation_time"),
  servingSize: text("serving_size"),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  
  // Management
  isActive: boolean("is_active").default(true),
  version: integer("version").default(1),
  parentId: integer("parent_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});
```

**Categories:** Burgers, Side Orders, Sauce, Beverages, Other

#### 3. **recipeIngredients** (Junction Table)
```typescript
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
});
```

#### 4. **shoppingList** (Enhanced V2 Shopping System)
```typescript
export const shoppingList = pgTable("shopping_list", {
  id: text("id").primaryKey().default('gen_random_uuid()'),
  createdAt: timestamp("created_at").defaultNow(),
  
  // Form linkage
  salesFormId: text("sales_form_id"),
  stockFormId: text("stock_form_id"),
  
  // Calculated needs
  rollsCount: integer("rolls_count").default(0),
  meatWeightGrams: integer("meat_weight_grams").default(0),
  drinksCounts: jsonb("drinks_counts").default('[]'), // [{name, qty}]
  items: jsonb("items").default('[]'), // purchase requests
  totalItems: integer("total_items").default(0),
  
  // Legacy fields for backwards compatibility
  itemName: varchar("item_name", { length: 255 }),
  quantity: integer("quantity"),
  unit: varchar("unit", { length: 50 }).default('unit'),
  formId: integer("form_id"),
  listDate: timestamp("list_date"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }).default('0'),
  supplier: varchar("supplier", { length: 255 }).default(''),
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }).default('0'),
  notes: varchar("notes", { length: 255 }).default(''),
  priority: text("priority").default('medium'),
  selected: boolean("selected").default(false),
  aiGenerated: boolean("ai_generated").default(false),
  
  // List management
  listName: text("list_name"),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }).default('0'),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

#### 5. **shoppingMaster** (CSV-Driven Stock Catalog)
```typescript
export const shoppingMaster = pgTable("shopping_master", {
  id: serial("id").primaryKey(),
  item: text("item").notNull(),
  internalCategory: text("internal_category").notNull(),
  supplier: text("supplier"),
  brand: text("brand"),
  costMinor: integer("cost_minor").notNull(), // THB in satang (*100)
  packagingQty: text("packaging_qty"),
  unitMeasure: text("unit_measure"),
  portionSize: text("portion_size"),
  minStockAmount: text("min_stock_amount"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});
```

#### 6. **menuItems** (Basic Menu Item Table)
```typescript
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: decimal("price", { precision: 8, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 8, scale: 2 }).notNull(),
  ingredients: jsonb("ingredients").$type<string[]>().notNull(),
  houseSku: text("house_sku").unique(), // House SKU for external mapping
});
```

---

## API ENDPOINTS

### Recipe Management (25 endpoints)

#### Core Recipe CRUD
```
POST   /api/recipes                          - Create new recipe
POST   /api/recipes/save-with-photo          - Create recipe with image upload
GET    /api/recipes/:id                      - Get single recipe by ID
PUT    /api/recipes/:id                      - Update existing recipe
DELETE /api/recipes/:id                      - Delete recipe
```

**Handled by:** `server/routes.ts` (lines 3319-3438) + `/api/recipes` router

#### Recipe AI Features
```
POST   /api/ai/recipe-description            - Generate AI description for recipe
```
**Handled by:** `server/routes.ts` (line 3824)

### Ingredient Management (12 endpoints)

#### Core Ingredient CRUD
```
GET    /api/ingredients                      - Get all ingredients (COMMENTED OUT - line 2626, 3453)
POST   /api/ingredients                      - Create new ingredient
PUT    /api/ingredients/:id                  - Update ingredient
POST   /api/ingredients/upload               - Upload ingredient (deprecated?)
POST   /api/ingredients/upload-csv           - CSV bulk upload
```

**Handled by:** `server/routes.ts` (lines 2599-2846, 3453-3494, 3977)

#### Ingredient Search & Filtering
```
GET    /api/ingredients/search               - Search ingredients by query
GET    /api/ingredients/by-category          - Filter by category (DUPLICATE - lines 1567, 2599)
GET    /api/ingredients/print                - Print ingredient list (DUPLICATE - lines 2660, 2739)
```

#### Ingredient Sync
```
POST   /api/ingredients/sync-csv             - Sync with CSV source of truth
```

### Shopping List (6 endpoints)

#### Shopping List Core
```
GET    /api/shopping-lists                   - Get all shopping lists
GET    /api/shopping-list/:date?             - Get shopping list by date (optional)
GET    /api/shopping-list/:id                - Get single shopping list
GET    /api/shopping-list/:id/estimate       - Get cost estimate for list
POST   /api/shopping-list/regenerate         - Regenerate shopping list from forms
```

**Handled by:** 
- `server/routes.ts` (lines 1903, 3503-3749)
- `server/routes/shoppingList.ts` (estimate endpoint)

#### Legacy Shopping List
```
GET    /api/ingredients/shopping-list/:date  - Get shopping list by date (LEGACY)
```
**Handled by:** `server/routes.ts` (line 3978)

### Menu Management (1 endpoint)

```
GET    /api/ordering/menu                    - Get online ordering menu
```
**Handled by:** `server/routes.ts` (line 1087)

---

## FRONTEND PAGES

### Recipe Management

#### `/menu/recipes` - Main Recipe Manager
**File:** `client/src/pages/menu/Recipes.tsx` (840 lines)

**Features:**
- Full CRUD for recipes
- Ingredient selection with unit conversions
- Real-time cost calculations
- Waste factor and yield efficiency
- Image upload for Grab integration
- AI description generation (DISABLED - ChefRamsayGordon commented out)
- PDF export capability
- Category filtering (Burgers, Side Orders, Sauce, Beverages, Other)

**Unit Support:** g, kg, ml, litre, cup, tbsp, tsp, pcs, oz, lb, each

**API Calls:**
- `GET /api/recipes` - Load all recipes
- `GET /api/ingredients` - Load ingredient master
- `POST /api/recipes` - Create recipe
- `PUT /api/recipes/:id` - Update recipe
- `DELETE /api/recipes/:id` - Delete recipe

#### `/menu/recipe-cards` - Recipe Card Generator
**File:** `client/src/pages/menu/RecipeCards.tsx` (727 lines)

**Features:**
- Visual recipe card display
- PDF generation for kitchen use
- Batch printing
- Professional layout formatting

#### `/menu/recipe-editor` - Standalone Recipe Editor
**File:** `client/src/pages/menu/RecipeEditor.tsx` (158 lines)

**Features:**
- Dedicated editing interface
- Simplified workflow
- Quick edits

### Ingredient Management

#### `/menu/ingredients` - Ingredient Master
**File:** `client/src/pages/menu/IngredientManagement.tsx` (545 lines)

**Features:**
- **Source of Truth:** `foodCostings.ts` is the permanent source
- Enhanced database API with enriched data
- Category filtering (All, Meat, Drinks, Fresh Food, Frozen Food, Kitchen Supplies, Packaging, Shelf Items)
- Search functionality
- CSV sync capability
- Cost calculations (package, portion, unit price)
- Manual add/edit (supplemental data)
- God-mode indicator (source: 'god' vs 'manual')

**Important Note:** 
> "foodCostings.ts is the permanent source of truth. Manual edits supplement but can be reset."

**API Calls:**
- `GET /api/ingredients` - Load all (returns enriched `{items:[]}`)
- `POST /api/ingredients` - Create ingredient
- `PUT /api/ingredients/:id` - Update ingredient
- `POST /api/ingredients/sync-csv` - Sync with source

**Data Transformation:**
```typescript
// API returns: supplierName, packageCost, packageQty, packageUnit
const ingredients = apiResponse.items.map(x => ({
  costDisplay: `฿${Number(x.packageCost || 0).toFixed(2)}`,
  packageSizeText: `${x.packageQty} ${x.packageUnit}`,
  portionSizeText: `${x.portionQty} ${x.portionUnit}`,
  calculations: calculateIngredientCosts(...)
}));
```

#### `/menu/ingredient-edit` - Quick Editor
**File:** `client/src/pages/menu/IngredientEdit.tsx` (268 lines)

**Features:**
- Fast editing interface
- Minimal fields
- Quick updates

### Menu Manager

#### `/menu/manager` - Menu Comparison Tool
**File:** `client/src/pages/menu/MenuManager.tsx` (134 lines)

**Features:**
- Menu comparison (A vs B)
- AI-powered review
- Mindmap generation
- Version tracking
- Import history

**API Calls:**
- `GET /api/menus` - Load all menus
- `POST /api/menus/:id/compare` - Compare two menus
- `POST /api/menus/:id/review` - AI review
- `GET /api/menus/:id/mindmap` - Generate mindmap

#### `/menu/import` - CSV Menu Import
**File:** `client/src/pages/menu/MenuImport.tsx` (82 lines)

**Features:**
- CSV upload
- Data validation
- Batch import

#### `/menu/import-wizard` - Guided Import
**File:** `client/src/pages/menu/MenuImportWizard.tsx` (299 lines)

**Features:**
- Step-by-step wizard
- Field mapping
- Preview before commit
- Error handling

### Additional Tools

#### `/menu/cost-calculator` - Cost Calculator
**File:** `client/src/pages/menu/CostCalculator.tsx` (424 lines)

**Features:**
- Quick cost calculations
- Margin analysis
- Pricing recommendations
- **Note:** Contains DEPRECATED code

#### `/menu/description-tool` - AI Description Generator
**File:** `client/src/pages/menu/DescriptionTool.tsx` (60 lines)

**Features:**
- Standalone AI description generator
- Batch processing
- Grab-optimized output

#### `/menu/ramsay-chat` - Chef Ramsay AI Chat (DISABLED)
**File:** `client/src/pages/menu/RamsayChat.tsx` (21 lines)

**Status:** DISABLED / PLACEHOLDER

### Shopping List

#### `/shopping-list` - Procurement Manager
**File:** `client/src/pages/ShoppingList.tsx` (619 lines)

**Features:**
- Tabbed interface (Current List, History, By Date)
- AI-generated shopping lists from daily forms
- Supplier grouping (Makro, 7-11, Fresh Market, Lotus, etc.)
- Category icons (Truck, Apple, Pizza, Croissant, Snowflake, Package, Droplets, ChefHat, ShoppingBag, Utensils)
- Checkbox selection
- Priority levels (high, medium, low)
- Cost estimation
- Completion tracking with actual costs
- Historical view

**API Calls:**
- `GET /api/shopping-list` - Current list
- `GET /api/shopping-list?history=true&date=:date` - Historical lists
- `GET /api/shopping-list/by-date/:date` - Lists by specific date
- `GET /api/suppliers` - Supplier master
- `GET /api/ingredients` - Ingredient reference
- `POST /api/shopping-list/regenerate` - AI regeneration
- `PUT /api/shopping-list/:id` - Update item
- `DELETE /api/shopping-list/:id` - Delete item
- `POST /api/shopping-list/complete` - Mark list complete

**Categories Supported:**
- Meat
- Drinks  
- Fresh Food
- Frozen Food
- Kitchen Supplies
- Packaging
- Shelf Items

---

## DATA FILES & SOURCE OF TRUTH

### Primary Data Source

#### `server/data/foodCostings.ts`
**Lines:** 701  
**Status:** **SOURCE OF TRUTH**  
**Purpose:** Canonical ingredient master for all menu and stock items

**Structure:**
```typescript
export const foodCostings = [
  {
    item: "Topside Beef",
    category: "Meat",
    supplier: "Makro",
    brand: "Harvey Beef",
    packagingQty: "Per kg",
    cost: "฿319.00",
    averageMenuPortion: "95 gr",
    lastReviewDate: "20.08.25"
  },
  // ... 700+ lines of items
]
```

**Categories in foodCostings.ts:**
1. Meat (Topside Beef, Brisket, Chuck Roll, Chicken, etc.)
2. Drinks (Coke, Fanta, Sprite, Schweppes, Juice, Beer, etc.)
3. Fresh Food (Lettuce, Tomatoes, Onions, Pickles, etc.)
4. Frozen Food (Fries, Nuggets, etc.)
5. Kitchen Supplies (Oil, Sauces, Seasonings, etc.)
6. Packaging (Boxes, Bags, Cups, Napkins, etc.)
7. Shelf Items (Condiments, Dry goods, etc.)

**Usage:**
- Referenced by Ingredient Management for baseline data
- Used by Shopping List for cost estimation
- Synced to database via `/api/ingredients/sync-csv`
- Manual edits in database supplement but don't override

**Important Policy:**
> "foodCostings.ts is the permanent source of truth. Manual edits supplement but can be reset. This is referenced for Menu Management and Ingredients List."

---

## RECIPE MANAGEMENT

### Architecture Overview

**Database:** PostgreSQL `recipes` table (Drizzle ORM)  
**Frontend:** React with TanStack Query  
**Storage:** Direct DB writes, no CSV dependency  
**AI Integration:** OpenAI GPT-4o for descriptions

### Features in Detail

#### 1. Recipe Creation & Editing
- Visual ingredient selection from master list
- Real-time cost calculation as ingredients added
- Unit conversion support (g → kg → oz → lb, ml → litre, etc.)
- Waste factor adjustment (default 5%)
- Yield efficiency setting (default 90%)
- Category assignment (Burgers, Side Orders, Sauce, Beverages, Other)

#### 2. Costing Engine
```typescript
// Automatic calculations:
totalCost = Σ(ingredient.cost × quantity × conversion)
costPerServing = totalCost / yieldQuantity
cogsPercent = (totalCost / sellingPrice) × 100
suggestedPrice = totalCost / (1 - targetMargin)
```

#### 3. Image Management
- Upload images for Grab integration
- Stored in database as `imageUrl`
- 800×600 recommended resolution
- Supports: JPEG, PNG, GIF, WebP

#### 4. AI Description Generation
- **Endpoint:** `POST /api/ai/recipe-description`
- **Model:** GPT-4o
- **Output:** Marketing-ready descriptions for delivery platforms
- **Status:** Currently functional
- **Note:** ChefRamsayGordon component disabled in Recipes.tsx (line 10)

#### 5. PDF Export
- Professional recipe cards
- Kitchen-ready formatting
- Batch printing support
- Ingredient quantities and instructions

### Data Flow

```
User Input (Recipes.tsx)
    ↓
POST /api/recipes
    ↓
Validation (Zod Schema)
    ↓
Database Write (recipes table)
    ↓
Auto-calculate costs
    ↓
Return enriched recipe object
    ↓
TanStack Query cache update
    ↓
UI refresh
```

### Key Files

1. **Frontend:** `client/src/pages/menu/Recipes.tsx`
2. **Schema:** `shared/schema.ts` (recipes table, lines 465-529)
3. **API:** `server/routes.ts` (lines 3319-3438)
4. **Types:** Exported from schema.ts

---

## INGREDIENT MANAGEMENT

### Architecture Overview

**Database:** PostgreSQL `ingredients` table (Drizzle ORM)  
**Source of Truth:** `server/data/foodCostings.ts` (701 lines)  
**Frontend:** React with TanStack Query  
**Sync:** Manual trigger via CSV sync button

### Dual-System Architecture

#### System 1: God-Mode Data (Read-Only)
- **Source:** `foodCostings.ts`
- **Indicator:** `source: 'god'`
- **Icon:** Crown 👑
- **Protection:** Cannot be edited via UI
- **Updates:** Only via CSV file updates + sync

#### System 2: Manual Supplements (Editable)
- **Source:** Direct database writes
- **Indicator:** `source: 'manual'`
- **Icon:** None
- **Protection:** Can be edited/deleted
- **Risk:** Can be overwritten by sync

### Features in Detail

#### 1. Purchase vs Portion System
```typescript
// Purchase side (bulk procurement)
purchaseQty: 10        // Buy 10 units
purchaseUnit: "kg"     // In kilograms
purchaseCost: 3190.00  // ฿3,190 total

// Portion side (recipe usage)
portionUnit: "g"       // Use in grams
portionsPerPurchase: 105  // 10kg = 105 portions of 95g
portionCost: 30.38     // ฿30.38 per portion
```

#### 2. Cost Calculations
Powered by `client/src/utils/ingredientCalculations.ts`:
```typescript
calculateIngredientCosts(
  costDisplay: "฿319.00",
  packageSizeText: "1 kg",
  portionSizeText: "95 g"
) => {
  packageCost: 319.00,
  portionQty: 95,
  portionUnit: "g",
  portionsPerPackage: 10.53,
  costPerPortion: 30.29
}
```

#### 3. CSV Sync Process
```
1. User clicks "Sync from CSV"
   ↓
2. POST /api/ingredients/sync-csv
   ↓
3. Read foodCostings.ts
   ↓
4. Parse each item
   ↓
5. Upsert to database (source='god')
   ↓
6. Return sync report
   ↓
7. Frontend refetch
   ↓
8. UI update with sync status
```

#### 4. Search & Filter
- **Search:** Real-time text search across name, supplier, brand
- **Category Filter:** Dropdown with categories from schema
- **Sort:** Default by name (A-Z)
- **Performance:** Client-side filtering using `useMemo`

#### 5. External Mapping
- `supplierSku`: Makro product code, etc.
- `supplierBarcode`: EAN/UPC for scanning
- **Use Case:** Integration with supplier ordering systems

### Data Flow

```
foodCostings.ts (Source of Truth)
    ↓
[Manual Sync Trigger]
    ↓
POST /api/ingredients/sync-csv
    ↓
Database Upsert (ingredients table)
    ↓
    ├─→ God-mode items (source='god')
    └─→ Manual items (source='manual')
    ↓
GET /api/ingredients
    ↓
Enhanced API Response {items: [...enriched]}
    ↓
Frontend calculations (ingredientCalculations.ts)
    ↓
IngredientManagement.tsx Display
```

### Important Notes

1. **No Automatic Sync:** Sync must be triggered manually
2. **Data Persistence:** Manual entries persist until next sync
3. **Best Practice:** Add new items to foodCostings.ts, not database
4. **Migration Path:** Database → foodCostings.ts (for permanence)

### Key Files

1. **Source Data:** `server/data/foodCostings.ts`
2. **Frontend:** `client/src/pages/menu/IngredientManagement.tsx`
3. **Calculations:** `client/src/utils/ingredientCalculations.ts`
4. **Schema:** `shared/schema.ts` (ingredients table, lines 425-463)
5. **API:** `server/routes.ts` (lines 2599-2846, 3453-3494, 3977)

---

## MENU MANAGER

### Architecture Overview

**Database:** PostgreSQL `menu_items` table (Basic)  
**Purpose:** Menu comparison, AI review, version control  
**Frontend:** React basic forms  
**AI Integration:** OpenAI GPT-4o

### Features in Detail

#### 1. Menu Comparison (A vs B)
```
Select Menu A (base)
Select Menu B (compare to)
    ↓
POST /api/menus/:id/compare
    ↓
AI analyzes differences:
  - Items added in B
  - Items removed from A
  - Price changes
  - Category shifts
    ↓
Return structured comparison
```

#### 2. AI Review
```
Select Menu
    ↓
POST /api/menus/:id/review
    ↓
GPT-4o analyzes:
  - Pricing strategy
  - Category balance
  - Missing items
  - Optimization suggestions
    ↓
Return review report
```

#### 3. Mindmap Generation
```
Select Menu
    ↓
GET /api/menus/:id/mindmap
    ↓
Generate visual menu structure
    ↓
Return mindmap data (JSON)
```

#### 4. Version Tracking
- Each menu import gets unique ID
- Timestamp: `importedAt`
- Source tracking: `source` (grab, house, pos, etc.)
- File type: `fileType` (csv, json, pdf, etc.)
- Version field: `version` (v1, v2, etc.)

### Import Flow

```
CSV Upload (MenuImport.tsx or MenuImportWizard.tsx)
    ↓
File validation
    ↓
Parse CSV
    ↓
Field mapping (wizard only)
    ↓
Preview data
    ↓
[User confirms]
    ↓
POST /api/menus/import
    ↓
Database insert (menu_items table)
    ↓
Create menu record with metadata
    ↓
Return import summary
```

### Key Files

1. **Frontend:** `client/src/pages/menu/MenuManager.tsx`
2. **Import:** `client/src/pages/menu/MenuImport.tsx`
3. **Wizard:** `client/src/pages/menu/MenuImportWizard.tsx`
4. **Schema:** `shared/schema.ts` (menuItems table, lines 101-110)
5. **API:** `server/routes.ts` (menu-related endpoints)

### Status & Limitations

**What Works:**
- Menu listing
- Menu comparison UI
- AI review trigger
- Mindmap request
- Version tracking

**What Doesn't Work / Unknown:**
- Backend implementation status unclear
- AI review prompts not visible in routes.ts
- Mindmap generation endpoint not found
- Import endpoints not located in main routes.ts

---

## SHOPPING LIST SYSTEM

### Architecture Overview

**Database:** PostgreSQL `shopping_list` table (Enhanced V2)  
**Frontend:** React with Tabs (Current, History, By Date)  
**AI Generation:** Analyzes daily forms for stock needs  
**Integration:** Links to Daily Sales/Stock Forms

### Features in Detail

#### 1. AI-Generated Lists
```
Daily Sales Form Submitted
    ↓
Extract stock counts:
  - Burger buns remaining
  - Meat weight (kg)
  - Drinks inventory
    ↓
Calculate usage vs starting stock
    ↓
POST /api/shopping-list/regenerate
    ↓
AI determines needs:
  - Rolls to order
  - Meat to purchase
  - Drinks to restock
    ↓
Create shopping_list records
    ↓
Group by supplier (Makro, 7-11, Lotus, etc.)
```

#### 2. Manual List Management
- Add custom items
- Set quantity, unit, supplier
- Assign priority (high, medium, low)
- Checkbox selection for batch actions
- Delete unwanted items

#### 3. Cost Estimation
```
GET /api/shopping-list/:id/estimate
    ↓
For each item:
  - Lookup in shoppingMaster
  - OR lookup in ingredients
  - Calculate: quantity × pricePerUnit
    ↓
Return:
  - lineEstimates: [{item, qty, unit, cost, source}]
  - totalEstimate: sum of all lines
  - missingPricing: items without cost data
```

#### 4. Completion Tracking
```
User reviews list
Shops at suppliers
    ↓
Select items purchased
Enter actual total cost
    ↓
PUT /api/shopping-list/:id (mark complete)
    ↓
Update:
  - isCompleted: true
  - completedAt: timestamp
  - actualCost: THB amount
    ↓
Move to History tab
```

#### 5. Supplier Grouping
Lists are visually grouped by supplier with icons:
- **Makro** 🚚 (Truck)
- **7-11** 🍎 (Apple)
- **Fresh Market** 🥐 (Croissant)
- **Lotus** 🍕 (Pizza)
- **BigC** ❄️ (Snowflake)
- **Wholesale** 📦 (Package)
- **Local Vendors** 💧 (Droplets)
- **Restaurant Depot** 👨‍🍳 (ChefHat)
- **General** 🛍️ (ShoppingBag)
- **Other** 🍴 (Utensils)

### Integration Points

#### Daily Sales Form → Shopping List
```typescript
// When daily sales form submitted:
{
  burgerBunsStock: 45,      // Ending count
  meatWeight: 2.5,          // kg remaining
  drinkStockCount: 18,      // cans left
  rollsOrderedCount: 60     // burgers sold
}
    ↓
POST /api/shopping-list/regenerate
    ↓
AI calculates:
  - Buns needed: 100 - 45 = 55 (order 60 to be safe)
  - Meat needed: Based on 95g per burger × expected sales
  - Drinks: Restock based on par levels
```

### Data Flow

```
Daily Form Submission
    ↓
Stock Analysis (AI)
    ↓
Shopping List Generation
    ↓
Database Insert (shopping_list table)
    ↓
GET /api/shopping-list
    ↓
Frontend Display (ShoppingList.tsx)
    ↓
User Actions:
  ├─→ Add/Edit Items
  ├─→ Cost Estimation
  ├─→ Mark Complete
  └─→ View History
```

### Key Files

1. **Frontend:** `client/src/pages/ShoppingList.tsx`
2. **Schema:** `shared/schema.ts` (shoppingList table, lines 124-153)
3. **Schema:** `shared/schema.ts` (shoppingMaster table, lines 879-893)
4. **API:** `server/routes.ts` (lines 1903, 3503-3749, 3978)
5. **Service:** `server/routes/shoppingList.ts` (estimate endpoint)
6. **Service:** `server/services/shoppingList.ts` (estimation logic)

### Shopping Master Integration

**Purpose:** Price lookup for cost estimation

**Source:** Can be populated from foodCostings.ts or manual entry

**Fields:**
- `item`: Name matching shopping list items
- `internalCategory`: Category for filtering
- `supplier`: Default supplier
- `costMinor`: Price in satang (THB × 100)
- `packagingQty`: Package size
- `portionSize`: Usage unit

---

## LEGACY ITEMS

### Deprecated/Legacy Code

#### 1. **Chef Ramsay AI Chat**
**File:** `client/src/pages/menu/RamsayChat.tsx`  
**Status:** DISABLED (only 21 lines, likely placeholder)  
**Original Purpose:** AI chat for recipe feedback  
**Replacement:** Integrated into Recipes.tsx (but commented out)

#### 2. **Legacy Ingredients Middleware**
**File:** `server/middleware/blockLegacyIngredients.ts`  
**Status:** LEGACY (contains DEPRECATED/LEGACY markers)  
**Purpose:** Unknown - likely route protection  
**Action:** Review and remove if unused

#### 3. **Duplicate API Endpoints**

**Ingredients by Category:**
```
Line 1567: GET /api/ingredients/by-category
Line 2599: GET /api/ingredients/by-category (DUPLICATE)
```

**Ingredients Print:**
```
Line 2660: GET /api/ingredients/print
Line 2739: GET /api/ingredients/print (DUPLICATE)
```

**Action Required:** Consolidate duplicates

#### 4. **Commented Out Endpoints**

**Ingredients List:**
```
Line 2626: // app.get("/api/ingredients", ...)
Line 3453: // app.get("/api/ingredients", ...)
```
**Reason:** Possibly replaced by enhanced version  
**Action:** Verify and clean up

#### 5. **Cost Calculator (Partially Deprecated)**
**File:** `client/src/pages/menu/CostCalculator.tsx` (424 lines)  
**Status:** Contains DEPRECATED code (grep found it)  
**Current State:** Still functional  
**Action:** Review and refactor deprecated sections

### Legacy Tables/Fields

#### Ingredients Table Legacy Fields
Kept for backwards compatibility:
- `unitPrice`
- `price`
- `packageSize`
- `portionSize`
- `costPerPortion`
- `unit`
- `packagingQty`
- `lastReviewDate` (text instead of timestamp)

**Recommendation:** Migrate fully to new purchase/portion system

#### Recipes Table Legacy Fields
- `totalIngredientCost` (replaced by `totalCost`)
- `costPerUnit` (replaced by `costPerServing`)
- `preparationTime`
- `servingSize` (text vs structured yield)
- `profitMargin` (replaced by `margin`)
- `sellingPrice` (replaced by `suggestedPrice`)

**Recommendation:** Deprecate and migrate data

#### Shopping List Legacy Fields
Single-item fields kept for backwards compatibility:
- `itemName`
- `quantity`
- `unit`
- `formId`
- `supplier`
- `pricePerUnit`

**Current System:** Uses JSONB `items` array instead  
**Recommendation:** Migrate old single-item lists to array format

---

## WHAT WORKS

### ✅ Fully Functional Systems

#### Recipe Management
- ✅ Create/Read/Update/Delete recipes
- ✅ Ingredient selection from master list
- ✅ Real-time cost calculations
- ✅ Unit conversions (g/kg/oz/lb/ml/litre/cup/tbsp/tsp/pcs/each)
- ✅ Waste factor adjustments
- ✅ Yield efficiency calculations
- ✅ Image upload and storage
- ✅ Category assignment
- ✅ Recipe versioning
- ✅ PDF export for kitchen cards
- ✅ AI description generation endpoint

#### Ingredient Management
- ✅ Display all ingredients from database
- ✅ Search and filter functionality
- ✅ Category-based filtering
- ✅ Cost calculations (package, portion, unit)
- ✅ CSV sync from foodCostings.ts
- ✅ God-mode vs manual distinction
- ✅ Purchase/portion dual system
- ✅ Create/update/delete manual ingredients
- ✅ External SKU mapping (supplierSku, supplierBarcode)

#### Shopping List
- ✅ Display current shopping lists
- ✅ AI-generated lists from daily forms
- ✅ Supplier grouping with icons
- ✅ Manual item add/edit/delete
- ✅ Priority assignment (high/medium/low)
- ✅ Checkbox selection
- ✅ Cost estimation with shoppingMaster lookup
- ✅ Completion tracking with actual costs
- ✅ Historical view by date
- ✅ Integration with daily sales forms

#### Menu Manager
- ✅ Menu listing and display
- ✅ CSV import (basic and wizard)
- ✅ Version tracking
- ✅ Metadata storage (source, fileType, importedAt)

---

## WHAT DOESN'T WORK

### ❌ Broken or Non-Functional

#### Menu Manager AI Features
- ❌ **Menu Comparison:** UI exists but backend implementation unclear
  - Endpoint: `POST /api/menus/:id/compare`
  - Status: Not found in routes.ts scan
  - UI in MenuManager.tsx calls it, but no response handler visible

- ❌ **AI Review:** Trigger exists but implementation unclear
  - Endpoint: `POST /api/menus/:id/review`
  - Status: Not found in routes.ts
  - No GPT integration visible

- ❌ **Mindmap Generation:** Request endpoint not found
  - Endpoint: `GET /api/menus/:id/mindmap`
  - Status: Not located in codebase
  - MenuManager.tsx calls it

#### Recipe Management
- ⚠️ **ChefRamsayGordon Component:** Commented out in Recipes.tsx
  - Line 10: `// import ChefRamsayGordon from "@/components/ChefRamsayGordon"; // DISABLED`
  - Reason: Unknown (possibly removed temporarily)

#### Ingredients
- ⚠️ **Main GET endpoint:** Commented out (lines 2626, 3453)
  - Current workaround: Likely using alternative endpoint
  - May cause issues if components expect standard GET

#### Shopping List
- ⚠️ **Legacy endpoint:** Still exists but may conflict
  - `GET /api/ingredients/shopping-list/:date` (line 3978)
  - New system: `GET /api/shopping-list/:date`
  - Potential for confusion

### ⚠️ Partially Functional

#### Cost Calculator
- Contains DEPRECATED code (grep found markers)
- Still accessible at `/menu/cost-calculator`
- May have outdated calculation methods
- Recommendation: Use Recipes.tsx cost engine instead

#### Duplicate Endpoints
Multiple endpoints doing the same thing:
- `/api/ingredients/by-category` (2× - lines 1567, 2599)
- `/api/ingredients/print` (2× - lines 2660, 2739)

**Risk:** Inconsistent behavior, maintenance burden

---

## EXTERNAL DEPENDENCIES

### NPM Packages (Menu-Related)

```json
{
  "@tanstack/react-query": "Query and cache management",
  "lucide-react": "Icons (Plus, Edit, Trash2, Upload, etc.)",
  "jspdf": "PDF generation for recipes",
  "jspdf-autotable": "PDF tables",
  "zod": "Schema validation",
  "drizzle-orm": "Database ORM",
  "drizzle-zod": "Schema to Zod conversion",
  "openai": "AI features (descriptions, reviews)",
  "axios": "HTTP requests",
  "papaparse": "CSV parsing"
}
```

### AI Services

**OpenAI GPT-4o:**
- Recipe description generation
- Menu review analysis
- Shopping list AI generation

**Endpoint:** `POST /api/ai/recipe-description`  
**Model:** `gpt-4o`  
**Temperature:** 0.7 (likely)  
**Max Tokens:** ~500

### Database

**PostgreSQL (Neon):**
- Host: Via `DATABASE_URL` env var
- Version: 14+
- Extensions: None required for menu system
- Backup: Automated by Neon

### File Storage

**Image Storage:**
- Recipe images stored in database as URLs
- Possibly cloud storage (S3/similar) or local filesystem
- **Note:** Image upload endpoint exists but storage method unclear

**PDF Generation:**
- Client-side using jsPDF
- No server-side storage (generated on-demand)
- Downloads to user's device

---

## SUMMARY STATISTICS

### Code Metrics
- **Total Lines (Menu System):** ~9,528
  - Backend: 4,650 (routes.ts only)
  - Frontend: 4,878
  - Data: 701 (foodCostings.ts)

### Database Tables
- **Primary:** 6 tables (ingredients, recipes, recipeIngredients, shoppingList, shoppingMaster, menuItems)
- **Junction:** 1 table (recipeIngredients)
- **Legacy Fields:** ~15+ maintained for backwards compatibility

### API Endpoints
- **Recipes:** 6 endpoints (CRUD + photo upload + AI)
- **Ingredients:** 12 endpoints (CRUD + search + sync + print + upload)
- **Shopping List:** 6 endpoints (CRUD + estimate + regenerate + history)
- **Menu Manager:** 4 endpoints (list + compare + review + mindmap)
- **Total:** 28+ endpoints

### Frontend Pages
- **Recipe Pages:** 3 (Recipes, RecipeCards, RecipeEditor)
- **Ingredient Pages:** 2 (IngredientManagement, IngredientEdit)
- **Menu Pages:** 4 (MenuManager, MenuImport, MenuImportWizard, DescriptionTool)
- **Shopping Pages:** 1 (ShoppingList)
- **Utilities:** 2 (CostCalculator, RamsayChat[disabled])
- **Total:** 12 pages

### Source of Truth
- **Primary:** `server/data/foodCostings.ts` (701 lines, ~200+ items)
- **Categories:** 7 (Meat, Drinks, Fresh Food, Frozen Food, Kitchen, Packaging, Shelf)
- **Last Updated:** August 20, 2025

---

## KEY INSIGHTS

### Strengths
1. **Comprehensive Costing:** Recipe system provides detailed cost breakdowns
2. **Dual Ingredient System:** God-mode + manual allows flexibility
3. **AI Integration:** GPT-4o enhances productivity
4. **Shopping Automation:** Auto-generates lists from daily forms
5. **Strong Schema:** Well-designed database with proper types

### Weaknesses
1. **Code Duplication:** Multiple endpoints do same thing
2. **Legacy Burden:** Many unused/outdated fields maintained
3. **Unclear Menu Features:** Compare/Review/Mindmap endpoints missing
4. **Commented Code:** Several disabled endpoints need cleanup
5. **Documentation Gap:** Limited inline documentation

### Risks
1. **Data Loss:** Manual ingredients can be overwritten by sync
2. **Endpoint Confusion:** Duplicate routes may cause bugs
3. **Legacy Tech Debt:** Old fields bloat schema
4. **AI Costs:** Uncontrolled GPT usage could be expensive
5. **No Tests:** No visible test files for menu system

### Opportunities
1. **Consolidate Endpoints:** Remove duplicates
2. **Migrate Legacy Fields:** Clean up schema
3. **Complete Menu Manager:** Implement comparison/review
4. **Add Tests:** Unit and integration tests
5. **API Documentation:** OpenAPI/Swagger specs
6. **Batch Operations:** Bulk recipe/ingredient edits
7. **Cost Analytics:** Historical cost tracking and trends

---

## CRITICAL NOTES

1. **foodCostings.ts is the source of truth** - All menu and ingredient data ultimately references this file
2. **Manual edits can be lost** - Syncing from CSV overwrites database changes
3. **Duplicate endpoints exist** - Consolidation needed to prevent bugs
4. **Menu Manager is incomplete** - AI features have UI but no backend
5. **Legacy code present** - Some files marked DEPRECATED but still loaded
6. **No rollback mechanism** - Recipe/ingredient deletes are permanent
7. **Shopping lists link to forms** - Changes to daily sales forms affect shopping generation

---

## RECOMMENDED ACTIONS

### High Priority
1. ✅ **Remove duplicate endpoints** (ingredients/by-category, ingredients/print)
2. ✅ **Clean up commented code** (lines 2626, 3453)
3. ✅ **Implement or remove Menu Manager features** (compare, review, mindmap)
4. ✅ **Document foodCostings.ts sync policy** clearly in UI

### Medium Priority
5. ⚠️ **Add unit tests** for cost calculations
6. ⚠️ **Migrate legacy fields** to new schema (phase out old fields)
7. ⚠️ **Add API documentation** (OpenAPI spec)
8. ⚠️ **Review and refactor CostCalculator** (remove DEPRECATED code)

### Low Priority
9. 📝 **Re-enable or remove ChefRamsayGordon** component
10. 📝 **Add batch operations** for recipes/ingredients
11. 📝 **Historical cost tracking** for margin analysis
12. 📝 **Supplier integration** APIs for automated ordering

---

**End of Document**

*Generated: November 7, 2025*  
*Version: 1.0*  
*System: Smash Brothers Burgers Management Dashboard*

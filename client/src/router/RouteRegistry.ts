export const ROUTES = {
  // Home
  HOME: "/",

  // Operations (Core active routes only)
  DAILY_STOCK: "/operations/daily-stock",
  DAILY_SALES_LIBRARY: "/operations/daily-sales-v2/library",
  ANALYSIS: "/operations/analysis",
  SHOPPING_LIST: "/operations/shopping-list",
  UPLOAD_STATEMENTS: "/operations/analysis/upload",
  RECEIPTS: "/operations/analysis/receipts",
  RECEIPTS_BURGERS: "/operations/analysis/receipts/burgers",
  SHIFT_ITEMS_MM: "/operations/analysis/shift-items",
  LOYVERSE_REPORTS: "/operations/analysis/loyverse",
  // DAILY_SHIFT_ANALYSIS: "/operations/analysis/daily-shift-analysis", // Hidden - can be re-enabled
  STOCK_REVIEW: "/operations/analysis/stock-review",
  EXPENSES: "/operations/expenses",
  SHIFT_REPORTS: "/operations/shift-reports",

  // Finance
  FINANCE: "/finance",
  PROFIT_LOSS: "/finance/profit-loss",
  FINANCE_EXPENSES: "/finance/expenses",
  EXPENSES_IMPORT: "/finance/expenses-import",

  // Menu Mgmt
  RECIPES: "/menu/recipes",
  RECIPE_CARDS: "/menu/recipe-cards",
  INGREDIENT_MANAGEMENT: "/menu/ingredient-management", 
  COST_CALCULATOR: "/menu/cost-calculator",
  INGREDIENTS: "/menu/ingredients",
  MENU_MGR: "/menu/manager",
  MENU_IMPORT: "/menu/import",
  MENU_DESC_TOOL: "/menu/description-tool",

  // Managers
  NIGHTLY_CHECKLIST: "/managers/nightly-checklist",
  JUSSI_AI: "/ai/jussi-ops",
  JANE_ACCOUNTS: "/ai/jane-accounts",

  // Marketing
  ONLINE_ORDERING: "/marketing/online-ordering",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ALLOWED_PATHS: string[] = Object.values(ROUTES);

export const isAllowedPath = (path: string) =>
  ALLOWED_PATHS.includes((path || "/").replace(/\/+$/, "") || "/");
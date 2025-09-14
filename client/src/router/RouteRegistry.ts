export const ROUTES = {
  // Home
  HOME: "/",

  // Operations
  DAILY_SALES_STOCK: "/operations/stock",
  DAILY_STOCK: "/operations/daily-stock",
  DAILY_SALES_LIBRARY: "/operations/daily-sales-v2/library",
  ANALYSIS: "/operations/analysis",
  UPLOAD_STATEMENTS: "/operations/analysis/upload",
  RECEIPTS: "/operations/analysis/receipts",
  EXPENSES: "/operations/expenses",
  SHIFT_REPORTS: "/operations/shift-reports",

  // Legacy routes for compatibility
  OVERVIEW: "/",
  SHIFT_SUMMARY: "/operations/shift-summary",

  // Finance
  FINANCE: "/finance",
  PROFIT_LOSS: "/finance/profit-loss",
  FINANCE_EXPENSES: "/finance/expenses",

  // Menu Mgmt
  RECIPES: "/menu/recipes",
  RECIPE_CARDS: "/menu/recipe-cards",
  INGREDIENT_MANAGEMENT: "/menu/ingredient-management", 
  COST_CALCULATOR: "/menu/cost-calculator",
  INGREDIENTS: "/menu/ingredients",
  MENU_MGR: "/menu/manager",
  MENU_IMPORT: "/menu/import",
  MENU_DESC_TOOL: "/menu/description-tool",
  SHOPPING_LIST: "/operations/shopping-list",

  // Managers
  NIGHTLY_CHECKLIST: "/managers/nightly-checklist",
  JUSSI_AI: "/ai/jussi-ops",
  JANE_ACCOUNTS: "/ai/jane-accounts",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ALLOWED_PATHS: string[] = Object.values(ROUTES);

export const isAllowedPath = (path: string) =>
  ALLOWED_PATHS.includes((path || "/").replace(/\/+$/, "") || "/");
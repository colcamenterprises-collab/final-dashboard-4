export const ROUTES = {
  // Home
  HOME: "/",
  DASHBOARD: "/dashboard",
  HOME_ALIAS: "/home",

  // Operations (Core active routes only)
  DAILY_STOCK: "/operations/daily-stock",
  DAILY_SALES_LIBRARY: "/operations/daily-sales-v2/library",
  ANALYSIS: "/operations/analysis",
  SHOPPING_LIST: "/operations/shopping-list",
  PURCHASING: "/operations/purchasing",
  PURCHASING_MAPPING: "/operations/purchasing-mapping",
  PURCHASING_SHIFT_LOG: "/operations/purchasing-shift-log",
  PURCHASING_ANALYTICS: "/operations/purchasing-analytics",
  // PATCH S1: Disabled - stock logging moved to Shopping List modal
  // MANUAL_STOCK_PURCHASE: "/operations/manual-stock-purchase",
  UPLOAD_STATEMENTS: "/operations/analysis/upload",
  RECEIPTS: "/operations/analysis/receipts",
  RECEIPTS_BURGERS: "/operations/analysis/receipts/burgers",
  SHIFT_ITEMS_MM: "/operations/analysis/shift-items",
  ROLLS_LEDGER: "/operations/analysis/rolls-ledger",
  // LOYVERSE_REPORTS: "/operations/analysis/loyverse", // Hidden - can be re-enabled
  // DAILY_SHIFT_ANALYSIS: "/operations/analysis/daily-shift-analysis", // Hidden - can be re-enabled
  STOCK_REVIEW: "/operations/analysis/stock-review",
  STOCK_RECONCILIATION: "/analysis/stock-reconciliation",
  EXPENSES: "/operations/expenses",
  SHIFT_REPORTS: "/operations/shift-reports",
  DAILY_REPORTS: "/operations/daily-reports",
  SYSTEM_HEALTH: "/operations/system-health",
  PURCHASE_HISTORY: "/operations/purchase-history",
  HEALTH_SAFETY_AUDIT: "/operations/health-safety-audit",
  HEALTH_SAFETY_QUESTIONS: "/operations/health-safety-audit/questions",
  INGREDIENTS_MASTER: "/operations/ingredients-master",
  RECIPE_MAPPING: "/operations/recipe-mapping",
  RECIPE_MANAGEMENT: "/recipe-management",
  PRODUCTS: "/products",

  // Finance
  FINANCE: "/finance",
  PROFIT_LOSS: "/finance/profit-loss",
  FINANCE_EXPENSES: "/finance/expenses",
  EXPENSES_IMPORT: "/finance/expenses-import",
  EXPENSES_V2: "/finance/expenses-v2",

  // Menu Mgmt
  RECIPES: "/menu/recipes",
  // RECIPES_MASTER: merged into RECIPES
  RECIPE_CARDS: "/menu/recipe-cards",
  INGREDIENT_MANAGEMENT: "/menu/ingredient-management",
  // INGREDIENTS_MASTER: merged into INGREDIENTS
  COST_CALCULATOR: "/menu/cost-calculator",
  INGREDIENTS: "/menu/ingredients",
  MENU_MGR: "/menu/manager",
  MENU_IMPORT: "/menu/import",
  MENU_DESC_TOOL: "/menu/description-tool",
  MENU_MANAGEMENT: "/menu-management",

  // Managers
  NIGHTLY_CHECKLIST: "/managers/nightly-checklist",
  JUSSI_AI: "/ai/jussi-ops",
  JANE_ACCOUNTS: "/ai/jane-accounts",

  // Marketing
  ONLINE_ORDERING: "/marketing/online-ordering",
  MENU_ADMIN: "/marketing/menu-admin",
  ORDER: "/order",
  ORDER_CHECKOUT: "/online-ordering/checkout",
  ORDER_CONFIRMATION: "/online-ordering/confirmation",
  ADMIN_ORDERS: "/admin/orders",
  LOYVERSE_MAPPING: "/admin/loyverse-mapping",
  DATA_SAFETY: "/admin/data-safety",

  // Membership
  MEMBERSHIP: "/membership",
  MEMBERSHIP_DASHBOARD: "/membership/dashboard",
  MEMBERSHIP_REGISTER: "/membership/register",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ALLOWED_PATHS: string[] = Object.values(ROUTES);

export const isAllowedPath = (path: string) =>
  ALLOWED_PATHS.includes((path || "/").replace(/\/+$/, "") || "/");
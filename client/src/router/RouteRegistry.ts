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
  UPLOAD_STATEMENTS: "/operations/analysis/upload",
  RECEIPTS: "/operations/analysis/receipts",
  RECEIPTS_BURGERS: "/operations/analysis/receipts/burgers",
  SHIFT_ITEMS_MM: "/operations/analysis/shift-items",
  ROLLS_LEDGER: "/operations/analysis/rolls-ledger",
  // LOYVERSE_REPORTS: "/operations/analysis/loyverse", // Hidden - can be re-enabled
  // DAILY_SHIFT_ANALYSIS: "/operations/analysis/daily-shift-analysis", // Hidden - can be re-enabled
  STOCK_REVIEW: "/operations/analysis/stock-review",
  EXPENSES: "/operations/expenses",
  SHIFT_REPORTS: "/operations/shift-reports",
  DAILY_REPORTS: "/operations/daily-reports",
  SYSTEM_HEALTH: "/operations/system-health",

  // Finance
  FINANCE: "/finance",
  PROFIT_LOSS: "/finance/profit-loss",
  FINANCE_EXPENSES: "/finance/expenses",
  EXPENSES_IMPORT: "/finance/expenses-import",
  EXPENSES_V2: "/finance/expenses-v2",

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
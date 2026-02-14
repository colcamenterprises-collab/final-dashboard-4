export const ROUTES = {
  // Home
  HOME: "/",
  DASHBOARD: "/dashboard",
  HOME_ALIAS: "/home",

  // Operations (Core active routes only)
  DAILY_STOCK: "/operations/daily-stock",
  DAILY_SALES_LIBRARY: "/operations/daily-sales-v2/library",
  DAILY_SALES_LIBRARY_ALT: "/operations/daily-sales-library",
  ANALYSIS: "/operations/analysis",
  SHOPPING_LIST: "/operations/shopping-list",
  PURCHASING: "/operations/purchasing",
  PURCHASING_MAPPING: "/operations/purchasing-mapping",
  PURCHASING_SHIFT_LOG: "/operations/purchasing-shift-log",
  PURCHASING_ANALYTICS: "/operations/purchasing-analytics",
  PURCHASING_LIST: "/operations/purchasing-list/:id",
  INGREDIENT_PURCHASING: "/operations/ingredient-purchasing",
  INGREDIENT_PURCHASING_NEW: "/operations/ingredient-purchasing/new",
  INGREDIENT_PURCHASING_EDIT: "/operations/ingredient-purchasing/:id",
  UPLOAD_STATEMENTS: "/operations/analysis/upload",
  RECEIPTS: "/operations/analysis/receipts",
  RECEIPTS_BURGERS: "/operations/analysis/receipts/burgers",
  SHIFT_ITEMS_MM: "/operations/analysis/shift-items",
  ROLLS_LEDGER: "/operations/analysis/rolls-ledger",
  // LOYVERSE_REPORTS: "/operations/analysis/loyverse", // Hidden - can be re-enabled
  // DAILY_SHIFT_ANALYSIS: "/operations/analysis/daily-shift-analysis", // Hidden - can be re-enabled
  STOCK_REVIEW: "/operations/analysis/stock-review",
  STOCK_RECONCILIATION: "/analysis/stock-reconciliation",
  ANALYSIS_STOCK_REVIEW: "/analysis/stock-review",
  ANALYSIS_LEDGERS: "/analysis/ledgers",
  EXPENSES: "/operations/expenses",
  SHIFT_REPORTS: "/operations/shift-reports",
  DAILY_REPORTS: "/operations/daily-reports",
  SYSTEM_HEALTH: "/operations/system-health",
  PURCHASE_HISTORY: "/operations/purchase-history",
  HEALTH_SAFETY_AUDIT: "/operations/health-safety-audit",
  HEALTH_SAFETY_QUESTIONS: "/operations/health-safety-audit/questions",
  INGREDIENTS_MASTER: "/operations/ingredients-master",
  RECIPE_MAPPING: "/operations/recipe-mapping",
  OPS_PURCHASING_LIVE: "/ops/purchasing-live",
  PRODUCTS: "/products",
  PRODUCT_NEW: "/products/new",
  PRODUCT_DETAIL: "/products/:id",

  // Finance
  FINANCE: "/finance",
  PROFIT_LOSS: "/finance/profit-loss",
  FINANCE_EXPENSES: "/finance/expenses",
  EXPENSES_IMPORT: "/finance/expenses-import",
  EXPENSES_V2: "/finance/expenses-v2",

  // Menu Mgmt
  RECIPE_MANAGEMENT: "/recipe-management",
  RECIPES: "/menu/recipes",
  RECIPES_NEW: "/menu/recipes/new",
  RECIPES_EDIT: "/menu/recipes/:id",
  // RECIPES_MASTER: merged into RECIPES
  RECIPE_CARDS: "/menu/recipe-cards",
  INGREDIENT_MANAGEMENT: "/menu/ingredient-management",
  INGREDIENT_EDIT: "/menu/ingredients/edit/:id",
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
  INGREDIENTS_PAGE: "/menu-management/ingredients",

  // Reports
  SHIFT_REPORT: "/reports/shift-report",
  SHIFT_REPORT_HISTORY: "/reports/shift-report/history",
  SHIFT_REPORT_VIEW: "/reports/shift-report/view/:id",

  // Partners
  PARTNERS: "/partners",
  PARTNERS_ANALYTICS: "/partners/analytics",

  // Delivery
  DELIVERY_ADMIN: "/delivery/admin",
  DELIVERY_DRIVERS: "/delivery/drivers",
  DELIVERY_HISTORY: "/delivery/history",

  // Membership
  MEMBERSHIP: "/membership",
  MEMBERSHIP_DASHBOARD: "/membership/dashboard",
  MEMBERSHIP_REGISTER: "/membership/register",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ALLOWED_PATHS: string[] = Object.values(ROUTES);

export const isAllowedPath = (path: string) => {
  const normalized = (path || "/").replace(/\/+$/, "") || "/";
  return ALLOWED_PATHS.some((allowed) => {
    if (!allowed.includes(":")) {
      return allowed === normalized;
    }
    const allowedParts = allowed.split("/");
    const pathParts = normalized.split("/");
    if (allowedParts.length !== pathParts.length) return false;
    return allowedParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
  });
};

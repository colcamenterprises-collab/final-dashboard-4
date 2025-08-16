// src/router/RouteRegistry.ts
export const ROUTES = {
  // Dashboard
  OVERVIEW: "/",

  // Operations
  DAILY_SALES_STOCK: "/operations/daily-sales-stock",
  DAILY_SALES_LIBRARY: "/operations/daily-sales-library",
  UPLOAD_STATEMENTS: "/operations/upload-statements",
  RECEIPTS: "/operations/receipts",
  SHIFT_SUMMARY: "/operations/shift-summary",

  // Finance
  PROFIT_LOSS: "/finance/profit-loss",

  // Menu Mgmt
  COST_CALCULATOR: "/menu/cost-calculator",
  INGREDIENTS: "/menu/ingredients",

  // Managers / AI
  NIGHTLY_CHECKLIST: "/managers/nightly-checklist",
  JUSSI_AI: "/ai/jussi-ops",
  JANE_ACCOUNTS: "/ai/jane-accounts",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ALLOWED_PATHS: string[] = [
  // Dashboard
  ROUTES.OVERVIEW,

  // Operations
  ROUTES.DAILY_SALES_STOCK,
  ROUTES.DAILY_SALES_LIBRARY,
  ROUTES.UPLOAD_STATEMENTS,
  ROUTES.RECEIPTS,
  ROUTES.SHIFT_SUMMARY,

  // Finance
  ROUTES.PROFIT_LOSS,

  // Menu Mgmt
  ROUTES.COST_CALCULATOR,
  ROUTES.INGREDIENTS,

  // Managers / AI
  ROUTES.NIGHTLY_CHECKLIST,
  ROUTES.JUSSI_AI,
  ROUTES.JANE_ACCOUNTS,
];

export const isAllowedPath = (path: string) =>
  ALLOWED_PATHS.includes((path || "/").replace(/\/+$/, "") || "/");
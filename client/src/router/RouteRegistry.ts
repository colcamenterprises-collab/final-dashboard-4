// src/router/RouteRegistry.ts
export const ROUTES = {
  OVERVIEW: "/",
  DAILY_SALES_STOCK: "/operations/daily-sales-stock",
  DAILY_SALES_LIBRARY: "/operations/daily-sales-library",
  EXPENSES: "/operations/expenses",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const ALLOWED_PATHS: string[] = [
  ROUTES.OVERVIEW,
  ROUTES.DAILY_SALES_STOCK,
  ROUTES.DAILY_SALES_LIBRARY,
  ROUTES.EXPENSES,
];

export const isAllowedPath = (path: string) =>
  ALLOWED_PATHS.includes((path || "/").replace(/\/+$/, "") || "/");
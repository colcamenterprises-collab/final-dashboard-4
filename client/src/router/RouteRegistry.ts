// src/router/RouteRegistry.ts
export const ROUTES = {
  OVERVIEW: "/",
  DAILY_SALES_STOCK: "/operations/daily-sales-stock",
  DAILY_SALES_LIBRARY: "/operations/daily-sales-library",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

// ✅ Only these paths are allowed to render (lockdown)
export const ALLOWED_PATHS: string[] = [
  ROUTES.OVERVIEW,
  ROUTES.DAILY_SALES_STOCK,
  ROUTES.DAILY_SALES_LIBRARY,
];

// Simple guard
export const isAllowedPath = (path: string) =>
  ALLOWED_PATHS.includes(path.replace(/\/+$/, "") || "/");
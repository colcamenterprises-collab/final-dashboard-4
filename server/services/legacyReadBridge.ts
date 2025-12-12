// PATCH L0 — Global Legacy Read Bridge
// READ-ONLY fallback system for historical data visibility
// No schema changes, no migrations, no writes to legacy tables

import { db } from "../lib/prisma";

type PrismaModel = keyof ReturnType<typeof db>;

interface ReadWithFallbackOptions {
  primary: PrismaModel;
  legacy: PrismaModel;
  query?: any;
  orderBy?: any;
  take?: number;
  skip?: number;
}

interface FallbackResult<T = any> {
  source: 'v2' | 'legacy';
  rows: T[];
  count: number;
}

/**
 * Read from V2 table first, fallback to legacy if empty
 * READ-ONLY - Never writes to legacy tables
 */
export async function readWithFallback<T = any>({
  primary,
  legacy,
  query = {},
  orderBy,
  take,
  skip
}: ReadWithFallbackOptions): Promise<FallbackResult<T>> {
  const prisma = db();
  
  try {
    // Try primary (V2/V3) table first
    const primaryModel = prisma[primary] as any;
    if (!primaryModel) {
      console.warn(`[LegacyBridge] Primary model ${String(primary)} not found`);
      return { source: 'v2', rows: [], count: 0 };
    }

    const primaryRows = await primaryModel.findMany({
      where: query,
      orderBy,
      take,
      skip
    });

    if (primaryRows.length > 0) {
      return { 
        source: 'v2', 
        rows: primaryRows as T[],
        count: primaryRows.length 
      };
    }

    // Fallback to legacy table
    const legacyModel = prisma[legacy] as any;
    if (!legacyModel) {
      console.warn(`[LegacyBridge] Legacy model ${String(legacy)} not found`);
      return { source: 'v2', rows: [], count: 0 };
    }

    const legacyRows = await legacyModel.findMany({
      where: query,
      orderBy,
      take,
      skip
    });

    return { 
      source: 'legacy', 
      rows: legacyRows as T[],
      count: legacyRows.length 
    };
  } catch (error) {
    console.error(`[LegacyBridge] Error reading ${String(primary)}/${String(legacy)}:`, error);
    return { source: 'v2', rows: [], count: 0 };
  }
}

/**
 * Read single record with fallback
 */
export async function readOneWithFallback<T = any>({
  primary,
  legacy,
  query = {}
}: Omit<ReadWithFallbackOptions, 'orderBy' | 'take' | 'skip'>): Promise<{
  source: 'v2' | 'legacy';
  row: T | null;
}> {
  const prisma = db();
  
  try {
    const primaryModel = prisma[primary] as any;
    if (primaryModel) {
      const primaryRow = await primaryModel.findFirst({ where: query });
      if (primaryRow) {
        return { source: 'v2', row: primaryRow as T };
      }
    }

    const legacyModel = prisma[legacy] as any;
    if (legacyModel) {
      const legacyRow = await legacyModel.findFirst({ where: query });
      if (legacyRow) {
        return { source: 'legacy', row: legacyRow as T };
      }
    }

    return { source: 'v2', row: null };
  } catch (error) {
    console.error(`[LegacyBridge] Error reading single:`, error);
    return { source: 'v2', row: null };
  }
}

/**
 * Table mapping for V2 → Legacy fallbacks
 */
export const TABLE_MAPPINGS = {
  // Expenses
  expenses_v2: 'expenses',
  
  // Daily forms
  daily_sales_v2: 'daily_shifts',
  daily_stock_v2: 'daily_stock',
  
  // Shopping
  shopping_list_v2: 'shopping_list',
  shopping_purchases_v2: 'shopping_purchases',
  
  // Inventory
  ingredients_v2: 'ingredients',
  
  // Recipes
  recipes_v2: 'recipes',
  
  // Menu
  menu_items_v3: 'menu_items',
  menu_categories_v3: 'menu_categories',
} as const;

/**
 * Check if a result is from legacy data (read-only)
 */
export function isLegacyData(source: string): boolean {
  return source === 'legacy';
}

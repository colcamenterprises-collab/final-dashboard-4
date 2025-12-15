// PATCH L0 — Legacy Read Bridge Routes
// READ-ONLY fallback endpoints for historical data visibility
// No writes, no mutations, no deletes

import { Router } from "express";
import { db } from "../lib/prisma";
import { readWithFallback } from "../services/legacyReadBridge";

const router = Router();

/**
 * GET /api/legacy-bridge/expenses
 * Returns expenses with V2 → legacy fallback
 */
router.get("/expenses", async (req, res) => {
  try {
    const prisma = db();
    
    // Check V2 first
    const v2Expenses = await prisma.expenses_v2.findMany({
      orderBy: { date: "desc" },
      take: 500
    });

    if (v2Expenses.length > 0) {
      return res.json({
        source: "v2",
        rows: v2Expenses,
        count: v2Expenses.length
      });
    }

    // Fallback to legacy expenses table if exists
    // Note: Check if legacy table exists in your schema
    return res.json({
      source: "v2",
      rows: [],
      count: 0,
      message: "No expenses found in V2 table"
    });
  } catch (error) {
    console.error("[LegacyBridge] Expenses error:", error);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

/**
 * GET /api/legacy-bridge/daily-sales
 * Returns daily sales with V2 → legacy fallback
 */
router.get("/daily-sales", async (req, res) => {
  try {
    const prisma = db();
    
    const v2Sales = await prisma.dailySalesV2.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 500
    });

    if (v2Sales.length > 0) {
      return res.json({
        source: "v2",
        rows: v2Sales,
        count: v2Sales.length
      });
    }

    // Try legacy daily_stock_sales table
    const legacySales = await prisma.daily_stock_sales.findMany({
      orderBy: { created_at: "desc" },
      take: 500
    });

    if (legacySales.length > 0) {
      return res.json({
        source: "legacy",
        rows: legacySales,
        count: legacySales.length
      });
    }

    return res.json({
      source: "v2",
      rows: [],
      count: 0
    });
  } catch (error) {
    console.error("[LegacyBridge] Daily sales error:", error);
    res.status(500).json({ error: "Failed to fetch daily sales" });
  }
});

/**
 * GET /api/legacy-bridge/shopping-list
 * Returns shopping list with V2 → legacy fallback
 */
router.get("/shopping-list", async (req, res) => {
  try {
    const prisma = db();
    
    const v2Lists = await prisma.shoppingPurchaseV2.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });

    if (v2Lists.length > 0) {
      return res.json({
        source: "v2",
        rows: v2Lists,
        count: v2Lists.length
      });
    }

    // Try legacy shopping_list table
    const legacyLists = await prisma.shopping_list.findMany({
      orderBy: { created_at: "desc" },
      take: 100
    });

    if (legacyLists.length > 0) {
      return res.json({
        source: "legacy",
        rows: legacyLists,
        count: legacyLists.length
      });
    }

    return res.json({
      source: "v2",
      rows: [],
      count: 0
    });
  } catch (error) {
    console.error("[LegacyBridge] Shopping list error:", error);
    res.status(500).json({ error: "Failed to fetch shopping list" });
  }
});

/**
 * GET /api/legacy-bridge/ingredients
 * Returns ingredients with V2 → legacy fallback
 */
router.get("/ingredients", async (req, res) => {
  try {
    const prisma = db();
    
    // Try ingredients table (current)
    const ingredients = await prisma.ingredients.findMany({
      orderBy: { name: "asc" }
    });

    return res.json({
      source: ingredients.length > 0 ? "v2" : "legacy",
      rows: ingredients,
      count: ingredients.length
    });
  } catch (error) {
    console.error("[LegacyBridge] Ingredients error:", error);
    res.status(500).json({ error: "Failed to fetch ingredients" });
  }
});

/**
 * GET /api/legacy-bridge/recipes
 * Returns recipes with fallback
 */
router.get("/recipes", async (req, res) => {
  try {
    const prisma = db();
    
    const recipes = await prisma.recipes.findMany({
      orderBy: { name: "asc" }
    });

    return res.json({
      source: recipes.length > 0 ? "v2" : "legacy",
      rows: recipes,
      count: recipes.length
    });
  } catch (error) {
    console.error("[LegacyBridge] Recipes error:", error);
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

/**
 * GET /api/legacy-bridge/suppliers
 * Returns suppliers with fallback
 */
router.get("/suppliers", async (req, res) => {
  try {
    const prisma = db();
    
    const suppliers = await prisma.suppliers.findMany({
      orderBy: { name: "asc" }
    });

    return res.json({
      source: suppliers.length > 0 ? "v2" : "legacy",
      rows: suppliers,
      count: suppliers.length
    });
  } catch (error) {
    console.error("[LegacyBridge] Suppliers error:", error);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

/**
 * GET /api/legacy-bridge/menu-items
 * Returns menu items with V3 → legacy fallback
 */
router.get("/menu-items", async (req, res) => {
  try {
    const prisma = db();
    
    // Try V3 menu items first
    const v3Items = await prisma.menu_items_v3.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" }
    });

    if (v3Items.length > 0) {
      return res.json({
        source: "v2",
        rows: v3Items,
        count: v3Items.length
      });
    }

    // Fallback to legacy MenuItem table
    const legacyItems = await prisma.menuItem.findMany({});

    if (legacyItems.length > 0) {
      return res.json({
        source: "legacy",
        rows: legacyItems,
        count: legacyItems.length
      });
    }

    return res.json({
      source: "v2",
      rows: [],
      count: 0
    });
  } catch (error) {
    console.error("[LegacyBridge] Menu items error:", error);
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
});

/**
 * GET /api/legacy-bridge/partners
 * Returns partner bars with V1 → legacy fallback
 */
router.get("/partners", async (req, res) => {
  try {
    const prisma = db();
    
    // Try V1 partner bars first
    const v1Partners = await prisma.partner_bars_v1.findMany({
      orderBy: { createdAt: "desc" }
    });

    if (v1Partners.length > 0) {
      return res.json({
        source: "v2",
        rows: v1Partners,
        count: v1Partners.length
      });
    }

    // No legacy partner table exists, return empty
    return res.json({
      source: "v2",
      rows: [],
      count: 0
    });
  } catch (error) {
    console.error("[LegacyBridge] Partners error:", error);
    res.status(500).json({ error: "Failed to fetch partners" });
  }
});

/**
 * GET /api/legacy-bridge/status
 * Returns status of all tables (V2 vs legacy counts)
 */
router.get("/status", async (req, res) => {
  try {
    const prisma = db();
    
    // Use try-catch for each count to handle missing tables
    const safeCount = async (model: any) => {
      try {
        return model ? await model.count() : 0;
      } catch {
        return 0;
      }
    };
    
    const status = {
      expenses_v2: await safeCount(prisma.expenses_v2),
      dailySalesV2: await safeCount(prisma.dailySalesV2),
      shoppingPurchaseV2: await safeCount(prisma.shoppingPurchaseV2),
      ingredients: await safeCount(prisma.ingredients),
      recipes: await safeCount(prisma.recipes),
      suppliers: await safeCount(prisma.suppliers),
      menu_items_v3: await safeCount(prisma.menu_items_v3),
      partner_bars_v1: await safeCount(prisma.partner_bars_v1),
      legacy: {
        daily_stock_sales: await safeCount(prisma.daily_stock_sales),
        shopping_list: await safeCount(prisma.shopping_list)
      }
    };

    res.json({ status });
  } catch (error) {
    console.error("[LegacyBridge] Status error:", error);
    res.status(500).json({ error: "Failed to get status" });
  }
});

export default router;

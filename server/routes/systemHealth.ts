import { Router } from "express";
import { db as drizzleDb } from "../db";
import { dailySalesV2, dailyStockV2, ingredients } from "../../shared/schema";
import { sql, desc } from "drizzle-orm";

const router = Router();

interface HealthCheck {
  name: string;
  ok: boolean;
  error?: string;
}

/**
 * System Health Test Runner
 * READ-ONLY checks to validate system components
 */
router.get("/run", async (_req, res) => {
  const start = Date.now();
  const checks: HealthCheck[] = [];

  // 1. Database Connection
  try {
    await drizzleDb.execute(sql`SELECT 1`);
    checks.push({ name: "Database Connection", ok: true });
  } catch (err: any) {
    checks.push({ name: "Database Connection", ok: false, error: err?.message || "Connection failed" });
  }

  // 2. Latest Daily Sales Record Exists
  try {
    const latestSales = await drizzleDb
      .select({ id: dailySalesV2.id })
      .from(dailySalesV2)
      .orderBy(desc(dailySalesV2.createdAt))
      .limit(1);
    
    if (latestSales && latestSales.length > 0) {
      checks.push({ name: "Daily Sales V2 - Latest Record", ok: true });
    } else {
      checks.push({ name: "Daily Sales V2 - Latest Record", ok: false, error: "No records found" });
    }
  } catch (err: any) {
    checks.push({ name: "Daily Sales V2 - Latest Record", ok: false, error: err?.message || "Query failed" });
  }

  // 3. Latest Daily Stock Record Exists
  try {
    const latestStock = await drizzleDb
      .select({ id: dailyStockV2.id })
      .from(dailyStockV2)
      .orderBy(desc(dailyStockV2.id))
      .limit(1);
    
    if (latestStock && latestStock.length > 0) {
      checks.push({ name: "Daily Stock V2 - Latest Record", ok: true });
    } else {
      checks.push({ name: "Daily Stock V2 - Latest Record", ok: false, error: "No records found" });
    }
  } catch (err: any) {
    checks.push({ name: "Daily Stock V2 - Latest Record", ok: false, error: err?.message || "Query failed" });
  }

  // 4. Ingredients Table Loads
  try {
    await drizzleDb
      .select({ count: sql<number>`count(*)` })
      .from(ingredients);
    
    checks.push({ name: "Ingredients Table", ok: true });
  } catch (err: any) {
    checks.push({ name: "Ingredients Table", ok: false, error: err?.message || "Query failed" });
  }

  // 5. Shopping List Module Check
  try {
    const shoppingListModule = await import("../shoppingList");
    checks.push({ name: "Shopping List Module", ok: !!shoppingListModule });
  } catch (err: any) {
    checks.push({ name: "Shopping List Module", ok: false, error: err?.message || "Import failed" });
  }

  // 6. PDF Builder Importable
  try {
    const { buildDailyReportPDF } = await import("../pdf/dailyReportV2.pdf");
    checks.push({ name: "PDF Builder Module", ok: typeof buildDailyReportPDF === "function" });
  } catch (err: any) {
    checks.push({ name: "PDF Builder Module", ok: false, error: err?.message || "Import failed" });
  }

  // 7. Email Service Registered
  try {
    const emailModule = await import("../email/mailer");
    checks.push({ name: "Email Service", ok: !!emailModule });
  } catch (err: any) {
    checks.push({ name: "Email Service", ok: false, error: err?.message || "Import failed" });
  }

  // 8. Routes Module Check
  try {
    const routesModule = await import("../routes");
    checks.push({ name: "API Routes Module", ok: !!routesModule });
  } catch (err: any) {
    checks.push({ name: "API Routes Module", ok: false, error: err?.message || "Import failed" });
  }

  const checksPassed = checks.filter(c => c.ok).length;
  const totalChecks = checks.length;

  res.json({
    ok: checksPassed === totalChecks,
    checksPassed,
    totalChecks,
    checks,
    durationMs: Date.now() - start,
    timestamp: new Date().toISOString()
  });
});

export default router;

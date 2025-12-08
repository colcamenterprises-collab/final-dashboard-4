import { Router } from "express";
import { db as drizzleDb } from "../db";
import axios from "axios";
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
    const [latestSales] = await drizzleDb
      .select({ id: dailySalesV2.id, shiftDate: dailySalesV2.shiftDate })
      .from(dailySalesV2)
      .orderBy(desc(dailySalesV2.createdAt))
      .limit(1);
    
    if (latestSales) {
      checks.push({ name: "Daily Sales V2 - Latest Record", ok: true });
    } else {
      checks.push({ name: "Daily Sales V2 - Latest Record", ok: false, error: "No records found" });
    }
  } catch (err: any) {
    checks.push({ name: "Daily Sales V2 - Latest Record", ok: false, error: err?.message || "Query failed" });
  }

  // 3. Latest Daily Stock Record Exists
  try {
    const [latestStock] = await drizzleDb
      .select({ id: dailyStockV2.id, shiftDate: dailyStockV2.shiftDate })
      .from(dailyStockV2)
      .orderBy(desc(dailyStockV2.createdAt))
      .limit(1);
    
    if (latestStock) {
      checks.push({ name: "Daily Stock V2 - Latest Record", ok: true });
    } else {
      checks.push({ name: "Daily Stock V2 - Latest Record", ok: false, error: "No records found" });
    }
  } catch (err: any) {
    checks.push({ name: "Daily Stock V2 - Latest Record", ok: false, error: err?.message || "Query failed" });
  }

  // 4. Ingredients Table Loads
  try {
    const ingredientCount = await drizzleDb
      .select({ count: sql<number>`count(*)` })
      .from(ingredients);
    
    checks.push({ name: "Ingredients Table", ok: true });
  } catch (err: any) {
    checks.push({ name: "Ingredients Table", ok: false, error: err?.message || "Query failed" });
  }

  // 5. Shopping List Endpoint Reachable
  try {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : "http://localhost:5000";
    const response = await axios.get(`${baseUrl}/api/shopping-list`, { timeout: 5000 });
    checks.push({ name: "Shopping List API", ok: response.status === 200 });
  } catch (err: any) {
    checks.push({ name: "Shopping List API", ok: false, error: err?.message || "Endpoint unreachable" });
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
    const emailService = await import("../emailService");
    checks.push({ name: "Email Service", ok: !!emailService });
  } catch (err: any) {
    checks.push({ name: "Email Service", ok: false, error: err?.message || "Import failed" });
  }

  // 8. API Routes Mounted
  try {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : "http://localhost:5000";
    const response = await axios.get(`${baseUrl}/api/finance/summary/today`, { timeout: 5000 });
    checks.push({ name: "API Routes Mounted", ok: response.status === 200 });
  } catch (err: any) {
    checks.push({ name: "API Routes Mounted", ok: false, error: err?.message || "Route check failed" });
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

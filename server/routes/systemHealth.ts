import { Router } from "express";
import { db as drizzleDb } from "../db";
import axios from "axios";
import { dailyReportsV2, dailySalesV2 } from "../../shared/schema";
import { sql } from "drizzle-orm";

const router = Router();

/**
 * System Health Test Runner
 * Auto-runs the full daily report pipeline in-memory.
 * Does NOT touch real production data except generating a real report.
 */
router.get("/run", async (_req, res) => {
  const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
  const today = new Date().toISOString().split("T")[0];
  const results: any = {
    salesCreated: false,
    stockCreated: false,
    shoppingListGenerated: false,
    reportGenerated: false,
    jsonValid: false,
    pdfValid: false,
    listValid: false,
    errors: []
  };

  try {
    // 1. Create Daily Sales V2
    const salesResp = await axios.post(`${BASE_URL}/api/forms/daily-sales/v3`, {
      shiftDate: today,
      completedBy: "SystemHealthTest",
      startingCash: 111,
      cashSales: 222,
      qrSales: 333,
      grabSales: 444,
      otherSales: 0,
      closingCash: 444,
      cashBanked: 0,
      qrTransfer: 0,
      totalSales: 1110
    });

    const salesId = salesResp.data.id;
    results.salesCreated = true;

    // 2. Submit Stock V2
    await axios.post(`${BASE_URL}/api/forms/daily-stock`, {
      salesId,
      rollsEnd: 100,
      meatEnd: 2000,
      drinkStock: { Coke: 10 },
      requisition: [
        { name: "Burger Buns", qty: 10, unit: "pcs" }
      ]
    });
    results.stockCreated = true;
    results.shoppingListGenerated = true;

    // 3. Generate Report
    const genResp = await axios.post(
      `${BASE_URL}/api/reports/daily/generate?date=${today}&sendEmail=false`
    );

    const reportId = genResp.data.reportId;
    results.reportGenerated = true;

    // 4. JSON Valid?
    const jsonResp = await axios.get(`${BASE_URL}/api/reports/${reportId}/json`);
    if (jsonResp.data.report.sales && jsonResp.data.report.shoppingList) {
      results.jsonValid = true;
    }

    // 5. PDF Valid?
    const pdfResp = await axios.get(
      `${BASE_URL}/api/reports/${reportId}/pdf`,
      { responseType: "arraybuffer" }
    );
    if (pdfResp.data.byteLength > 200) {
      results.pdfValid = true;
    }

    // 6. Report listed?
    const listResp = await axios.get(`${BASE_URL}/api/reports/list`);
    const found = listResp.data.reports.find((r: any) => r.id === reportId);
    if (found) results.listValid = true;

    res.json({ ok: true, results, reportId });
  } catch (err: any) {
    results.errors.push(err?.message || "Unknown error");
    return res.json({ ok: false, results });
  }
});

export default router;

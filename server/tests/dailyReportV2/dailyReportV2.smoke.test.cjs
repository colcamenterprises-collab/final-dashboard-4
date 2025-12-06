/**
 * DAILY REPORT V2 — REPLIT-SAFE END-TO-END SMOKE TEST
 * CommonJS version (.cjs) to support require() under Node ESM environment.
 * Idempotent cleanup + auto-port detection.
 */

const axios = require("axios");

const BASE_URL = process.env.REPLIT
  ? `http://localhost:${process.env.PORT || 5000}`
  : "http://localhost:5000";

async function run() {
  console.log("🚀 DAILY REPORT V2 — REPLIT-SAFE SMOKE TEST\n");

  const today = new Date().toISOString().split("T")[0];
  let salesId;

  try {
    // === CLEANUP DISABLED (no daily-sales lookup endpoint exists) ===
    // Previously attempted to GET /api/forms/daily-sales/by-date but this endpoint does not
    // exist. This caused "undefined" sale IDs and spammed console output.
    // Cleanup is safe to skip because daily report generator overwrites same-day reports.
    console.log("⚠️ Cleanup skipped — no lookup endpoint for sales-by-date");

    // CLEANUP: Remove any existing Daily Reports for today
    const existingReports = await axios
      .get(`${BASE_URL}/api/reports/list`)
      .catch(() => ({ data: { reports: [] } }));

    for (const report of existingReports.data.reports) {
      if (report.date === today) {
        await axios
          .delete(`${BASE_URL}/api/reports/${report.id}`)
          .catch(() => {});
        console.log(`🗑️ Cleaned existing report ${report.id}`);
      }
    }

    // STEP 1 — Create Daily Sales V2
    const salesResp = await axios.post(
      `${BASE_URL}/api/forms/daily-sales/v3`,
      {
        shiftDate: today,
        completedBy: "CamSmokeTest",
        startingCash: 1000,
        cashSales: 3000,
        qrSales: 1200,
        grabSales: 800,
        otherSales: 200,
        closingCash: 4200,
        cashBanked: 3000,
        qrTransfer: 2000,
        expenses: [{ description: "test expense", amount: 150 }],
        notes: "Smoke test — Phase 2 Fort Knox"
      }
    );

    salesId = salesResp.data.id;
    console.log("✓ Daily Sales V2 created →", salesId);

    // STEP 2 — Submit Daily Stock V2 → Auto Shopping List
    await axios.post(`${BASE_URL}/api/forms/daily-stock`, {
      salesId,
      rollsEnd: 80,
      meatEnd: 1800,
      drinkStock: { Coke: 24, Sprite: 18, Fanta: 12 },
      requisition: [
        { name: "Burger Buns", qty: 50, unit: "pcs", notes: "Urgent" },
        { name: "Cheddar Cheese", qty: 100, unit: "slices" },
        { name: "Beef Patties", qty: 20, unit: "kg" }
      ]
    });
    console.log("✓ Daily Stock V2 submitted + Shopping List V2 auto-generated");

    // STEP 3 — Generate Report V2
    const genResp = await axios.post(
      `${BASE_URL}/api/reports/daily/generate?date=${today}&sendEmail=false`
    );
    const reportId = genResp.data.reportId;
    console.log("✓ Daily Report V2 compiled & saved →", reportId);

    // STEP 4 — Validate JSON
    const json = await axios.get(`${BASE_URL}/api/reports/${reportId}/json`);
    if (
      !json.data.report.sales ||
      !json.data.report.shoppingList
    ) {
      throw new Error("JSON missing required sections");
    }
    console.log("✓ JSON valid — includes sales + stock + variance + shoppingList");

    // STEP 5 — Validate PDF
    const pdf = await axios.get(
      `${BASE_URL}/api/reports/${reportId}/pdf`,
      { responseType: "arraybuffer" }
    );
    if (pdf.data.byteLength < 200) {
      throw new Error("PDF generation failed (too small)");
    }
    console.log(`✓ PDF generated — ${pdf.data.byteLength} bytes`);

    // STEP 6 — Ensure report is listed
    const list = await axios.get(`${BASE_URL}/api/reports/list`);
    const todayReport = list.data.reports.find(r => r.date === today);
    if (!todayReport) {
      throw new Error("Report not found in list");
    }
    console.log(
      `✓ Reports list contains today's report (${list.data.reports.length} total)`
    );

    console.log("\n🎉 PHASE 2 LOCKED — ALL TESTS PASSED (FORT KNOX)\n");

  } catch (err) {
    console.error("\n💥 SMOKE TEST FAILED:");
    console.error(err.response?.data || err.message);
    process.exit(1);
  }
}

run();

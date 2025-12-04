/**
 * Shopping List V2 Smoke Test
 *
 * This is a non-destructive validation suite that ensures
 * the auto-generation pipeline works end-to-end.
 *
 * Workflow Tested:
 * 1. POST /daily-sales/v3
 * 2. POST /daily-stock
 * 3. GET /shopping-list/latest
 * 4. GET /shopping-list/by-date
 */

import axios from "axios";
import assert from "assert";

const API = "http://localhost:5000/api";

async function run() {
  console.log("=== Shopping List V2 Smoke Test ===");

  // -------------------------------------------------------------
  // 1. Submit Daily Sales V2
  // -------------------------------------------------------------
  const salesResp = await axios.post(`${API}/forms/daily-sales/v3`, {
    shiftDate: "2025-12-07",
    completedBy: "SmokeTest",
    startingCash: 0,
    cashSales: 1000,
    qrSales: 1000,
    grabSales: 1000,
    otherSales: 0,
    closingCash: 0,
    cashBanked: 0,
    qrTransfer: 0,
    totalSales: 3000
  });

  assert(salesResp.data.id, "SalesV2 did not return id");
  const salesId = salesResp.data.id;
  console.log("✓ Daily Sales V2 submitted:", salesId);

  // -------------------------------------------------------------
  // 2. Submit Daily Stock V2 (this triggers shopping_list_v2)
  // -------------------------------------------------------------
  const stockResp = await axios.post(`${API}/forms/daily-stock`, {
    salesId,
    rollsEnd: 100,
    meatEnd: 3000,
    drinkStock: {},
    requisition: [
      { name: "Burger Buns", qty: 12, unit: "pcs", notes: "auto-test" },
      { name: "Pickles", qty: 4, unit: "jars" }
    ]
  });

  console.log("✓ Daily Stock V2 submitted");

  // -------------------------------------------------------------
  // 3. Fetch /shopping-list/latest
  // -------------------------------------------------------------
  const latest = await axios.get(`${API}/shopping-list/latest`);
  assert(latest.data.items.length >= 2, "Shopping List V2 did not auto-generate");

  console.log("✓ Latest Shopping List contains:", latest.data.items.length, "items");

  // -------------------------------------------------------------
  // 4. Fetch /shopping-list/by-date
  // -------------------------------------------------------------
  const byDate = await axios.get(
    `${API}/shopping-list/by-date?date=2025-12-07`
  );

  assert(byDate.data.items.length >= 2, "Shopping List by date mismatch");

  console.log("✓ Shopping List by date returned items");

  console.log("=== ALL SHOPPING LIST V2 SMOKE TESTS PASSED ===");
}

run().catch((err) => {
  console.error("❌ Smoke Test Failed", err.response?.data || err);
  process.exit(1);
});

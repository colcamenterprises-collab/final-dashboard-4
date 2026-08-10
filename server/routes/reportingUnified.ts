import { Router } from "express";
import {
  queryUnifiedItemSales,
  queryUnifiedOverview,
  queryUnifiedReceipts,
  resolveExactReportingRange,
} from "../reporting/unifiedLedger";
import { queryUnifiedReceiptDetails } from "../reporting/unifiedReceiptDetails";
import { queryUnifiedComponents } from "../reporting/unifiedComponents";

const router = Router();

function exactRange(query: Record<string, unknown>) {
  const fromDate = String(query.fromDate || "");
  const fromTime = String(query.fromTime || "");
  const toDate = String(query.toDate || "");
  const toTime = String(query.toTime || "");
  const timezone = String(query.timezone || "Asia/Bangkok");
  if (!fromDate || !fromTime || !toDate || !toTime) {
    throw new Error("fromDate, fromTime, toDate and toTime are all required");
  }
  return resolveExactReportingRange({ fromDate, fromTime, toDate, toTime, timezone });
}

router.get("/overview", async (req, res) => {
  try {
    const range = exactRange(req.query as Record<string, unknown>);
    const overview = await queryUnifiedOverview(range);
    res.json({
      ok: true,
      source: "unified_reporting_ledger",
      filters: range,
      sourcesIncluded: [
        ...(overview.historicalReceipts ? ["loyverse"] : []),
        ...(overview.liveReceipts ? ["sbb_pos"] : []),
      ],
      overview,
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, source: "unified_reporting_ledger", error: error.message });
  }
});

router.get("/receipts", async (req, res) => {
  try {
    const range = exactRange(req.query as Record<string, unknown>);
    const receipts = await queryUnifiedReceipts(range);
    res.json({ ok: true, source: "unified_reporting_ledger", filters: range, receipts });
  } catch (error: any) {
    res.status(400).json({ ok: false, source: "unified_reporting_ledger", error: error.message });
  }
});

router.get("/receipts/:source/:id", async (req, res) => {
  try {
    const receipt = await queryUnifiedReceiptDetails(String(req.params.source), String(req.params.id));
    if (!receipt) return res.status(404).json({ ok: false, source: "unified_reporting_ledger", error: "Receipt not found" });
    res.json({ ok: true, source: "unified_reporting_ledger", receipt });
  } catch (error: any) {
    res.status(400).json({ ok: false, source: "unified_reporting_ledger", error: error.message });
  }
});

router.get("/items", async (req, res) => {
  try {
    const range = exactRange(req.query as Record<string, unknown>);
    const items = await queryUnifiedItemSales(range);
    res.json({ ok: true, source: "unified_reporting_ledger", filters: range, items });
  } catch (error: any) {
    res.status(400).json({ ok: false, source: "unified_reporting_ledger", error: error.message });
  }
});

router.get("/components", async (req, res) => {
  try {
    const range = exactRange(req.query as Record<string, unknown>);
    const components = await queryUnifiedComponents(range);
    res.json({ ok: true, source: "unified_reporting_ledger", filters: range, ...components });
  } catch (error: any) {
    res.status(400).json({ ok: false, source: "unified_reporting_ledger", error: error.message });
  }
});

export default router;

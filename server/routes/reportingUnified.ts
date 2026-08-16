import { Router } from "express";
import {
  queryUnifiedItemSales,
  queryUnifiedOverview,
  queryUnifiedReceipts,
  resolveExactReportingRange,
} from "../reporting/unifiedLedger";
import { queryUnifiedReceiptDetails } from "../reporting/unifiedReceiptDetails";
import { queryUnifiedComponents } from "../reporting/unifiedComponents";
import { queryUnifiedOverviewBreakdowns } from "../reporting/unifiedOverviewBreakdowns";
import { calculateLabourEfficiency, queryRecordedLabor } from "../reporting/unifiedLabor";

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

function dailyShiftMinutes(fromTime: string, toTime: string) {
  const minutes = (value: string) => {
    const [hours, mins] = value.split(":").map(Number);
    return hours * 60 + mins;
  };
  const from = minutes(fromTime);
  const to = minutes(toTime);
  return to > from ? to - from : to + 24 * 60 - from;
}

router.get("/overview", async (req, res) => {
  try {
    const range = exactRange(req.query as Record<string, unknown>);
    const [overview, breakdowns, recordedLabor] = await Promise.all([
      queryUnifiedOverview(range),
      queryUnifiedOverviewBreakdowns(range),
      queryRecordedLabor(range),
    ]);
    const itemCount = breakdowns.categories.reduce(
      (sum: number, row: { quantity: number }) => sum + Number(row.quantity || 0),
      0,
    );
    const shiftMinutes = dailyShiftMinutes(range.fromTime, range.toTime);
    const efficiency = calculateLabourEfficiency({
      itemCount,
      staffCount: recordedLabor.staffShiftCount,
      shiftCount: recordedLabor.recordedShiftCount,
      shiftMinutes,
    });
    res.json({
      ok: true,
      source: "unified_reporting_ledger",
      filters: range,
      sourcesIncluded: [
        ...(overview.historicalReceipts ? ["loyverse"] : []),
        ...(overview.liveReceipts ? ["sbb_pos"] : []),
      ],
      overview,
      breakdowns,
      labor: {
        ...recordedLabor,
        laborCostPct: overview.netSales > 0 ? (recordedLabor.laborCost / overview.netSales) * 100 : null,
        efficiency,
        source: "daily_sales_v2_recorded_wages",
        demandSource: "unified_reporting_ledger_paid_item_quantity",
      },
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

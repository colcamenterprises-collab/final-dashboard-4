import { Router } from "express";
import {
  queryBurgerUsage,
  queryUnifiedOverview,
  queryUnifiedReceipts,
  resolveExactReportingRange,
} from "../reporting/unifiedLedger";
import { querySnapshotItemSales } from "../reporting/snapshotItemSales";
import { queryUnifiedReceiptDetails } from "../reporting/unifiedReceiptDetails";
import { queryUnifiedComponents } from "../reporting/unifiedComponents";
import { queryUnifiedOverviewBreakdowns } from "../reporting/unifiedOverviewBreakdowns";
import { calculateLabourEfficiency, queryRecordedLabor } from "../reporting/unifiedLabor";
import { queryIngredientUsage } from "../reporting/ingredientUsage";

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

function categoryProfitability(itemSales: any[]) {
  const categories = new Map<string, { category: string; quantity: number; grossSales: number; discounts: number; netSales: number; costOfGoods: number; costedNetSales: number; uncostedNetSales: number }>();
  for (const item of itemSales) {
    const category = String(item.category || "Other");
    const current = categories.get(category) || { category, quantity: 0, grossSales: 0, discounts: 0, netSales: 0, costOfGoods: 0, costedNetSales: 0, uncostedNetSales: 0 };
    current.quantity += Number(item.quantity || 0);
    current.grossSales += Number(item.gross_sales || 0);
    current.discounts += Number(item.discounts || 0);
    current.netSales += Number(item.net_sales || 0);
    current.costOfGoods += Number(item.known_cost_of_goods || 0);
    current.costedNetSales += Number(item.costed_net_sales || 0);
    current.uncostedNetSales += Number(item.uncosted_net_sales || 0);
    categories.set(category, current);
  }
  return Array.from(categories.values()).map((row) => {
    const fullyCosted = Math.abs(row.uncostedNetSales) < 0.005;
    const grossProfit = fullyCosted ? row.netSales - row.costOfGoods : null;
    return {
      ...row,
      fullyCosted,
      grossProfit,
      foodCostPct: fullyCosted && row.netSales > 0 ? row.costOfGoods / row.netSales * 100 : null,
      grossMarginPct: grossProfit != null && row.netSales > 0 ? grossProfit / row.netSales * 100 : null,
      costingCoveragePct: row.netSales > 0 ? row.costedNetSales / row.netSales * 100 : null,
    };
  }).sort((a,b) => b.netSales-a.netSales || a.category.localeCompare(b.category));
}

router.get("/overview", async (req, res) => {
  try {
    const range = exactRange(req.query as Record<string, unknown>);
    const [overview, breakdowns, recordedLabor, itemSales, ingredientUsage] = await Promise.all([
      queryUnifiedOverview(range),
      queryUnifiedOverviewBreakdowns(range),
      queryRecordedLabor(range),
      querySnapshotItemSales(range),
      queryIngredientUsage(range),
    ]);
    const itemCount = breakdowns.categories.reduce(
      (sum: number, row: { quantity: number }) => sum + Number(row.quantity || 0),
      0,
    );
    const shiftMinutes = dailyShiftMinutes(range.fromTime, range.toTime);
    const uncostedItemSales = itemSales.filter((item: any) => Math.abs(Number(item.uncosted_net_sales || 0)) >= 0.005);
    const costedNetSales = itemSales.reduce((sum: number, item: any) => sum + Number(item.costed_net_sales || 0), 0);
    const costOfGoods = itemSales.reduce((sum: number, item: any) => sum + Number(item.known_cost_of_goods || 0), 0);
    const profitCoveredNetSales = itemSales.reduce((sum: number, item: any) => sum + Number(item.profit_covered_net_sales || 0), 0);
    const knownGrossProfit = itemSales.reduce((sum: number, item: any) => sum + Number(item.known_gross_profit || 0), 0);
    const itemNetSales = itemSales.reduce((sum: number, item: any) => sum + Number(item.net_sales || 0), 0);
    const uncostedNetSales = itemSales.reduce((sum: number, item: any) => sum + Number(item.uncosted_net_sales || 0), 0);
    const fullyCosted = Math.abs(uncostedNetSales) < 0.005;
    const grossProfit = fullyCosted ? overview.netSales - costOfGoods : null;
    const efficiency = calculateLabourEfficiency({
      itemCount,
      staffCount: recordedLabor.staffShiftCount,
      shiftCount: recordedLabor.recordedShiftCount,
      shiftMinutes,
    });
    const profitabilityByCategory = categoryProfitability(itemSales);
    const costingCoveragePct = itemNetSales > 0 ? (costedNetSales / itemNetSales) * 100 : null;

    res.json({
      ok: true,
      source: "unified_reporting_ledger",
      filters: range,
      sourcesIncluded: [
        ...(overview.historicalReceipts ? ["loyverse"] : []),
        ...(overview.liveReceipts ? ["sbb_pos"] : []),
      ],
      overview: {
        ...overview,
        costing: {
          costOfGoods,
          grossProfit,
          knownGrossProfit,
          costedNetSales,
          uncostedNetSales,
          uncostedItemCount: uncostedItemSales.length,
          itemNetSales,
          coveragePct: costingCoveragePct,
          fullyCosted,
          foodCostPct: fullyCosted && overview.netSales > 0 ? (costOfGoods / overview.netSales) * 100 : null,
          knownFoodCostPct: costedNetSales > 0 ? (costOfGoods / costedNetSales) * 100 : null,
          grossMarginPct: grossProfit != null && overview.netSales > 0 ? (grossProfit / overview.netSales) * 100 : null,
          knownGrossMarginPct: profitCoveredNetSales > 0 ? (knownGrossProfit / profitCoveredNetSales) * 100 : null,
        },
      },
      breakdowns: {
        ...breakdowns,
        profitabilityByCategory,
      },
      ingredientUsage,
      exceptions: [
        ...(uncostedItemSales.length ? [{
          code: "UNCOSTED_SALES",
          severity: "warning",
          label: "Uncosted sales",
          amount: uncostedNetSales,
          count: uncostedItemSales.length,
          message: `${uncostedItemSales.length} sold menu item${uncostedItemSales.length === 1 ? "" : "s"} include sales without a complete sale-time cost snapshot. Gross profit and food cost are withheld until coverage is complete.`,
        }] : []),
        ...(ingredientUsage.coverage.unmappedItemQuantity > 0 ? [{
          code: "UNMAPPED_INGREDIENT_USAGE",
          severity: "warning",
          label: "Ingredient mapping incomplete",
          amount: null,
          count: ingredientUsage.coverage.unmappedItemQuantity,
          message: `${ingredientUsage.coverage.unmappedItemQuantity} sold item units have no usable recipe ingredient mapping.`,
        }] : []),
      ],
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

router.get("/ingredient-usage", async (req, res) => {
  try {
    const range = exactRange(req.query as Record<string, unknown>);
    const usage = await queryIngredientUsage(range);
    res.json({ ok: true, source: "sbb_pos_recipe_ingredient_usage", filters: range, ...usage });
  } catch (error: any) {
    res.status(400).json({ ok: false, source: "sbb_pos_recipe_ingredient_usage", error: error.message });
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
    const items = await querySnapshotItemSales(range);
    res.json({ ok: true, source: "unified_reporting_ledger", filters: range, items });
  } catch (error: any) {
    res.status(400).json({ ok: false, source: "unified_reporting_ledger", error: error.message });
  }
});

router.get("/burger-usage", async (req, res) => {
  try {
    const range = exactRange(req.query as Record<string, unknown>);
    const burgers = await queryBurgerUsage(range);
    const readyRows = burgers.filter((burger) => burger.recipeStatus === "READY");
    const soldQuantity = burgers.reduce((sum, burger) => sum + Number(burger.soldQuantity || 0), 0);
    const mappedSoldQuantity = readyRows.reduce((sum, burger) => sum + Number(burger.soldQuantity || 0), 0);
    res.json({
      ok: true,
      source: "sbb_pos_recipe_usage",
      filters: range,
      scope: "Active Burgers and Chicken Burgers only; sets, sides, modifiers and historical Loyverse sales are excluded.",
      burgers,
      coverage: {
        menuItems: burgers.length,
        readyMenuItems: readyRows.length,
        soldQuantity,
        mappedSoldQuantity,
        coveragePct: soldQuantity > 0 ? (mappedSoldQuantity / soldQuantity) * 100 : null,
      },
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, source: "sbb_pos_recipe_usage", error: error.message });
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

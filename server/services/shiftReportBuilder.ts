// PATCH 4+6 — ADVANCED VARIANCE ENGINE + AI INSIGHTS
// STRICT: Do not modify any other modules.

import { db } from "../lib/prisma";
import { generateAIInsights } from "./shiftReportInsights";

/**
 * Utility: Normalize date to YYYY-MM-DD local Bangkok.
 */
function normalizeToISO(date: Date) {
  return date.toISOString().split("T")[0];
}

/**
 * Fetch the Daily Sales V2 record for the shift.
 */
async function getDailySales(shiftDate: Date) {
  const prisma = db();
  const iso = normalizeToISO(shiftDate);

  return prisma.dailySalesV2.findFirst({
    where: {
      createdAt: {
        gte: new Date(`${iso}T00:00:00+07:00`),
        lte: new Date(`${iso}T23:59:59+07:00`),
      },
    },
  });
}

/**
 * Fetch matching Daily Stock V2.
 */
async function getDailyStock(salesId: string) {
  const prisma = db();
  return prisma.dailyStockV2.findUnique({
    where: { salesId },
  });
}

/**
 * Fetch POS Shift Report for the date.
 */
async function getPOSShiftReport(shiftDate: Date) {
  const prisma = db();
  const iso = normalizeToISO(shiftDate);

  return prisma.posShiftReport.findFirst({
    where: {
      shiftDate: {
        gte: new Date(`${iso}T00:00:00+07:00`),
        lte: new Date(`${iso}T23:59:59+07:00`),
      },
    },
  });
}

/**
 * Advanced variance engine.
 */
function computeAdvancedVariances(sales: any, pos: any) {
  if (!sales || !pos) return { errors: ["Missing sales or POS data"], level: "RED" };

  const variances: any = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Cash reconciliation
  const posCash = pos.cash_sales || 0;
  const staffCashTotal = sales.cash_total || 0;

  variances.cashVariance = staffCashTotal - posCash;

  if (Math.abs(variances.cashVariance) <= 20) {
    variances.cashVarianceLevel = "GREEN";
  } else if (Math.abs(variances.cashVariance) <= 100) {
    variances.cashVarianceLevel = "YELLOW";
    warnings.push("Cash variance outside tolerance but under critical threshold.");
  } else {
    variances.cashVarianceLevel = "RED";
    errors.push("Critical cash variance detected.");
  }

  // 2. QR reconciliation
  const qrPOS = pos.qr_sales || 0;
  const qrForm = sales.qr_total || 0;
  const qrTransfer = sales.qr_transfer_amount || 0;

  variances.qrVariance = qrForm - qrPOS;

  variances.qrSettlementVariance = qrTransfer - qrPOS;

  if (Math.abs(variances.qrVariance) > 20) {
    errors.push("QR variance exceeds tolerance.");
  }

  // 3. Grab reconciliation
  const grabPOS = pos.grab_sales || 0;
  const grabForm = sales.grab_total || 0;

  variances.grabVariance = grabForm - grabPOS;

  if (Math.abs(variances.grabVariance) > 20) {
    warnings.push("Grab variance outside tolerance.");
  }

  // 4. Total sales reconciliation
  const totalPOS = pos.total_sales || 0;
  const totalForm = sales.total_sales || 0;

  variances.totalSalesVariance = totalForm - totalPOS;

  if (Math.abs(variances.totalSalesVariance) > 50) {
    errors.push("Major sales mismatch between POS and staff form.");
  }

  // 5. Void and discount monitoring
  const voids = pos.void_total || 0;
  const discounts = pos.discount_total || 0;

  if (voids > 3) warnings.push("High number of voids detected.");
  if (discounts > 200) warnings.push("Unusual discount total detected.");

  // Severity level
  let level = "GREEN";
  if (errors.length) level = "RED";
  else if (warnings.length) level = "YELLOW";

  return {
    ...variances,
    errors,
    warnings,
    level,
  };
}

/**
 * Main builder.
 */
export async function buildShiftReport(shiftDate: Date) {
  try {
    const prisma = db();
    console.log("SHIFT REPORT BUILD START:", shiftDate);

    // SALES
    const sales = await getDailySales(shiftDate);
    if (!sales) {
      const missingSalesVariances = { level: "RED", errors: ["Missing Daily Sales V2"] };
      return prisma.shift_report_v2.create({
        data: {
          shiftDate,
          salesData: {},
          stockData: {},
          posData: {},
          variances: missingSalesVariances,
          aiInsights: generateAIInsights({ variances: missingSalesVariances }),
        },
      });
    }

    // STOCK
    const stock = await getDailyStock(sales.id);

    // POS
    const pos = await getPOSShiftReport(shiftDate);
    if (!pos) {
      const missingPOSVariances = { level: "RED", errors: ["Missing POS shift report"] };
      return prisma.shift_report_v2.create({
        data: {
          shiftDate,
          salesId: sales.id,
          stockId: stock?.salesId || null,
          salesData: sales,
          stockData: stock || {},
          posData: {},
          variances: missingPOSVariances,
          aiInsights: generateAIInsights({ variances: missingPOSVariances }),
        },
      });
    }

    // Variance engine
    const variances = computeAdvancedVariances(sales, pos);

    // Generate AI insights
    const aiInsights = generateAIInsights({
      salesData: sales,
      stockData: stock,
      posData: pos,
      variances,
    });

    // Assemble final shift report
    const report = await prisma.shift_report_v2.create({
      data: {
        shiftDate,
        salesId: sales.id,
        stockId: stock?.salesId || null,
        salesData: sales,
        stockData: stock || {},
        posData: pos,
        variances,
        aiInsights,
      },
    });

    console.log("SHIFT REPORT BUILD COMPLETE:", report.id);
    return report;
  } catch (err) {
    console.error("Shift Report build error:", err);
    return null;
  }
}

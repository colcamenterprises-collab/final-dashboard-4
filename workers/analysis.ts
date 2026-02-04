import cron from "node-cron";
import { format, utcToZonedTime } from "date-fns-tz";
import { subDays } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { analysisReports } from "../schema";
import { sendMail } from "../server/email/mailer";
import { rebuildReceiptTruth } from "../server/services/receiptTruthSummary";
import { rebuildIngredientTruth } from "../server/services/receiptTruthIngredientService";
import { getIngredientReconciliationForDate } from "../server/services/ingredientReconciliationService";

const REPORT_TYPE = "ingredient_reconciliation_daily";
const TIMEZONE = process.env.REPORT_TIMEZONE || "Asia/Bangkok";

function getBusinessDate(date: Date): string {
  const zoned = utcToZonedTime(date, TIMEZONE);
  return format(zoned, "yyyy-MM-dd", { timeZone: TIMEZONE });
}

async function buildVarianceReport(reportDate: string) {
  if (!db) {
    console.warn("[analysis] Database unavailable. Skipping variance report.");
    return;
  }

  const existingReport = await db
    .select({ data: analysisReports.data })
    .from(analysisReports)
    .where(and(eq(analysisReports.reportDate, reportDate), eq(analysisReports.reportType, REPORT_TYPE)))
    .limit(1);

  const alreadyAlerted = Boolean(existingReport[0]?.data?.alertSent);

  try {
    await rebuildReceiptTruth(reportDate);
    await rebuildIngredientTruth(reportDate);
  } catch (error: any) {
    console.warn(`[analysis] Rebuild failed for ${reportDate}: ${error?.message}`);
    return;
  }

  const reconciliation = await getIngredientReconciliationForDate(reportDate);
  if (!reconciliation.ok) {
    console.warn(`[analysis] Reconciliation unavailable for ${reportDate}: ${reconciliation.error}`);
    return;
  }

  const varianceRows = reconciliation.details.map((row) => ({
    ingredientName: row.ingredientName,
    usageQty: row.usedQuantity,
    purchaseQty: row.purchasedQuantity,
    unit: row.unit,
    variancePct: row.variancePct,
    status: row.status,
  }));

  const alertRows = varianceRows.filter(
    (row) => row.variancePct !== null && Math.abs(row.variancePct) > 10
  );
  const shouldAlert = alertRows.length > 0 && !alreadyAlerted;

  const reportData = {
    reportDate,
    generatedAt: new Date().toISOString(),
    variancePct: reconciliation.variancePct,
    reconciled: reconciliation.reconciled,
    varianceRows,
    alertSent: alreadyAlerted,
  };

  await db
    .insert(analysisReports)
    .values({
      reportDate,
      reportType: REPORT_TYPE,
      data: reportData,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [analysisReports.reportDate, analysisReports.reportType],
      set: { data: reportData, updatedAt: new Date() },
    });

  if (shouldAlert) {
    const to = process.env.ALERT_EMAIL_TO || process.env.REPORT_TO || process.env.GMAIL_USER;
    if (!to) {
      console.warn("[analysis] ALERT_EMAIL_TO not set; skipping email.");
    } else {
      const rowsHtml = alertRows
        .map(
          (row) => `
          <tr>
            <td>${row.ingredientName}</td>
            <td>${row.usageQty}</td>
            <td>${row.purchaseQty}</td>
            <td>${row.variancePct ?? ""}</td>
            <td>${row.unit ?? ""}</td>
            <td>${row.status}</td>
          </tr>
        `
        )
        .join("");

      const html = `
        <table border="1" cellpadding="6" cellspacing="0">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Usage Qty</th>
              <th>Purchased Qty</th>
              <th>Variance %</th>
              <th>Unit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;

      await sendMail({
        to,
        subject: `Ingredient reconciliation variance alert (${reportDate})`,
        html,
      });

      reportData.alertSent = true;
      await db
        .update(analysisReports)
        .set({ data: reportData, updatedAt: new Date() })
        .where(and(eq(analysisReports.reportDate, reportDate), eq(analysisReports.reportType, REPORT_TYPE)));
    }
  }
}

cron.schedule("0 4 * * *", async () => {
  const reportDate = getBusinessDate(subDays(new Date(), 1));
  await buildVarianceReport(reportDate);
});

export async function runVarianceAnalysisForDate(reportDate: string) {
  await buildVarianceReport(reportDate);
}

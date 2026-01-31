import cron from "node-cron";
import { format, utcToZonedTime } from "date-fns-tz";
import { subDays } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  analysisReports,
  ingredients,
  purchaseAnalyticsV2,
  receiptBatchItems,
  receiptBatchSummary,
  recipeIngredient,
  recipeSkuMap,
} from "../schema";
import { sendMail } from "../server/email/mailer";

const REPORT_TYPE = "ingredient_variance_daily";
const TIMEZONE = process.env.REPORT_TIMEZONE || "Asia/Bangkok";

function getBusinessDate(date: Date): string {
  const zoned = utcToZonedTime(date, TIMEZONE);
  return format(zoned, "yyyy-MM-dd", { timeZone: TIMEZONE });
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  const batch = await db
    .select({ id: receiptBatchSummary.id })
    .from(receiptBatchSummary)
    .where(eq(receiptBatchSummary.businessDate, reportDate))
    .limit(1);

  if (batch.length === 0) {
    console.warn(`[analysis] No receipt batch summary for ${reportDate}.`);
    return;
  }

  const items = await db
    .select({
      sku: receiptBatchItems.sku,
      itemName: receiptBatchItems.itemName,
      quantity: receiptBatchItems.quantity,
    })
    .from(receiptBatchItems)
    .where(eq(receiptBatchItems.batchId, batch[0].id));

  const skuList = items.map((item) => item.sku).filter(Boolean) as string[];
  const mappings = skuList.length
    ? await db
        .select({ sku: recipeSkuMap.channelSku, recipeId: recipeSkuMap.recipeId })
        .from(recipeSkuMap)
        .where(inArray(recipeSkuMap.channelSku, skuList))
    : [];

  const skuToRecipe = new Map<string, number>();
  for (const mapping of mappings) {
    skuToRecipe.set(mapping.sku, mapping.recipeId);
  }

  const recipeIds = Array.from(new Set(mappings.map((m) => m.recipeId)));
  const recipeIngredients = recipeIds.length
    ? await db
        .select({
          recipeId: recipeIngredient.recipeId,
          ingredientId: recipeIngredient.ingredientId,
          portionQty: recipeIngredient.portionQty,
          unit: recipeIngredient.unit,
          wastePercentage: recipeIngredient.wastePercentage,
          ingredientName: ingredients.name,
          baseUnit: ingredients.baseUnit,
        })
        .from(recipeIngredient)
        .leftJoin(ingredients, eq(recipeIngredient.ingredientId, ingredients.id))
        .where(inArray(recipeIngredient.recipeId, recipeIds))
    : [];

  const ingredientsByRecipe = new Map<number, typeof recipeIngredients>();
  for (const row of recipeIngredients) {
    const list = ingredientsByRecipe.get(row.recipeId) ?? [];
    list.push(row);
    ingredientsByRecipe.set(row.recipeId, list);
  }

  const usageByIngredient = new Map<
    number,
    { name: string; qty: number; unit: string | null }
  >();
  const unmappedItems: Array<{ sku: string | null; name: string | null }> = [];

  for (const item of items) {
    const sku = item.sku ?? null;
    const recipeId = sku ? skuToRecipe.get(sku) : null;
    if (!recipeId) {
      unmappedItems.push({ sku, name: item.itemName ?? null });
      continue;
    }

    const soldQty = toNumber(item.quantity) ?? 0;
    const recipeLines = ingredientsByRecipe.get(recipeId) ?? [];
    for (const line of recipeLines) {
      const ingredientId = line.ingredientId ?? null;
      if (!ingredientId) continue;

      const portionQty = toNumber(line.portionQty);
      if (!portionQty) continue;
      const wastePct = toNumber(line.wastePercentage) ?? 5;
      const usageQty = portionQty * soldQty * (1 + wastePct / 100);
      const unit = line.baseUnit || line.unit || null;
      const name = line.ingredientName ?? `Ingredient ${ingredientId}`;

      const existing = usageByIngredient.get(ingredientId);
      if (existing) {
        existing.qty += usageQty;
      } else {
        usageByIngredient.set(ingredientId, { name, qty: usageQty, unit });
      }
    }
  }

  const purchaseRows = await db
    .select({
      ingredientId: purchaseAnalyticsV2.ingredientId,
      qty: purchaseAnalyticsV2.qty,
      unit: purchaseAnalyticsV2.unit,
    })
    .from(purchaseAnalyticsV2)
    .where(eq(purchaseAnalyticsV2.date, reportDate));

  const purchasesByIngredient = new Map<number, { qty: number; unit: string | null }>();
  for (const row of purchaseRows) {
    if (!row.ingredientId) continue;
    const qty = toNumber(row.qty) ?? 0;
    const existing = purchasesByIngredient.get(row.ingredientId);
    if (existing) {
      existing.qty += qty;
    } else {
      purchasesByIngredient.set(row.ingredientId, { qty, unit: row.unit ?? null });
    }
  }

  const varianceRows = Array.from(usageByIngredient.entries()).map(([ingredientId, usage]) => {
    const purchase = purchasesByIngredient.get(ingredientId);
    const purchaseQty = purchase?.qty ?? 0;
    const unit = usage.unit || purchase?.unit || null;
    let variancePct: number | null = null;
    let status = "OK";

    if (!purchase || purchaseQty === 0) {
      status = "INSUFFICIENT_DATA";
    } else if (purchase?.unit && usage.unit && purchase.unit !== usage.unit) {
      status = "UNIT_MISMATCH";
    } else {
      variancePct = ((usage.qty - purchaseQty) / purchaseQty) * 100;
      status = Math.abs(variancePct) > 10 ? "ALERT" : "OK";
    }

    return {
      ingredientId,
      ingredientName: usage.name,
      usageQty: Number(usage.qty.toFixed(4)),
      purchaseQty: Number(purchaseQty.toFixed(4)),
      unit,
      variancePct: variancePct !== null ? Number(variancePct.toFixed(2)) : null,
      status,
    };
  });

  const alertRows = varianceRows.filter((row) => row.variancePct !== null && Math.abs(row.variancePct) > 10);
  const shouldAlert = alertRows.length > 0 && !alreadyAlerted;

  const reportData = {
    reportDate,
    generatedAt: new Date().toISOString(),
    varianceRows,
    unmappedItems,
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
        subject: `Ingredient variance alert (${reportDate})`,
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

cron.schedule("0 0 * * *", async () => {
  const reportDate = getBusinessDate(subDays(new Date(), 1));
  await buildVarianceReport(reportDate);
});

export async function runVarianceAnalysisForDate(reportDate: string) {
  await buildVarianceReport(reportDate);
}

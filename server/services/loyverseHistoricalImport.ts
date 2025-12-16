// PATCH LY-1 — LOYVERSE HISTORICAL IMPORT SERVICE
// Imports Loyverse data from July 1, 2025 → today
// READ-ONLY, source-tagged, idempotent

import { db } from "../lib/prisma";

const LOYVERSE_API_URL = "https://api.loyverse.com/v1.0";
const LOYVERSE_ACCESS_TOKEN = process.env.LOYVERSE_ACCESS_TOKEN || "";

interface LoyverseReceipt {
  receipt_number: string;
  receipt_type: string;
  receipt_date: string;
  created_at: string;
  updated_at: string;
  line_items: Array<{
    id: string;
    item_id: string;
    item_name: string;
    variant_id: string;
    sku: string;
    quantity: number;
    price: number;
    gross_total_money: number;
    total_money: number;
    modifiers: any[];
  }>;
  payments: Array<{
    payment_type_id: string;
    payment_type: string;
    money_amount: number;
  }>;
  total_money: number;
  total_discount: number;
}

interface ImportResult {
  success: boolean;
  shiftsImported: number;
  salesImported: number;
  startDate: string;
  endDate: string;
  errors: string[];
}

async function fetchWithAuth(endpoint: string): Promise<any> {
  const response = await fetch(`${LOYVERSE_API_URL}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${LOYVERSE_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Loyverse API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function fetchReceiptsByDateRange(
  startDate: string,
  endDate: string
): Promise<LoyverseReceipt[]> {
  const allReceipts: LoyverseReceipt[] = [];
  let cursor: string | null = null;

  console.log(`[LoyverseHistory] Fetching receipts from ${startDate} to ${endDate}`);

  do {
    const params = new URLSearchParams({
      created_at_min: startDate,
      created_at_max: endDate,
      limit: "250"
    });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const data = await fetchWithAuth(`/receipts?${params.toString()}`);
    const receipts = data.receipts || [];
    allReceipts.push(...receipts);
    cursor = data.cursor || null;

    console.log(`[LoyverseHistory] Fetched ${receipts.length} receipts (total: ${allReceipts.length})`);
  } while (cursor);

  return allReceipts;
}

function groupReceiptsByShiftDate(receipts: LoyverseReceipt[]): Map<string, LoyverseReceipt[]> {
  const groups = new Map<string, LoyverseReceipt[]>();

  for (const receipt of receipts) {
    const receiptDate = new Date(receipt.created_at);
    const bangkokHour = receiptDate.getUTCHours() + 7;
    
    let shiftDate: Date;
    if (bangkokHour >= 0 && bangkokHour < 4) {
      shiftDate = new Date(receiptDate);
      shiftDate.setUTCDate(shiftDate.getUTCDate() - 1);
    } else {
      shiftDate = new Date(receiptDate);
    }

    const dateKey = shiftDate.toISOString().split("T")[0];
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(receipt);
  }

  return groups;
}

function classifyPaymentType(paymentType: string): "cash" | "card" | "qr" | "other" {
  const type = paymentType.toLowerCase();
  if (type.includes("cash")) return "cash";
  if (type.includes("card") || type.includes("credit") || type.includes("debit")) return "card";
  if (type.includes("qr") || type.includes("promptpay") || type.includes("grab") || type.includes("linepay")) return "qr";
  return "other";
}

export async function importHistoricalData(
  startDateStr: string = "2025-07-01",
  endDateStr?: string
): Promise<ImportResult> {
  const prisma = db();
  const errors: string[] = [];
  let shiftsImported = 0;
  let salesImported = 0;

  const endDate = endDateStr || new Date().toISOString().split("T")[0];
  const startDateISO = `${startDateStr}T00:00:00Z`;
  const endDateISO = `${endDate}T23:59:59Z`;

  console.log(`[LoyverseHistory] Starting import: ${startDateStr} to ${endDate}`);

  try {
    const receipts = await fetchReceiptsByDateRange(startDateISO, endDateISO);
    console.log(`[LoyverseHistory] Total receipts fetched: ${receipts.length}`);

    const shiftGroups = groupReceiptsByShiftDate(receipts);

    for (const [shiftDate, shiftReceipts] of shiftGroups) {
      try {
        const existing = await prisma.historical_shifts_v1.findFirst({
          where: { shiftDate, source: "loyverse_import" }
        });

        if (existing) {
          console.log(`[LoyverseHistory] Skipping ${shiftDate} - already imported`);
          continue;
        }

        let totalRevenue = 0;
        let cashAmount = 0;
        let cardAmount = 0;
        let qrAmount = 0;
        let otherAmount = 0;
        const itemSales: Map<string, { itemId: string; itemName: string; categoryName: string; qty: number; gross: number }> = new Map();

        for (const receipt of shiftReceipts) {
          totalRevenue += receipt.total_money || 0;

          for (const payment of receipt.payments || []) {
            const ptype = classifyPaymentType(payment.payment_type || "");
            const amount = payment.money_amount || 0;
            
            switch (ptype) {
              case "cash": cashAmount += amount; break;
              case "card": cardAmount += amount; break;
              case "qr": qrAmount += amount; break;
              default: otherAmount += amount; break;
            }
          }

          for (const item of receipt.line_items || []) {
            const key = item.item_id || item.item_name;
            const existing = itemSales.get(key) || {
              itemId: item.item_id || "",
              itemName: item.item_name || "Unknown",
              categoryName: "",
              qty: 0,
              gross: 0
            };
            existing.qty += item.quantity || 1;
            existing.gross += item.gross_total_money || item.total_money || 0;
            itemSales.set(key, existing);
          }
        }

        const topItems = Array.from(itemSales.values())
          .sort((a, b) => b.gross - a.gross)
          .slice(0, 10);

        await prisma.historical_shifts_v1.create({
          data: {
            shiftDate,
            businessDate: new Date(shiftDate),
            source: "loyverse_import",
            totalReceipts: shiftReceipts.length,
            totalRevenue: totalRevenue / 100,
            totalOrders: shiftReceipts.length,
            cashAmount: cashAmount / 100,
            cardAmount: cardAmount / 100,
            qrAmount: qrAmount / 100,
            otherAmount: otherAmount / 100,
            topItems: topItems.map(i => ({
              name: i.itemName,
              qty: i.qty,
              revenue: i.gross / 100
            }))
          }
        });

        shiftsImported++;

        for (const item of itemSales.values()) {
          await prisma.historical_sales_v1.create({
            data: {
              shiftDate,
              businessDate: new Date(shiftDate),
              source: "loyverse_import",
              itemId: item.itemId,
              itemName: item.itemName,
              categoryName: item.categoryName || null,
              quantitySold: item.qty,
              grossSales: item.gross / 100,
              netSales: item.gross / 100
            }
          });
          salesImported++;
        }

        console.log(`[LoyverseHistory] Imported shift ${shiftDate}: ${shiftReceipts.length} receipts, ${itemSales.size} items`);

      } catch (e: any) {
        const msg = `Failed to import ${shiftDate}: ${e.message}`;
        console.error(`[LoyverseHistory] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(`[LoyverseHistory] Import complete: ${shiftsImported} shifts, ${salesImported} item sales`);

    return {
      success: errors.length === 0,
      shiftsImported,
      salesImported,
      startDate: startDateStr,
      endDate,
      errors
    };

  } catch (e: any) {
    console.error("[LoyverseHistory] Fatal error:", e);
    return {
      success: false,
      shiftsImported,
      salesImported,
      startDate: startDateStr,
      endDate,
      errors: [e.message]
    };
  }
}

export async function getHistoricalStats() {
  const prisma = db();

  const [shiftCount, salesCount, totalRevenue, earliestShift, latestShift] = await Promise.all([
    prisma.historical_shifts_v1.count(),
    prisma.historical_sales_v1.count(),
    prisma.historical_shifts_v1.aggregate({ _sum: { totalRevenue: true } }),
    prisma.historical_shifts_v1.findFirst({ orderBy: { businessDate: "asc" }, select: { shiftDate: true } }),
    prisma.historical_shifts_v1.findFirst({ orderBy: { businessDate: "desc" }, select: { shiftDate: true } })
  ]);

  const totalOrders = await prisma.historical_shifts_v1.aggregate({ _sum: { totalOrders: true } });
  const totalReceipts = await prisma.historical_shifts_v1.aggregate({ _sum: { totalReceipts: true } });

  return {
    shiftsImported: shiftCount,
    salesRecords: salesCount,
    totalRevenue: totalRevenue._sum.totalRevenue || 0,
    totalOrders: totalOrders._sum.totalOrders || 0,
    totalReceipts: totalReceipts._sum.totalReceipts || 0,
    dateRange: {
      earliest: earliestShift?.shiftDate || null,
      latest: latestShift?.shiftDate || null
    }
  };
}

export const loyverseHistoricalService = {
  importHistoricalData,
  getHistoricalStats
};

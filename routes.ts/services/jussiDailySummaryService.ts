// jussiDailySummaryService.ts

import { db } from "../db";
import { loyverseReceipts, dailyReceiptSummaries } from '../../shared/schema';
import { and, gte, lte, eq } from 'drizzle-orm';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const BKK_TIMEZONE = "Asia/Bangkok";

export async function generateJussiSummaryForDate(targetDate: string) {
  // Calculate shift times in Bangkok timezone using dayjs
  const bangkokTime = dayjs.tz(targetDate, BKK_TIMEZONE);
  const shiftStart = bangkokTime.hour(17).minute(0).second(0); // 5 PM
  const shiftEnd = bangkokTime.add(1, 'day').hour(3).minute(0).second(0); // 3 AM next day

  console.log(`Generating Jussi summary for shift: ${shiftStart.format()} to ${shiftEnd.format()}`);

  // Get receipts within shift window using Drizzle ORM
  const receipts = await db
    .select()
    .from(loyverseReceipts)
    .where(
      and(
        gte(loyverseReceipts.createdAt, shiftStart.toDate()),
        lte(loyverseReceipts.createdAt, shiftEnd.toDate())
      )
    )
    .orderBy(loyverseReceipts.createdAt);

  if (receipts.length === 0) {
    console.log(`🟡 No receipts found for shift ${targetDate}`);
    return null;
  }

  // Summary containers
  const itemSales: Record<string, number> = {};
  const modifierSales: Record<string, number> = {};
  const paymentBreakdown: Record<string, number> = {};

  let totalGross = 0;
  let totalReceipts = 0;

  for (const receipt of receipts) {
    totalGross += parseFloat(receipt.totalAmount.toString());
    totalReceipts++;

    // Count payment method
    const method = receipt.paymentMethod || "UNKNOWN";
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + 1;

    // Count items sold
    const items = Array.isArray(receipt.items)
      ? receipt.items
      : JSON.parse(receipt.items as string || "[]");

    for (const item of items) {
      const itemName = item.item_name?.trim();
      if (!itemName) continue;
      itemSales[itemName] = (itemSales[itemName] || 0) + Number(item.quantity || 1);

      if (item.modifiers && Array.isArray(item.modifiers)) {
        for (const mod of item.modifiers) {
          const modName = mod.name?.trim();
          if (!modName) continue;
          modifierSales[modName] = (modifierSales[modName] || 0) + Number(mod.quantity || 1);
        }
      }
    }
  }

  const summary = {
    date: targetDate,
    shiftStart: dayjs.tz(targetDate, 'Asia/Bangkok').hour(17).minute(0).second(0).toDate(),
    shiftEnd: dayjs.tz(targetDate, 'Asia/Bangkok').add(1, 'day').hour(3).minute(0).second(0).toDate(),
    totalReceipts: totalReceipts,
    grossSales: totalGross.toString(),
    netSales: totalGross.toString(), // Using gross sales as net for now
    paymentBreakdown: paymentBreakdown,
    itemsSold: itemSales,
    modifiersSold: modifierSales,
  };

  // Check if summary already exists and update or insert
  const existing = await db
    .select()
    .from(dailyReceiptSummaries)
    .where(eq(dailyReceiptSummaries.date, targetDate))
    .limit(1);

  if (existing.length > 0) {
    // Update existing summary
    await db
      .update(dailyReceiptSummaries)
      .set(summary)
      .where(eq(dailyReceiptSummaries.date, targetDate));
    
    console.log(`✅ Updated Jussi shift summary for ${targetDate}`);
  } else {
    // Create new summary
    await db
      .insert(dailyReceiptSummaries)
      .values(summary);
    
    console.log(`✅ Created new Jussi shift summary for ${targetDate}`);
  }

  return summary;
}
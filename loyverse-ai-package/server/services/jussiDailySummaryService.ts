import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';
import { db } from '../db';
import { dailyReceiptSummaries, loyverseReceipts } from '../../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

dayjs.extend(utc);
dayjs.extend(timezone);

export class JussiDailySummaryService {
  /**
   * Generate Jussi summary for a specific date (5PM-3AM shift cycle)
   */
  static async generateJussiSummaryForDate(shiftDate: string): Promise<any> {
    try {
      // Calculate shift times in Bangkok timezone
      const bangkokTime = dayjs.tz(shiftDate, 'Asia/Bangkok');
      const shiftStart = bangkokTime.hour(17).minute(0).second(0); // 5 PM
      const shiftEnd = bangkokTime.add(1, 'day').hour(3).minute(0).second(0); // 3 AM next day

      console.log(`Generating Jussi summary for shift: ${shiftStart.format()} to ${shiftEnd.format()}`);

      // Get receipts for the shift period
      const receipts = await db
        .select()
        .from(loyverseReceipts)
        .where(
          and(
            gte(loyverseReceipts.receiptDate, shiftStart.toDate()),
            lte(loyverseReceipts.receiptDate, shiftEnd.toDate())
          )
        )
        .orderBy(loyverseReceipts.receiptDate);

      if (!receipts || receipts.length === 0) {
        console.log(`No receipts found for shift ${shiftDate}`);
        return null;
      }

      // Process receipt data
      const firstReceipt = receipts[0].receiptNumber;
      const lastReceipt = receipts[receipts.length - 1].receiptNumber;
      let grossSales = 0;
      let netSales = 0;
      const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
      const refunds: any[] = [];
      const itemsSold: Record<string, { quantity: number; total: number }> = {};
      const modifiersSold: Record<string, { count: number; total: number }> = {};
      let rollsUsed = 0;

      for (const receipt of receipts) {
        const amount = parseFloat(receipt.totalAmount.toString());
        grossSales += amount;
        
        // Handle refunds
        const isRefund = amount < 0;
        if (isRefund) {
          refunds.push({
            receiptNumber: receipt.receiptNumber,
            amount: amount,
            date: receipt.receiptDate
          });
        } else {
          netSales += amount;
        }

        // Payment method breakdown
        const paymentMethod = receipt.paymentMethod || 'Cash';
        if (!paymentBreakdown[paymentMethod]) {
          paymentBreakdown[paymentMethod] = { count: 0, amount: 0 };
        }
        paymentBreakdown[paymentMethod].count += 1;
        paymentBreakdown[paymentMethod].amount += amount;

        // Process items from receipt
        const items = receipt.items as any[];
        if (Array.isArray(items)) {
          for (const item of items) {
            const itemName = item.item_name || item.name || 'Unknown Item';
            const quantity = parseInt(item.quantity) || 1;
            const itemTotal = parseFloat(item.line_total || item.total || item.price) || 0;

            // Track items sold
            if (!itemsSold[itemName]) {
              itemsSold[itemName] = { quantity: 0, total: 0 };
            }
            itemsSold[itemName].quantity += quantity;
            itemsSold[itemName].total += itemTotal;

            // Calculate rolls used (for burger items)
            if (itemName.toLowerCase().includes('burger') || 
                itemName.toLowerCase().includes('chicken') ||
                itemName.toLowerCase().includes('beef')) {
              rollsUsed += quantity;
            }

            // Process modifiers
            const modifiers = item.modifiers || [];
            if (Array.isArray(modifiers)) {
              for (const modifier of modifiers) {
                const modifierName = modifier.name || 'Unknown Modifier';
                const modifierTotal = parseFloat(modifier.cost || modifier.price) || 0;
                
                if (!modifiersSold[modifierName]) {
                  modifiersSold[modifierName] = { count: 0, total: 0 };
                }
                modifiersSold[modifierName].count += 1;
                modifiersSold[modifierName].total += modifierTotal;
              }
            }
          }
        }
      }

      // Generate drinks summary from items sold
      const drinksSummary: Record<string, { quantity: number }> = {};
      Object.entries(itemsSold).forEach(([itemName, data]) => {
        if (itemName.toLowerCase().includes('coke') ||
            itemName.toLowerCase().includes('sprite') ||
            itemName.toLowerCase().includes('water') ||
            itemName.toLowerCase().includes('juice') ||
            itemName.toLowerCase().includes('fanta')) {
          drinksSummary[itemName] = { quantity: data.quantity };
        }
      });

      // Store/update summary in database
      const summaryData = {
        date: shiftDate,
        shiftStart: shiftStart.toDate(),
        shiftEnd: shiftEnd.toDate(),
        firstReceipt,
        lastReceipt,
        totalReceipts: receipts.length,
        grossSales: grossSales.toString(),
        netSales: netSales.toString(),
        paymentBreakdown,
        itemsSold,
        modifiersSold,
        drinksSummary,
        rollsUsed,
        refunds,
        updatedAt: new Date()
      };

      // Check if summary already exists
      const existing = await db
        .select()
        .from(dailyReceiptSummaries)
        .where(eq(dailyReceiptSummaries.date, shiftDate))
        .limit(1);

      if (existing.length > 0) {
        // Update existing summary
        await db
          .update(dailyReceiptSummaries)
          .set(summaryData)
          .where(eq(dailyReceiptSummaries.date, shiftDate));
        
        console.log(`Updated existing summary for ${shiftDate}`);
      } else {
        // Create new summary
        await db
          .insert(dailyReceiptSummaries)
          .values(summaryData);
        
        console.log(`Created new summary for ${shiftDate}`);
      }

      return summaryData;

    } catch (error) {
      console.error(`Error generating Jussi summary for ${shiftDate}:`, error);
      throw error;
    }
  }

  /**
   * Get the most recent shift summary
   */
  static async getLatestShiftSummary(): Promise<any> {
    try {
      const latest = await db
        .select()
        .from(dailyReceiptSummaries)
        .orderBy(desc(dailyReceiptSummaries.date))
        .limit(1);

      return latest[0] || null;
    } catch (error) {
      console.error('Error getting latest shift summary:', error);
      throw error;
    }
  }

  /**
   * Get summary for specific date
   */
  static async getSummaryByDate(date: string): Promise<any> {
    try {
      const summary = await db
        .select()
        .from(dailyReceiptSummaries)
        .where(eq(dailyReceiptSummaries.date, date))
        .limit(1);

      return summary[0] || null;
    } catch (error) {
      console.error(`Error getting summary for ${date}:`, error);
      throw error;
    }
  }

  /**
   * Get summaries for last 31 days
   */
  static async getLast31DaysSummaries(): Promise<any[]> {
    try {
      const thirtyOneDaysAgo = dayjs().subtract(31, 'days').format('YYYY-MM-DD');
      
      const summaries = await db
        .select()
        .from(dailyReceiptSummaries)
        .where(gte(dailyReceiptSummaries.date, thirtyOneDaysAgo))
        .orderBy(desc(dailyReceiptSummaries.date));

      return summaries;
    } catch (error) {
      console.error('Error getting last 31 days summaries:', error);
      throw error;
    }
  }
}
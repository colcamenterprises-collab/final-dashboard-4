import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { db } from '../db';
import { dailyReceiptSummaries } from '../../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { LiveReceiptService } from './liveReceiptService';

dayjs.extend(utc);
dayjs.extend(timezone);

interface ShiftSummaryData {
  date: string;
  shiftStart: string;
  shiftEnd: string;
  firstReceipt?: string;
  lastReceipt?: string;
  totalReceipts: number;
  grossSales: number;
  netSales: number;
  paymentBreakdown: Array<{
    payment_method: string;
    count: number;
    amount: number;
  }>;
  itemsSold: Record<string, number>;
  modifiersSold: Record<string, number>;
  drinksSummary: Record<string, number>;
  rollsUsed: number;
  refunds: Array<{
    receipt_number: string;
    amount: number;
    reason?: string;
  }>;
}

export class JussiShiftSummarizer {
  private liveReceiptService: LiveReceiptService;

  constructor() {
    this.liveReceiptService = LiveReceiptService.getInstance();
  }

  /**
   * Calculate shift period for a given date (5 PM - 3 AM Bangkok time)
   */
  private getShiftPeriod(date: string): { start: string; end: string } {
    const shiftDate = dayjs.tz(date, 'Asia/Bangkok');
    const shiftStart = shiftDate.hour(17).minute(0).second(0); // 5 PM
    const shiftEnd = shiftDate.add(1, 'day').hour(3).minute(0).second(0); // 3 AM next day
    
    return {
      start: shiftStart.utc().toISOString(),
      end: shiftEnd.utc().toISOString()
    };
  }

  /**
   * Calculate rolls used based on burger items
   */
  private calculateRollsUsed(itemsSold: Record<string, number>): number {
    const burgerKeywords = ['burger', 'smash', 'double', 'triple', 'single', 'cheeseburger'];
    let rollsUsed = 0;

    Object.entries(itemsSold).forEach(([itemName, quantity]) => {
      const lowerName = itemName.toLowerCase();
      if (burgerKeywords.some(keyword => lowerName.includes(keyword))) {
        // Count burger items as 1 roll each
        rollsUsed += quantity;
      }
    });

    return rollsUsed;
  }

  /**
   * Extract drinks from items sold
   */
  private extractDrinksSummary(itemsSold: Record<string, number>): Record<string, number> {
    const drinkKeywords = ['coke', 'sprite', 'fanta', 'water', 'juice', 'schweppes', 'soda'];
    const drinksSummary: Record<string, number> = {};

    Object.entries(itemsSold).forEach(([itemName, quantity]) => {
      const lowerName = itemName.toLowerCase();
      if (drinkKeywords.some(keyword => lowerName.includes(keyword))) {
        drinksSummary[itemName] = quantity;
      }
    });

    return drinksSummary;
  }

  /**
   * Process receipts for a specific shift date
   */
  private async processShiftReceipts(date: string): Promise<ShiftSummaryData> {
    console.log(`🧠 Jussi processing shift for date: ${date}`);
    
    const { start, end } = this.getShiftPeriod(date);
    
    try {
      // Fetch receipts for this shift period from Loyverse API
      const receiptData = await this.liveReceiptService.fetchReceiptsForPeriod(start, end);
      const receipts = receiptData.receipts;

      if (receipts.length === 0) {
        console.log(`📄 No receipts found for shift ${date}`);
        return {
          date,
          shiftStart: start,
          shiftEnd: end,
          totalReceipts: 0,
          grossSales: 0,
          netSales: 0,
          paymentBreakdown: [],
          itemsSold: {},
          modifiersSold: {},
          drinksSummary: {},
          rollsUsed: 0,
          refunds: []
        };
      }

      // Sort receipts by receipt number to get first and last
      const sortedReceipts = receipts.sort((a, b) => a.receipt_number.localeCompare(b.receipt_number));
      const firstReceipt = sortedReceipts[0]?.receipt_number;
      const lastReceipt = sortedReceipts[sortedReceipts.length - 1]?.receipt_number;

      // Calculate summary data
      let grossSales = 0;
      let netSales = 0;
      const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
      const itemsSold: Record<string, number> = {};
      const modifiersSold: Record<string, number> = {};
      const refunds: Array<{ receipt_number: string; amount: number; reason?: string }> = [];

      receipts.forEach(receipt => {
        const totalMoney = parseFloat(receipt.total_money || '0');
        grossSales += totalMoney;
        netSales += totalMoney; // Assuming no discounts for now

        // Payment breakdown
        const paymentMethod = receipt.payment_type_name || 'Unknown';
        if (!paymentBreakdown[paymentMethod]) {
          paymentBreakdown[paymentMethod] = { count: 0, amount: 0 };
        }
        paymentBreakdown[paymentMethod].count += 1;
        paymentBreakdown[paymentMethod].amount += totalMoney;

        // Process receipt items
        if (receipt.receipt_items && Array.isArray(receipt.receipt_items)) {
          receipt.receipt_items.forEach((item: any) => {
            const itemName = item.item_name || item.name || 'Unknown Item';
            const quantity = parseInt(item.quantity || '1');
            
            if (itemsSold[itemName]) {
              itemsSold[itemName] += quantity;
            } else {
              itemsSold[itemName] = quantity;
            }

            // Process modifiers
            if (item.modifiers && Array.isArray(item.modifiers)) {
              item.modifiers.forEach((modifier: any) => {
                const modifierName = modifier.name || 'Unknown Modifier';
                if (modifiersSold[modifierName]) {
                  modifiersSold[modifierName] += 1;
                } else {
                  modifiersSold[modifierName] = 1;
                }
              });
            }
          });
        }

        // Check for refunds
        if (receipt.refunded_by && receipt.refunded_by !== null) {
          refunds.push({
            receipt_number: receipt.receipt_number,
            amount: totalMoney,
            reason: 'Refunded'
          });
        }
      });

      // Convert payment breakdown to array format
      const paymentBreakdownArray = Object.entries(paymentBreakdown).map(([method, data]) => ({
        payment_method: method,
        count: data.count,
        amount: data.amount
      }));

      // Calculate rolls used and drinks summary
      const rollsUsed = this.calculateRollsUsed(itemsSold);
      const drinksSummary = this.extractDrinksSummary(itemsSold);

      console.log(`✅ Jussi processed ${receipts.length} receipts for ${date}: ฿${grossSales.toFixed(2)} sales, ${rollsUsed} rolls used`);

      return {
        date,
        shiftStart: start,
        shiftEnd: end,
        firstReceipt,
        lastReceipt,
        totalReceipts: receipts.length,
        grossSales,
        netSales,
        paymentBreakdown: paymentBreakdownArray,
        itemsSold,
        modifiersSold,
        drinksSummary,
        rollsUsed,
        refunds
      };

    } catch (error) {
      console.error(`❌ Jussi failed to process shift for ${date}:`, error);
      throw error;
    }
  }

  /**
   * Store summary data in database
   */
  private async storeSummary(summaryData: ShiftSummaryData): Promise<void> {
    try {
      // Check if summary already exists
      const existing = await db
        .select()
        .from(dailyReceiptSummaries)
        .where(eq(dailyReceiptSummaries.date, summaryData.date))
        .limit(1);

      if (existing.length > 0) {
        // Update existing summary
        await db
          .update(dailyReceiptSummaries)
          .set({
            shiftStart: new Date(summaryData.shiftStart),
            shiftEnd: new Date(summaryData.shiftEnd),
            firstReceipt: summaryData.firstReceipt,
            lastReceipt: summaryData.lastReceipt,
            totalReceipts: summaryData.totalReceipts,
            grossSales: summaryData.grossSales.toString(),
            netSales: summaryData.netSales.toString(),
            paymentBreakdown: summaryData.paymentBreakdown,
            itemsSold: summaryData.itemsSold,
            modifiersSold: summaryData.modifiersSold,
            drinksSummary: summaryData.drinksSummary,
            rollsUsed: summaryData.rollsUsed,
            refunds: summaryData.refunds,
            updatedAt: new Date(),
          })
          .where(eq(dailyReceiptSummaries.date, summaryData.date));

        console.log(`💾 Updated existing summary for ${summaryData.date}`);
      } else {
        // Insert new summary
        await db.insert(dailyReceiptSummaries).values({
          date: summaryData.date,
          shiftStart: new Date(summaryData.shiftStart),
          shiftEnd: new Date(summaryData.shiftEnd),
          firstReceipt: summaryData.firstReceipt,
          lastReceipt: summaryData.lastReceipt,
          totalReceipts: summaryData.totalReceipts,
          grossSales: summaryData.grossSales.toString(),
          netSales: summaryData.netSales.toString(),
          paymentBreakdown: summaryData.paymentBreakdown,
          itemsSold: summaryData.itemsSold,
          modifiersSold: summaryData.modifiersSold,
          drinksSummary: summaryData.drinksSummary,
          rollsUsed: summaryData.rollsUsed,
          refunds: summaryData.refunds,
        });

        console.log(`💾 Stored new summary for ${summaryData.date}`);
      }
    } catch (error) {
      console.error(`❌ Failed to store summary for ${summaryData.date}:`, error);
      throw error;
    }
  }

  /**
   * Process all 31 days of receipt data and store summaries
   */
  async processLast31Days(): Promise<void> {
    console.log(`🧠 Jussi starting to process last 31 days of receipts...`);
    
    const today = dayjs().tz('Asia/Bangkok');
    const dates: string[] = [];
    
    // Generate list of dates for the last 31 days
    for (let i = 0; i < 31; i++) {
      const date = today.subtract(i, 'day').format('YYYY-MM-DD');
      dates.push(date);
    }

    console.log(`📅 Processing ${dates.length} dates: ${dates[dates.length - 1]} to ${dates[0]}`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const date of dates) {
      try {
        // Check if summary already exists and was processed recently
        const existing = await db
          .select()
          .from(dailyReceiptSummaries)
          .where(eq(dailyReceiptSummaries.date, date))
          .limit(1);

        const shouldSkip = existing.length > 0 && 
          existing[0].processedAt && 
          dayjs().diff(dayjs(existing[0].processedAt), 'hours') < 24;

        if (shouldSkip) {
          console.log(`⏭️  Skipping ${date} - already processed within 24 hours`);
          skippedCount++;
          continue;
        }

        // Process this date
        const summaryData = await this.processShiftReceipts(date);
        await this.storeSummary(summaryData);
        processedCount++;

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Failed to process date ${date}:`, error);
        // Continue with next date
      }
    }

    console.log(`✅ Jussi completed processing: ${processedCount} processed, ${skippedCount} skipped`);
  }

  /**
   * Process a specific date (for manual triggers)
   */
  async processSpecificDate(date: string): Promise<void> {
    console.log(`🧠 Jussi manually processing date: ${date}`);
    
    try {
      const summaryData = await this.processShiftReceipts(date);
      await this.storeSummary(summaryData);
      console.log(`✅ Jussi completed processing for ${date}`);
    } catch (error) {
      console.error(`❌ Jussi failed to process ${date}:`, error);
      throw error;
    }
  }

  /**
   * Get latest shift summary (for receipts page default view)
   */
  async getLatestShiftSummary(): Promise<any> {
    try {
      const latestSummary = await db
        .select()
        .from(dailyReceiptSummaries)
        .orderBy(dailyReceiptSummaries.date)
        .limit(1);

      if (latestSummary.length === 0) {
        return null;
      }

      return latestSummary[0];
    } catch (error) {
      console.error('❌ Failed to get latest shift summary:', error);
      return null;
    }
  }

  /**
   * Get summary for specific date
   */
  async getShiftSummaryByDate(date: string): Promise<any> {
    try {
      const summary = await db
        .select()
        .from(dailyReceiptSummaries)
        .where(eq(dailyReceiptSummaries.date, date))
        .limit(1);

      return summary.length > 0 ? summary[0] : null;
    } catch (error) {
      console.error(`❌ Failed to get summary for ${date}:`, error);
      return null;
    }
  }
}

export const jussiShiftSummarizer = new JussiShiftSummarizer();
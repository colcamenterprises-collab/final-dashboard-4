import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { db } from '../db';
import { loyverseReceipts } from '../../shared/schema';
import { and, gte, lte, desc } from 'drizzle-orm';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface LatestShiftSummary {
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  firstReceipt: string;
  lastReceipt: string;
  totalReceipts: number;
  grossSales: number;
  netSales: number;
  paymentBreakdown: Record<string, { count: number; amount: number }>;
  itemsSold: Record<string, { quantity: number; total: number }>;
  drinkQuantities: Record<string, number>;
  burgerRollsUsed: number;
  meatUsedKg: number; // Placeholder for future meat calculation
  modifiersSold: Record<string, { count: number; total: number }>;
  refunds: Array<{
    receiptNumber: string;
    amount: number;
    date: string;
  }>;
}

export class JussiLatestShiftService {
  /**
   * Get latest shift summary (most recent 5PM-3AM cycle)
   */
  static async getLatestShiftSummary(): Promise<LatestShiftSummary | null> {
    try {
      // Calculate current shift window in Bangkok timezone
      const now = dayjs.tz(dayjs(), 'Asia/Bangkok');
      let shiftDate: dayjs.Dayjs;

      // If it's after 3 AM but before 5 PM, show yesterday's shift
      if (now.hour() >= 3 && now.hour() < 17) {
        shiftDate = now.subtract(1, 'day');
      } else {
        shiftDate = now;
      }

      const shiftStart = shiftDate.hour(17).minute(0).second(0); // 5 PM
      const shiftEnd = shiftDate.add(1, 'day').hour(3).minute(0).second(0); // 3 AM next day

      console.log(`Getting latest shift data: ${shiftStart.format()} to ${shiftEnd.format()}`);

      // Get receipts for the latest shift period only
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
        console.log(`No receipts found for latest shift ${shiftDate.format('YYYY-MM-DD')}`);
        return null;
      }

      return this.processShiftReceipts(receipts, shiftStart, shiftEnd);

    } catch (error) {
      console.error('Error getting latest shift summary:', error);
      return null;
    }
  }

  /**
   * Get shift summary for specific date
   */
  static async getShiftSummaryForDate(dateStr: string): Promise<LatestShiftSummary | null> {
    try {
      const shiftDate = dayjs.tz(dateStr, 'Asia/Bangkok');
      const shiftStart = shiftDate.hour(17).minute(0).second(0); // 5 PM
      const shiftEnd = shiftDate.add(1, 'day').hour(3).minute(0).second(0); // 3 AM next day

      console.log(`Getting shift data for ${dateStr}: ${shiftStart.format()} to ${shiftEnd.format()}`);

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
        console.log(`No receipts found for shift ${dateStr}`);
        return null;
      }

      return this.processShiftReceipts(receipts, shiftStart, shiftEnd);

    } catch (error) {
      console.error('Error getting shift summary for date:', error);
      return null;
    }
  }

  /**
   * Process receipts to create shift summary
   */
  private static processShiftReceipts(receipts: any[], shiftStart: dayjs.Dayjs, shiftEnd: dayjs.Dayjs): LatestShiftSummary {
    const firstReceipt = receipts[0].receiptNumber;
    const lastReceipt = receipts[receipts.length - 1].receiptNumber;
    
    let grossSales = 0;
    let netSales = 0;
    const paymentBreakdown: Record<string, { count: number; amount: number }> = {};
    const itemsSold: Record<string, { quantity: number; total: number }> = {};
    const drinkQuantities: Record<string, number> = {};
    const modifiersSold: Record<string, { count: number; total: number }> = {};
    const refunds: any[] = [];
    let burgerRollsUsed = 0;
    let meatUsedKg = 0;

    // Define drink name mappings for accurate counting
    const drinkNames = [
      'Coke', 'Coca Cola', 'Coca-Cola',
      'Sprite', 
      'Fanta Orange', 'Fanta',
      'Schweppes Manow',
      'Fanta Strawberry',
      'Water', 'Bottled Water',
      'Soda Water',
      'Kids Juice Orange', 'Kids Orange',
      'Kids Juice Apple', 'Kids Apple'
    ];

    // Define burger keywords for roll calculation
    const burgerKeywords = ['burger', 'smash', 'classic', 'double', 'triple'];

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
      if (receipt.items && typeof receipt.items === 'string') {
        try {
          const items = JSON.parse(receipt.items);
          if (Array.isArray(items)) {
            for (const item of items) {
              const itemName = item.item_name || item.name || 'Unknown Item';
              const quantity = parseInt(item.quantity?.toString() || '1');
              const itemTotal = parseFloat(item.total_money?.toString() || item.price?.toString() || '0');

              // Track all items sold
              if (!itemsSold[itemName]) {
                itemsSold[itemName] = { quantity: 0, total: 0 };
              }
              itemsSold[itemName].quantity += quantity;
              itemsSold[itemName].total += itemTotal;

              // Count burger rolls (1 roll per burger)
              const itemLower = itemName.toLowerCase();
              if (burgerKeywords.some(keyword => itemLower.includes(keyword))) {
                burgerRollsUsed += quantity;
                // Calculate meat usage: 90g per patty
                meatUsedKg += (quantity * 0.09); // 90g = 0.09kg
              }

              // Count drinks with exact name matching
              for (const drinkName of drinkNames) {
                if (itemName.toLowerCase().includes(drinkName.toLowerCase())) {
                  drinkQuantities[drinkName] = (drinkQuantities[drinkName] || 0) + quantity;
                  break;
                }
              }

              // Process modifiers
              if (item.modifiers && Array.isArray(item.modifiers)) {
                for (const modifier of item.modifiers) {
                  const modifierName = modifier.modifier_name || modifier.name || 'Unknown Modifier';
                  const modQuantity = parseInt(modifier.quantity?.toString() || '1');
                  const modTotal = parseFloat(modifier.total_money?.toString() || modifier.price?.toString() || '0');

                  if (!modifiersSold[modifierName]) {
                    modifiersSold[modifierName] = { count: 0, total: 0 };
                  }
                  modifiersSold[modifierName].count += modQuantity;
                  modifiersSold[modifierName].total += modTotal;
                }
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing receipt items:', parseError);
        }
      }
    }

    return {
      shiftDate: shiftStart.format('YYYY-MM-DD'),
      shiftStart: shiftStart.toISOString(),
      shiftEnd: shiftEnd.toISOString(),
      firstReceipt,
      lastReceipt,
      totalReceipts: receipts.length,
      grossSales: Math.round(grossSales * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      paymentBreakdown,
      itemsSold,
      drinkQuantities,
      burgerRollsUsed,
      meatUsedKg: Math.round(meatUsedKg * 100) / 100, // Round to 2 decimal places
      modifiersSold,
      refunds
    };
  }

  /**
   * Generate CSV export data for current shift
   */
  static async generateCSVExport(): Promise<string> {
    const summary = await this.getLatestShiftSummary();
    if (!summary) {
      throw new Error('No shift data available for export');
    }

    const csvRows = [
      ['Shift Summary Export'],
      ['Date', summary.shiftDate],
      ['Shift Period', `${dayjs(summary.shiftStart).format('h:mm A')} - ${dayjs(summary.shiftEnd).format('h:mm A')}`],
      ['First Receipt', summary.firstReceipt],
      ['Last Receipt', summary.lastReceipt],
      ['Total Receipts', summary.totalReceipts.toString()],
      ['Gross Sales', `฿${summary.grossSales.toFixed(2)}`],
      ['Net Sales', `฿${summary.netSales.toFixed(2)}`],
      ['Burger Rolls Used', summary.burgerRollsUsed.toString()],
      ['Meat Used (kg)', summary.meatUsedKg.toFixed(2)],
      [''],
      ['Payment Methods'],
      ['Method', 'Count', 'Amount'],
      ...Object.entries(summary.paymentBreakdown).map(([method, data]) => [
        method, data.count.toString(), `฿${data.amount.toFixed(2)}`
      ]),
      [''],
      ['Drinks Sold'],
      ['Drink', 'Quantity'],
      ...Object.entries(summary.drinkQuantities).map(([drink, qty]) => [drink, qty.toString()]),
      [''],
      ['Top Items Sold'],
      ['Item', 'Quantity', 'Total'],
      ...Object.entries(summary.itemsSold)
        .sort(([,a], [,b]) => b.quantity - a.quantity)
        .slice(0, 20)
        .map(([item, data]) => [item, data.quantity.toString(), `฿${data.total.toFixed(2)}`])
    ];

    return csvRows.map(row => row.join(',')).join('\n');
  }

  /**
   * Get meat usage calculation for shift (placeholder for future enhancement)
   */
  static getMeatUsageForShift(date: string): Promise<number> {
    // Placeholder implementation - returns calculated meat from burger sales
    // Future enhancement: integrate with actual meat tracking system
    return Promise.resolve(0);
  }
}
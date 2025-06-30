import { db } from "../db";
import { loyverseReceipts, loyverseShiftReports } from "@shared/schema";
import { eq, desc, and, gte, lte, like, or } from "drizzle-orm";

interface LoyverseReceiptData {
  id: string;
  number: string;
  created_at: string;
  total_money: number;
  receipt_type: string;
  source: string;
  line_items: Array<{
    item_name: string;
    quantity: number;
    price: number;
    total_money: number;
  }>;
  payments: Array<{
    type: string;
    amount: number;
  }>;
  employee?: {
    name: string;
  };
  customer?: {
    name: string;
    email: string;
  };
}

interface LoyverseShiftData {
  id: string;
  start_time: string;
  end_time: string;
  total_sales: number;
  total_transactions: number;
  cash_sales: number;
  card_sales: number;
  employee_name: string;
  top_items: Array<{
    name: string;
    quantity: number;
    sales: number;
  }>;
}

export class LoyverseReceiptService {
  private config = {
    accessToken: process.env.LOYVERSE_ACCESS_TOKEN || '42137934ef75406bb54427c6815e5e79',
    baseUrl: 'https://api.loyverse.com/v1.0'
  };

  // Calculate shift date based on 6pm-3am cycle
  private getShiftDate(timestamp: Date): Date {
    const shiftStart = new Date(timestamp);
    // If time is before 6am, this receipt belongs to previous day's shift
    if (timestamp.getHours() < 6) {
      shiftStart.setDate(shiftStart.getDate() - 1);
    }
    shiftStart.setHours(18, 0, 0, 0); // Set to 6pm of shift date
    return shiftStart;
  }

  async fetchAndStoreReceipts(): Promise<{ success: boolean; receiptsProcessed: number }> {
    try {
      console.log('Fetching receipts from Loyverse API...');
      
      const response = await fetch(`${this.config.baseUrl}/receipts?limit=100`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Loyverse API error: ${response.status}`);
      }

      const data = await response.json();
      const receipts = data.receipts || [];
      
      let processed = 0;
      for (const receipt of receipts) {
        try {
          await this.storeReceipt(receipt);
          processed++;
        } catch (error) {
          console.error(`Failed to store receipt ${receipt.id}:`, error);
        }
      }

      console.log(`Processed ${processed} receipts`);
      return { success: true, receiptsProcessed: processed };
    } catch (error) {
      console.error('Failed to fetch receipts:', error);
      throw error;
    }
  }

  private async storeReceipt(receiptData: LoyverseReceiptData): Promise<void> {
    const receiptDate = new Date(receiptData.created_at);
    const shiftDate = this.getShiftDate(receiptDate);
    
    const totalAmount = receiptData.total_money / 100; // Convert from cents
    const paymentMethod = receiptData.payments?.[0]?.type || 'unknown';
    
    // Check if receipt already exists
    const existing = await db.select().from(loyverseReceipts)
      .where(eq(loyverseReceipts.receiptId, receiptData.id))
      .limit(1);
    
    if (existing.length > 0) {
      return; // Skip if already exists
    }

    await db.insert(loyverseReceipts).values({
      receiptId: receiptData.id,
      receiptNumber: receiptData.number,
      receiptDate: receiptDate,
      totalAmount: totalAmount.toString(),
      paymentMethod: paymentMethod,
      customerInfo: receiptData.customer || null,
      items: receiptData.line_items,
      taxAmount: "0", // Calculate if tax info available
      discountAmount: "0", // Calculate if discount info available
      staffMember: receiptData.employee?.name || null,
      tableNumber: null, // Extract if available in receipt data
      shiftDate: shiftDate,
      rawData: receiptData
    });
  }

  async fetchAndStoreShiftReports(): Promise<{ success: boolean; reportsProcessed: number }> {
    try {
      console.log('Fetching shift reports from Loyverse API...');
      
      // Fetch POS sessions (shift reports) from Loyverse API
      const response = await fetch(`${this.config.baseUrl}/pos_sessions?limit=5&order=created_at`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log(`Loyverse API response: ${response.status} - ${response.statusText}`);
        // Fallback to generating reports from existing receipt data
        return await this.generateShiftReportsFromExistingData();
      }

      const data = await response.json();
      const sessions = data.pos_sessions || [];
      
      let processed = 0;
      for (const session of sessions.slice(0, 5)) { // Latest 5 shift reports
        try {
          const shiftReport: LoyverseShiftData = {
            id: session.id,
            start_time: session.opened_at,
            end_time: session.closed_at || new Date().toISOString(),
            total_sales: (session.total_money || 0) / 100, // Convert from cents
            total_transactions: session.receipts_count || 0,
            cash_sales: (session.cash_payments || 0) / 100,
            card_sales: ((session.total_money || 0) - (session.cash_payments || 0)) / 100,
            employee_name: session.employee?.name || 'Staff Member',
            top_items: []
          };
          
          await this.storeShiftReport(shiftReport);
          processed++;
        } catch (error) {
          console.error(`Failed to store shift report ${session.id}:`, error);
        }
      }

      console.log(`Processed ${processed} shift reports from Loyverse API`);
      return { success: true, reportsProcessed: processed };
    } catch (error) {
      console.error('Failed to fetch shift reports from Loyverse:', error);
      // Fallback to generating reports from existing data
      return await this.generateShiftReportsFromExistingData();
    }
  }

  private async generateShiftReportsFromExistingData(): Promise<{ success: boolean; reportsProcessed: number }> {
    try {
      console.log('Generating shift reports from existing receipt data...');
      const reports = await this.generateShiftReportsFromReceipts();
      
      let processed = 0;
      for (const report of reports.slice(0, 5)) { // Latest 5 reports
        try {
          await this.storeShiftReport(report);
          processed++;
        } catch (error) {
          console.error(`Failed to store generated shift report:`, error);
        }
      }

      return { success: true, reportsProcessed: processed };
    } catch (error) {
      console.error('Failed to generate shift reports:', error);
      throw error;
    }
  }

  private async generateShiftReportsFromReceipts(): Promise<LoyverseShiftData[]> {
    // Get recent receipts grouped by shift
    const receipts = await db.select().from(loyverseReceipts)
      .orderBy(desc(loyverseReceipts.receiptDate))
      .limit(1000);

    const shiftGroups = new Map<string, any[]>();
    
    receipts.forEach(receipt => {
      const shiftKey = receipt.shiftDate.toISOString().split('T')[0];
      if (!shiftGroups.has(shiftKey)) {
        shiftGroups.set(shiftKey, []);
      }
      shiftGroups.get(shiftKey)?.push(receipt);
    });

    const reports: LoyverseShiftData[] = [];
    
    for (const [shiftKey, shiftReceipts] of shiftGroups) {
      const shiftDate = new Date(shiftKey);
      const totalSales = shiftReceipts.reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);
      const cashSales = shiftReceipts
        .filter(r => r.paymentMethod?.toLowerCase().includes('cash'))
        .reduce((sum, r) => sum + parseFloat(r.totalAmount), 0);
      const cardSales = totalSales - cashSales;

      reports.push({
        id: `shift-${shiftKey}`,
        start_time: new Date(shiftDate.setHours(18, 0, 0, 0)).toISOString(),
        end_time: new Date(shiftDate.setHours(27, 0, 0, 0)).toISOString(), // 3am next day
        total_sales: totalSales,
        total_transactions: shiftReceipts.length,
        cash_sales: cashSales,
        card_sales: cardSales,
        employee_name: shiftReceipts[0]?.staffMember || 'Unknown',
        top_items: []
      });
    }

    return reports.slice(0, 10); // Last 10 shift reports
  }

  private async storeShiftReport(reportData: LoyverseShiftData): Promise<void> {
    const shiftStart = new Date(reportData.start_time);
    const shiftEnd = new Date(reportData.end_time);
    const shiftDate = new Date(shiftStart);
    shiftDate.setHours(18, 0, 0, 0); // Normalize to 6pm

    // Check if report already exists
    const existing = await db.select().from(loyverseShiftReports)
      .where(eq(loyverseShiftReports.reportId, reportData.id))
      .limit(1);
    
    if (existing.length > 0) {
      return; // Skip if already exists
    }

    await db.insert(loyverseShiftReports).values({
      reportId: reportData.id,
      shiftDate: shiftDate,
      shiftStart: shiftStart,
      shiftEnd: shiftEnd,
      totalSales: reportData.total_sales.toString(),
      totalTransactions: reportData.total_transactions,
      totalCustomers: reportData.total_transactions, // Estimate
      cashSales: reportData.cash_sales.toString(),
      cardSales: reportData.card_sales.toString(),
      discounts: "0",
      taxes: "0",
      staffMembers: [reportData.employee_name],
      topItems: reportData.top_items,
      reportData: reportData,
      completedBy: reportData.employee_name,
      completedAt: shiftEnd
    });
  }

  async getReceiptsByDateRange(startDate: Date, endDate: Date) {
    return await db.select().from(loyverseReceipts)
      .where(and(
        gte(loyverseReceipts.receiptDate, startDate),
        lte(loyverseReceipts.receiptDate, endDate)
      ))
      .orderBy(desc(loyverseReceipts.receiptDate));
  }

  async searchReceipts(query: string) {
    return await db.select().from(loyverseReceipts)
      .where(or(
        like(loyverseReceipts.receiptNumber, `%${query}%`),
        like(loyverseReceipts.receiptId, `%${query}%`)
      ))
      .orderBy(desc(loyverseReceipts.receiptDate))
      .limit(50);
  }

  async getShiftReportsByDateRange(startDate: Date, endDate: Date) {
    return await db.select().from(loyverseShiftReports)
      .where(and(
        gte(loyverseShiftReports.shiftDate, startDate),
        lte(loyverseShiftReports.shiftDate, endDate)
      ))
      .orderBy(desc(loyverseShiftReports.shiftDate));
  }

  async getLatestShiftReports(limit: number = 10) {
    return await db.select().from(loyverseShiftReports)
      .orderBy(desc(loyverseShiftReports.shiftDate))
      .limit(limit);
  }
}

export const loyverseReceiptService = new LoyverseReceiptService();
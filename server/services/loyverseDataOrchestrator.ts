import { DateTime } from 'luxon';
import cron from 'node-cron';
import winston from 'winston';
import { EnhancedLoyverseAPI } from './enhancedLoyverseAPI';
import { AIAnalysisService } from './aiAnalysisService';
import { LoyverseDataValidator } from './loyverseDataValidator';
import { db } from '../db';
import { loyverseReceipts, loyverseShiftReports, aiInsights, dailyStockSales } from '../../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/loyverse-orchestrator.log' })
  ]
});

interface ProcessingResult {
  success: boolean;
  receiptsProcessed: number;
  shiftsProcessed: number;
  analysisGenerated: boolean;
  errors: string[];
  processingTime: number;
  metadata: {
    validationStats: any;
    shiftDate: string;
    totalSales: number;
    totalOrders: number;
  };
}

// Main orchestrator class for Loyverse data processing
export class LoyverseDataOrchestrator {
  private static instance: LoyverseDataOrchestrator;
  private loyverseAPI: EnhancedLoyverseAPI;
  private aiAnalysisService: AIAnalysisService;
  private validator: LoyverseDataValidator;
  private isProcessing = false;
  private lastProcessingTime: Date | null = null;
  private cronJob: cron.ScheduledTask | null = null;

  private constructor() {
    const accessToken = process.env.LOYVERSE_ACCESS_TOKEN || 'c1ba07b4dc304101b8dbff63107a3d87';
    this.loyverseAPI = new EnhancedLoyverseAPI(accessToken);
    this.aiAnalysisService = AIAnalysisService.getInstance();
    this.validator = LoyverseDataValidator.getInstance();
  }

  static getInstance(): LoyverseDataOrchestrator {
    if (!LoyverseDataOrchestrator.instance) {
      LoyverseDataOrchestrator.instance = new LoyverseDataOrchestrator();
    }
    return LoyverseDataOrchestrator.instance;
  }

  // New Webhook Process Method
  static async processReceipt(receipt: any) {
    const instance = this.getInstance();
    const shiftDate = new Date(receipt.receipt_date); // Calculate BKK shift
    await instance.storeReceiptInDatabase(receipt, shiftDate);
    
    // Trigger partial analysis if threshold, else queue
    const receipts = await db.select().from(loyverseReceipts).where(eq(loyverseReceipts.shiftDate, shiftDate));
    if (receipts.length % 10 === 0) {
      await instance.processShiftData(shiftDate);
    }
  }

  // Process complete shift data (receipts + analysis)
  async processShiftData(shiftDate: Date): Promise<ProcessingResult> {
    if (this.isProcessing) {
      throw new Error('Processing already in progress');
    }

    this.isProcessing = true;
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      logger.info(`Starting shift data processing for ${shiftDate.toISOString()}`);

      // Step 1: Fetch and validate receipts
      const receiptResult = await this.loyverseAPI.fetchAllReceiptsForShift(shiftDate);
      logger.info(`Fetched ${receiptResult.receipts.length} valid receipts`);

      // Step 2: Store receipts in database
      let receiptsStored = 0;
      for (const receipt of receiptResult.receipts) {
        try {
          await this.storeReceiptInDatabase(receipt, shiftDate);
          receiptsStored++;
        } catch (error) {
          errors.push(`Failed to store receipt ${receipt.receipt_number}: ${error}`);
        }
      }

      // Step 3: Generate shift report
      const shiftReport = await this.generateShiftReport(receiptResult.receipts, shiftDate);
      let shiftsProcessed = 0;
      
      if (shiftReport) {
        try {
          await this.storeShiftReportInDatabase(shiftReport, shiftDate);
          shiftsProcessed = 1;
        } catch (error) {
          errors.push(`Failed to store shift report: ${error}`);
        }
      }

      // Step 4: Run AI analysis
      let analysisGenerated = false;
      try {
        const analysis = await this.aiAnalysisService.analyzeShiftReceipts(receiptResult.receipts, shiftDate);
        analysisGenerated = true;
        logger.info(`AI analysis completed with ${analysis.anomalies.length} anomalies detected`);
      } catch (error) {
        errors.push(`AI analysis failed: ${error}`);
      }

      // Step 5: Staff form comparison
      const staffForm = await db.select().from(dailyStockSales).where(eq(dailyStockSales.shiftDate, shiftDate));
      if (staffForm.length) {
        const posTotal = receiptResult.receipts.reduce((sum, r) => sum + r.total_money, 0);
        if (Math.abs(posTotal - parseFloat(staffForm[0].totalSales || '0')) > 50) {
          errors.push(`Staff vs POS mismatch: ${posTotal} vs ${staffForm[0].totalSales}`);
        }
      }

      // Step 5: Validate data consistency
      const consistencyCheck = this.validator.validateDataConsistency(receiptResult.receipts, shiftReport ? [shiftReport] : []);
      if (!consistencyCheck.isConsistent) {
        errors.push(...consistencyCheck.issues);
      }

      const processingTime = Date.now() - startTime;
      this.lastProcessingTime = new Date();

      const result: ProcessingResult = {
        success: errors.length === 0,
        receiptsProcessed: receiptsStored,
        shiftsProcessed,
        analysisGenerated,
        errors,
        processingTime,
        metadata: {
          validationStats: this.validator.getValidationStats(),
          shiftDate: shiftDate.toISOString(),
          totalSales: receiptResult.receipts.reduce((sum, r) => sum + r.total_money, 0),
          totalOrders: receiptResult.receipts.length
        }
      };

      logger.info(`Shift processing completed in ${processingTime}ms with ${errors.length} errors`);
      return result;

    } catch (error) {
      errors.push(`Processing failed: ${error}`);
      return {
        success: false,
        receiptsProcessed: 0,
        shiftsProcessed: 0,
        analysisGenerated: false,
        errors,
        processingTime: Date.now() - startTime,
        metadata: {
          validationStats: this.validator.getValidationStats(),
          shiftDate: shiftDate.toISOString(),
          totalSales: 0,
          totalOrders: 0
        }
      };
    } finally {
      this.isProcessing = false;
    }
  }

  // Store receipt in database with enhanced error handling
  private async storeReceiptInDatabase(receipt: any, shiftDate: Date): Promise<void> {
    await db.transaction(async (tx) => {
      const existingReceipt = await tx.select().from(loyverseReceipts).where(eq(loyverseReceipts.receiptId, receipt.id)).limit(1);
      if (existingReceipt.length) return;
      
      const receiptDate = new Date(receipt.receipt_date);
      
      // Calculate shift date for Bangkok timezone (5pm-3am cycle)
      const bangkokTime = new Date(receiptDate.getTime() + (7 * 60 * 60 * 1000));
      const calculatedShiftDate = new Date(bangkokTime);
      
      if (bangkokTime.getHours() < 17) {
        calculatedShiftDate.setDate(calculatedShiftDate.getDate() - 1);
      }
      calculatedShiftDate.setHours(17, 0, 0, 0);
      
      // Convert back to UTC
      const utcShiftDate = new Date(calculatedShiftDate.getTime() - (7 * 60 * 60 * 1000));

      // Prepare receipt data
      const receiptData = {
        receiptId: receipt.id,
        receiptNumber: receipt.receipt_number,
        receiptDate: receiptDate,
        totalAmount: receipt.total_money.toString(),
        paymentMethod: receipt.payments[0]?.payment_type_id || 'Unknown',
        customerInfo: receipt.customer_id ? { id: receipt.customer_id } : null,
        items: receipt.line_items,
        taxAmount: (receipt.total_tax || 0).toString(),
        discountAmount: (receipt.total_discount || 0).toString(),
        staffMember: receipt.employee_id || null,
        tableNumber: null,
        shiftDate: utcShiftDate,
        rawData: receipt,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await tx.insert(loyverseReceipts).values(receiptData);
    });
  }

  // Generate shift report from receipts
  private async generateShiftReport(receipts: any[], shiftDate: Date): Promise<any> {
    if (receipts.length === 0) {
      return null;
    }

    const bangkokShiftStart = DateTime.fromJSDate(shiftDate).setZone('Asia/Bangkok').set({ hour: 17, minute: 0, second: 0 });
    const bangkokShiftEnd = bangkokShiftStart.plus({ hours: 10 });

    const totalSales = receipts.reduce((sum, r) => sum + r.total_money, 0);
    const totalTransactions = receipts.length;

    // Calculate payment type breakdown
    const paymentTypeBreakdown: Record<string, number> = {};
    let cashSales = 0;
    let cardSales = 0;

    for (const receipt of receipts) {
      for (const payment of receipt.payments) {
        paymentTypeBreakdown[payment.payment_type_id] = 
          (paymentTypeBreakdown[payment.payment_type_id] || 0) + payment.amount;
        
        if (payment.payment_type_id.toLowerCase().includes('cash')) {
          cashSales += payment.amount;
        } else {
          cardSales += payment.amount;
        }
      }
    }

    // Calculate top items
    const itemMap = new Map<string, { quantity: number; sales: number }>();
    for (const receipt of receipts) {
      for (const item of receipt.line_items) {
        const existing = itemMap.get(item.item_name) || { quantity: 0, sales: 0 };
        existing.quantity += item.quantity;
        existing.sales += item.line_total;
        itemMap.set(item.item_name, existing);
      }
    }

    const topItems = Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    return {
      reportId: `shift-${shiftDate.toISOString().split('T')[0]}`,
      shiftDate: shiftDate,
      shiftStart: bangkokShiftStart.toJSDate(),
      shiftEnd: bangkokShiftEnd.toJSDate(),
      totalSales,
      totalTransactions,
      totalCustomers: new Set(receipts.map(r => r.customer_id).filter(Boolean)).size,
      cashSales,
      cardSales,
      discounts: receipts.reduce((sum, r) => sum + (r.total_discount || 0), 0),
      taxes: receipts.reduce((sum, r) => sum + (r.total_tax || 0), 0),
      staffMembers: Array.from(new Set(receipts.map(r => r.employee_id).filter(Boolean))),
      topItems,
      reportData: {
        paymentTypeBreakdown,
        hourlyBreakdown: this.calculateHourlyBreakdown(receipts),
        averageOrderValue: totalTransactions > 0 ? totalSales / totalTransactions : 0,
        receipts: receipts.map(r => ({
          id: r.id,
          number: r.receipt_number,
          date: r.receipt_date,
          total: r.total_money,
          items: r.line_items.length
        }))
      }
    };
  }

  // Store shift report in database
  private async storeShiftReportInDatabase(shiftReport: any, shiftDate: Date): Promise<void> {
    // Check if shift report already exists
    const existingReport = await db.select()
      .from(loyverseShiftReports)
      .where(eq(loyverseShiftReports.reportId, shiftReport.reportId))
      .limit(1);

    if (existingReport.length > 0) {
      return; // Skip if already exists
    }

    await db.insert(loyverseShiftReports).values({
      reportId: shiftReport.reportId,
      shiftDate: shiftReport.shiftDate,
      shiftStart: shiftReport.shiftStart,
      shiftEnd: shiftReport.shiftEnd,
      totalSales: shiftReport.totalSales.toString(),
      totalTransactions: shiftReport.totalTransactions,
      totalCustomers: shiftReport.totalCustomers,
      cashSales: shiftReport.cashSales.toString(),
      cardSales: shiftReport.cardSales.toString(),
      discounts: shiftReport.discounts.toString(),
      taxes: shiftReport.taxes.toString(),
      staffMembers: shiftReport.staffMembers,
      topItems: shiftReport.topItems,
      reportData: shiftReport.reportData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Calculate hourly breakdown
  private calculateHourlyBreakdown(receipts: any[]): Record<string, number> {
    const hourlyBreakdown: Record<string, number> = {};
    
    for (const receipt of receipts) {
      const receiptDate = new Date(receipt.receipt_date);
      const bangkokTime = new Date(receiptDate.getTime() + (7 * 60 * 60 * 1000));
      const hour = bangkokTime.getHours();
      
      hourlyBreakdown[hour.toString()] = (hourlyBreakdown[hour.toString()] || 0) + receipt.total_money;
    }
    
    return hourlyBreakdown;
  }

  // Process current shift (manual trigger)
  async processCurrentShift(): Promise<ProcessingResult> {
    const now = new Date();
    const bangkokTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    
    // Determine current shift date
    let shiftDate: Date;
    if (bangkokTime.getHours() >= 17) {
      // Current shift: 5pm today to 3am tomorrow
      shiftDate = new Date(bangkokTime);
      shiftDate.setHours(17, 0, 0, 0);
    } else if (bangkokTime.getHours() < 3) {
      // Ongoing shift from yesterday
      shiftDate = new Date(bangkokTime);
      shiftDate.setDate(shiftDate.getDate() - 1);
      shiftDate.setHours(17, 0, 0, 0);
    } else {
      // No active shift, process yesterday's completed shift
      shiftDate = new Date(bangkokTime);
      shiftDate.setDate(shiftDate.getDate() - 1);
      shiftDate.setHours(17, 0, 0, 0);
    }

    // Convert to UTC
    const utcShiftDate = new Date(shiftDate.getTime() - (7 * 60 * 60 * 1000));
    
    return this.processShiftData(utcShiftDate);
  }

  // Set up automated scheduling
  setupAutomatedScheduling(): void {
    // Stop existing cron job if running
    if (this.cronJob) {
      this.cronJob.stop();
    }

    // Schedule for 3:05 AM Bangkok time daily (20:05 UTC)
    this.cronJob = cron.schedule('5 20 * * *', async () => {
      try {
        logger.info('Starting automated shift processing');
        
        // Process yesterday's completed shift
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(17, 0, 0, 0); // 5pm Bangkok time
        
        const result = await this.processShiftData(yesterday);
        
        if (result.success) {
          logger.info(`Automated processing completed successfully: ${result.receiptsProcessed} receipts, ${result.shiftsProcessed} shifts`);
        } else {
          logger.error(`Automated processing completed with errors: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        logger.error('Automated processing failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('Automated shift processing scheduled for 3:05 AM Bangkok time daily');
  }

  // Stop automated scheduling
  stopAutomatedScheduling(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Automated shift processing stopped');
    }
  }

  // Get processing status
  getProcessingStatus(): {
    isProcessing: boolean;
    lastProcessingTime: string | null;
    isScheduled: boolean;
    nextScheduledRun: string | null;
    validationStats: any;
  } {
    return {
      isProcessing: this.isProcessing,
      lastProcessingTime: this.lastProcessingTime?.toISOString() || null,
      isScheduled: this.cronJob !== null,
      nextScheduledRun: this.cronJob ? this.cronJob.getStatus() : null,
      validationStats: this.validator.getValidationStats()
    };
  }

  // Test connection and validate setup
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    diagnostics: any;
  }> {
    return this.loyverseAPI.testConnection();
  }

  // Manual sync for immediate data refresh
  async performManualSync(): Promise<{
    success: boolean;
    message: string;
    result?: ProcessingResult;
  }> {
    try {
      const result = await this.processCurrentShift();
      return {
        success: result.success,
        message: result.success 
          ? `Manual sync completed: ${result.receiptsProcessed} receipts processed`
          : `Manual sync completed with ${result.errors.length} errors`,
        result
      };
    } catch (error) {
      return {
        success: false,
        message: `Manual sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get recent processing history
  async getProcessingHistory(limit: number = 10): Promise<any[]> {
    try {
      const history = await db.select()
        .from(aiInsights)
        .where(eq(aiInsights.type, 'shift_analysis'))
        .orderBy(desc(aiInsights.createdAt))
        .limit(limit);

      return history.map(h => ({
        id: h.id,
        shiftDate: h.relevantDate,
        createdAt: h.createdAt,
        title: h.title,
        summary: h.content ? {
          totalSales: (h.content as any).totalSales,
          totalOrders: (h.content as any).totalOrders,
          anomaliesCount: (h.content as any).anomalies?.length || 0
        } : null
      }));
    } catch (error) {
      logger.error('Failed to get processing history:', error);
      return [];
    }
  }
}

export default LoyverseDataOrchestrator;
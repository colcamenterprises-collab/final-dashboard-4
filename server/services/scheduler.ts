import { loyverseAPI } from "../loyverseAPI";
import { buildShiftSummary } from "./receiptSummary";
import { PrismaClient } from '@prisma/client';

export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];
  private prisma = new PrismaClient();

  start() {
    // Initialize restaurant data first
    this.initializeRestaurant();

    // Schedule daily receipt sync at 3am Bangkok time (end of 5pm-3am shift)
    this.scheduleDailyTask(() => {
      this.syncReceiptsAndReports();
    }, 3, 0); // 3:00 AM Bangkok time

    // Schedule daily summary job at 3:05 AM Bangkok time  
    this.scheduleDailyTask(() => {
      this.buildDailySummary();
    }, 3, 5); // 3:05 AM Bangkok time

    // === NEW SERVICES ===

    // Schedule incremental POS sync every 15 minutes
    this.scheduleIncrementalSync();

    // Schedule analytics processing at 3:30 AM Bangkok time
    this.scheduleDailyTask(() => {
      this.processAnalytics();
    }, 3, 30); // 3:30 AM Bangkok time

    // Schedule Jussi email summary at 8:00 AM Bangkok time
    this.scheduleDailyTask(() => {
      this.generateJussiSummary();
    }, 8, 0); // 8:00 AM Bangkok time

    // Schedule daily sales summary at 9:00 AM Bangkok time
    this.scheduleDailyTask(() => {
      this.sendDailySalesSummary();
    }, 9, 0); // 9:00 AM Bangkok time

    // Schedule finance calculations at 3:35 AM Bangkok time
    this.scheduleDailyTask(() => {
      this.runFinanceCalculations();
    }, 3, 35); // 3:35 AM Bangkok time

    // Schedule burger metrics cache at 3:10 AM Bangkok time
    this.scheduleDailyTask(() => {
      this.cacheBurgerMetrics();
    }, 3, 10); // 3:10 AM Bangkok time

    // Schedule Daily Review POS data ingestion at 3:15 AM Bangkok time
    this.scheduleDailyTask(() => {
      this.ingestDailyPOSData();
    }, 3, 15); // 3:15 AM Bangkok time

    // Schedule Shift Analytics MM cache rebuild at 3:20 AM Bangkok time
    this.scheduleDailyTask(() => {
      this.rebuildShiftAnalytics();
    }, 3, 20); // 3:20 AM Bangkok time

    console.log('Scheduler service started - daily sync at 3am Bangkok time for 5pm-3am shifts');
    console.log('📧 Email cron scheduled for 8am Bangkok time (1am UTC)');
    console.log('📧 Daily sales summary scheduled for 9am Bangkok time (2am UTC)');
    console.log('🍔 Burger metrics cache scheduled for 3:10am Bangkok time');
    console.log('📊 Daily Review POS ingestion scheduled for 3:15am Bangkok time');
    console.log('📊 Shift Analytics MM cache rebuild scheduled for 3:20am Bangkok time');
  }

  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('Scheduler service stopped');
  }

  private scheduleDailyTask(task: () => void, hour: number, minute: number) {
    const scheduleNext = () => {
      const now = new Date();
      
      // Get current time in Bangkok timezone using UTC offset method
      const bangkokNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      
      // Create next scheduled time in Bangkok timezone
      const bangkokScheduledTime = new Date(bangkokNow);
      bangkokScheduledTime.setUTCHours(hour, minute, 0, 0);

      // If the scheduled time has passed today in Bangkok, schedule for tomorrow
      if (bangkokScheduledTime <= bangkokNow) {
        bangkokScheduledTime.setUTCDate(bangkokScheduledTime.getUTCDate() + 1);
      }

      // Convert back to UTC for setTimeout
      const utcScheduledTime = new Date(bangkokScheduledTime.getTime() - (7 * 60 * 60 * 1000));
      const timeUntilNext = utcScheduledTime.getTime() - now.getTime();

      const timeout = setTimeout(() => {
        console.log(`🕐 Executing daily sync at ${new Date().toLocaleString('en-US', { 
          timeZone: 'Asia/Bangkok',
          dateStyle: 'full',
          timeStyle: 'medium'
        })} Bangkok time`);
        task();
        // Schedule the next occurrence
        scheduleNext();
      }, timeUntilNext);

      // Display the actual Bangkok time correctly (bangkokScheduledTime is already in Bangkok timezone)
      console.log(`Next receipt sync scheduled for: ${bangkokScheduledTime.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      })} at ${bangkokScheduledTime.getUTCHours().toString().padStart(2, '0')}:${bangkokScheduledTime.getUTCMinutes().toString().padStart(2, '0')} Bangkok time`);
      return timeout;
    };

    scheduleNext();
  }

  private async syncReceiptsAndReports() {
    try {
      console.log('🔄 Starting daily receipt and shift report sync...');
      
      // 1. First sync all new shifts to prevent missing shift data
      await this.syncNewShifts();
      
      // 2. Sync receipts from Loyverse using Bangkok timezone-aware API
      const receiptCount = await loyverseAPI.syncTodaysReceipts();
      console.log(`✅ Synced ${receiptCount} receipts from completed shift`);
      
      // 3. Process shift analytics for the completed shift
      if (receiptCount > 0) {
        console.log('🔄 Processing shift analytics for previous shift...');
        const { processPreviousShift } = await import('./shiftAnalytics');
        const analyticsResult = await processPreviousShift();
        console.log(`📊 Shift analytics: ${analyticsResult.message}`);
      }

      // 3. Sync additional data (items, customers, etc.)
      const itemCount = await loyverseAPI.syncAllItems();
      console.log(`✅ Synced ${itemCount} menu items`);

      const customerCount = await loyverseAPI.syncCustomers();
      console.log(`✅ Synced ${customerCount} customers`);

      console.log('🎉 Daily sync completed successfully');
    } catch (error) {
      console.error('❌ Daily sync failed:', error);
    }
  }

  private async syncNewShifts() {
    try {
      console.log('🔄 Syncing new shifts to prevent missing data...');
      
      // Get shifts from the last 3 days to catch any new or missed shifts
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (3 * 24 * 60 * 60 * 1000));
      
      const shiftsResponse = await loyverseAPI.getShifts({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        limit: 50
      });
      
      console.log(`📊 Found ${shiftsResponse.shifts.length} shifts from Loyverse API`);
      
      // Import database modules
      const { db } = await import('../db');
      const { loyverseShiftReports } = await import('../../shared/schema');
      
      let newShiftsImported = 0;
      
      for (const shift of shiftsResponse.shifts) {
        // Check if this shift is already in our database
        const existingShift = await db.select()
          .from(loyverseShiftReports)
          .where(`report_id = 'shift-${shift.id}-authentic'`)
          .limit(1);
        
        if (existingShift.length === 0) {
          // This is a new shift - import it
          const openingTime = new Date(shift.opening_time);
          const closingTime = shift.closing_time ? new Date(shift.closing_time) : null;
          const bangkokOpen = new Date(openingTime.getTime() + (7 * 60 * 60 * 1000));
          
          console.log(`🆕 Importing new shift ${shift.id}: ${bangkokOpen.toLocaleString()} to ${closingTime ? new Date(closingTime.getTime() + (7 * 60 * 60 * 1000)).toLocaleString() : 'Open'}`);
          
          // Create shift report data
          const shiftData = {
            report_id: `shift-${shift.id}-authentic`,
            shift_date: new Date(bangkokOpen.getFullYear(), bangkokOpen.getMonth(), bangkokOpen.getDate()),
            shift_start: openingTime,
            shift_end: closingTime,
            total_sales: shift.expected_amount - shift.opening_amount,
            total_transactions: 0,
            cash_sales: 0,
            card_sales: 0,
            report_data: JSON.stringify({
              shift_number: shift.id.toString(),
              opening_time: shift.opening_time,
              closing_time: shift.closing_time,
              opening_amount: shift.opening_amount,
              expected_amount: shift.expected_amount,
              actual_amount: shift.actual_amount,
              starting_cash: shift.opening_amount,
              expected_cash: shift.expected_amount,
              actual_cash: shift.actual_amount || shift.expected_amount,
              cash_difference: (shift.actual_amount || shift.expected_amount) - shift.expected_amount
            }),
            created_at: new Date(),
            updated_at: new Date()
          };
          
          // Insert into database
          await db.insert(loyverseShiftReports).values(shiftData);
          newShiftsImported++;
        }
      }
      
      if (newShiftsImported > 0) {
        console.log(`✅ Imported ${newShiftsImported} new shifts during daily sync`);
      } else {
        console.log('✅ No new shifts to import - all shifts are up to date');
      }
      
    } catch (error) {
      console.error('❌ Failed to sync new shifts:', error);
    }
  }

  private async buildDailySummary() {
    try {
      console.log('📊 Building daily shift summary...');
      
      // Get yesterday's date for the summary (shift that just ended)
      const bangkokNow = new Date(new Date().getTime() + 7 * 3600_000);
      const dateStr = bangkokNow.toISOString().slice(0, 10); // yyyy-mm-dd
      
      console.log('📊 Building shift summary for', dateStr);
      const summary = await buildShiftSummary(dateStr);
      
      console.log(`✅ Shift summary built: ${summary.burgersSold} burgers, ${summary.drinksSold} drinks`);
    } catch (error) {
      console.error('❌ Failed to build daily summary:', error);
    }
  }

  // === NEW SERVICE METHODS ===

  /**
   * Initialize restaurant and POS connection
   */
  private async initializeRestaurant() {
    try {
      // Ensure Smash Brothers Burgers restaurant exists
      let restaurant = await this.prisma.restaurant.findFirst({
        where: { slug: 'smash-brothers-burgers' }
      });

      if (!restaurant) {
        restaurant = await this.prisma.restaurant.create({
          data: {
            name: 'Smash Brothers Burgers',
            slug: 'smash-brothers-burgers',
            email: 'smashbrothersburgersth@gmail.com',
            timezone: 'Asia/Bangkok',
            locale: 'en-TH'
          }
        });
        console.log('✅ Restaurant created:', restaurant.name);
      }

      // Ensure POS connection exists
      let posConnection = await this.prisma.posConnection.findFirst({
        where: {
          restaurantId: restaurant.id,
          provider: 'LOYVERSE',
          isActive: true
        }
      });

      if (!posConnection) {
        posConnection = await this.prisma.posConnection.create({
          data: {
            restaurantId: restaurant.id,
            provider: 'LOYVERSE',
            apiKey: process.env.LOYVERSE_API_TOKEN?.substring(0, 8) + '...',
            isActive: true
          }
        });
        console.log('✅ POS connection created for Loyverse');
      }
    } catch (error) {
      console.error('❌ Restaurant initialization failed:', error);
    }
  }

  /**
   * Schedule incremental POS sync every 15 minutes
   */
  private scheduleIncrementalSync() {
    const interval = setInterval(async () => {
      try {
        console.log('🔄 Starting scheduled incremental POS sync...');
        
        const { syncReceiptsWindow } = await import('./pos-ingestion/ingester.js');
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMinutes(startDate.getMinutes() - 15);
        
        const result = await syncReceiptsWindow(startDate, endDate, 'incremental');
        console.log('✅ Incremental sync completed:', result);
      } catch (error) {
        console.error('❌ Scheduled incremental sync failed:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    this.intervals.push(interval);
    console.log('📅 Incremental POS sync scheduled every 15 minutes');
  }

  /**
   * Process analytics for the latest shift
   */
  private async processAnalytics() {
    try {
      console.log('📊 Starting scheduled analytics processing...');
      
      const { processAnalytics } = await import('./analytics/processor.js');
      
      const restaurant = await this.prisma.restaurant.findFirst({
        where: { slug: 'smash-brothers-burgers' }
      });
      
      if (restaurant) {
        const analytics = await processAnalytics(restaurant.id);
        console.log('✅ Analytics processing completed:', {
          shiftDate: analytics?.shiftDate,
          flags: analytics?.flags?.length || 0
        });
      }
    } catch (error) {
      console.error('❌ Scheduled analytics processing failed:', error);
    }
  }

  /**
   * Generate and send Jussi email summary
   */
  private async generateJussiSummary() {
    try {
      console.log('📧 Starting scheduled Jussi summary generation...');
      
      const { generateDailySummary } = await import('./jussi/summaryGenerator.js');
      const result = await generateDailySummary();
      
      console.log('✅ Jussi summary completed:', {
        jobId: result.jobId,
        emailSent: !!result.emailResult,
        recipient: result.emailResult?.recipient
      });
    } catch (error) {
      console.error('❌ Scheduled Jussi summary failed:', error);
    }
  }

  /**
   * Send daily sales summary to management
   */
  private async sendDailySalesSummary() {
    try {
      console.log('📧 Starting daily sales summary generation...');
      
      const { pool } = await import('../db');
      const { workingEmailService } = await import('./workingEmailService');
      
      // Get yesterday's sales data (for previous shift)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const result = await pool.query(
        `SELECT * FROM daily_sales_v2 WHERE "shiftDate" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
        [yesterdayStr]
      );
      
      if (result.rows.length === 0) {
        console.log('📧 No sales data found for yesterday, skipping summary');
        return;
      }
      
      const salesData = result.rows[0];
      const payload = salesData.payload || {};
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
            🍔 Daily Sales Summary - ${salesData.shiftDate}
          </h2>
          
          <div style="background-color: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #34495e; margin-top: 0;">Shift Details</h3>
            <p><strong>Completed by:</strong> ${salesData.completedBy}</p>
            <p><strong>Date:</strong> ${salesData.shiftDate}</p>
            <p><strong>Submitted:</strong> ${new Date(salesData.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })}</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
            <div style="background-color: ${payload.balanced ? '#d5f4e6' : '#ffebee'}; padding: 15px; border-radius: 5px;">
              <h4 style="color: ${payload.balanced ? '#27ae60' : '#e74c3c'}; margin-top: 0;">
                💰 Cash Balance ${payload.balanced ? '✅' : '❌'}
              </h4>
              <p style="font-size: 18px; font-weight: bold; margin: 0;">
                ${payload.balanced ? 'BALANCED' : 'UNBALANCED'}
              </p>
            </div>
            
            <div style="background-color: #d5f4e6; padding: 15px; border-radius: 5px;">
              <h4 style="color: #27ae60; margin-top: 0;">💰 Total Sales</h4>
              <p style="font-size: 24px; font-weight: bold; color: #27ae60; margin: 0;">
                ฿${(payload.totalSales / 100).toLocaleString()}
              </p>
            </div>
          </div>

          <p style="color: #7f8c8d; font-size: 14px; text-align: center; margin-top: 30px; border-top: 1px solid #bdc3c7; padding-top: 20px;">
            Generated automatically by Smash Brothers Burgers Management System<br>
            ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })} (Bangkok Time)
          </p>
        </div>
      `;
      
      await workingEmailService.sendEmail(
        'smashbrothersburgersth@gmail.com',
        `Daily Sales Summary - ${salesData.shiftDate}`,
        html
      );
      
      console.log('✅ Daily sales summary sent successfully');
    } catch (error) {
      console.error('❌ Daily sales summary failed:', error);
    }
  }

  // Manual trigger for testing
  async triggerManualSync() {
    await this.syncReceiptsAndReports();
  }

  // Manual trigger for new services
  async triggerPOSSync() {
    const { syncReceiptsWindow } = await import('./pos-ingestion/ingester.js');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() - 60); // Last hour
    return await syncReceiptsWindow(startDate, endDate, 'manual');
  }

  async triggerAnalytics() {
    const { processAnalytics } = await import('./analytics/processor.js');
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { slug: 'smash-brothers-burgers' }
    });
    if (restaurant) {
      return await processAnalytics(restaurant.id);
    }
    return null;
  }

  async triggerJussiSummary() {
    const { generateDailySummary } = await import('./jussi/summaryGenerator.js');
    return await generateDailySummary();
  }

  private async runFinanceCalculations() {
    try {
      console.log('💰 Running finance calculations...');
      
      // Import the finance job here to avoid circular dependencies
      const { runDailyFinanceJob } = await import('../jobs/dailyFinanceJob');
      await runDailyFinanceJob();
      
      console.log('✅ Finance calculations completed');
    } catch (error) {
      console.error('❌ Failed to run finance calculations:', error);
    }
  }

  private async cacheBurgerMetrics() {
    try {
      console.log('🍔 Caching burger metrics for previous shift...');
      
      const { DateTime } = await import('luxon');
      const { buildAndSaveBurgerShiftCache } = await import('./shiftBurgerCache');
      
      const now = DateTime.now().setZone('Asia/Bangkok');
      const d = now.minus({ days: 1 }).startOf('day');
      const shiftDateLabel = d.toISODate()!;
      const fromISO = d.plus({ hours: 18 }).toISO()!;
      const toISO = d.plus({ days: 1, hours: 3 }).toISO()!;
      
      await buildAndSaveBurgerShiftCache({ fromISO, toISO, shiftDateLabel, restaurantId: null });
      console.log(`✅ Burger metrics cached for shift ${shiftDateLabel}`);
    } catch (error) {
      console.error('❌ Failed to cache burger metrics:', error);
    }
  }

  private async ingestDailyPOSData() {
    try {
      console.log('📊 Starting Daily Review POS data ingestion...');
      
      const { ingestShiftForDate } = await import('./loyverseIngest');
      
      // Get yesterday's date (the shift that just completed)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
      
      await ingestShiftForDate(yesterdayStr);
      console.log(`✅ Daily Review POS data ingested for ${yesterdayStr}`);
    } catch (error) {
      console.error('❌ Failed to ingest Daily Review POS data:', error);
    }
  }

  private async rebuildShiftAnalytics() {
    try {
      console.log('📊 Rebuilding Shift Analytics MM cache for previous shift...');
      
      const { computeShiftAll } = await import('./shiftItems');
      
      // Get yesterday's date (the shift that just completed at 3 AM)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const result = await computeShiftAll(yesterdayStr);
      console.log(`✅ Shift Analytics MM cache rebuilt for ${result.shiftDate}: ${result.items.length} items`);
    } catch (error) {
      console.error('❌ Failed to rebuild Shift Analytics MM cache:', error);
    }
  }
}

export const schedulerService = new SchedulerService();
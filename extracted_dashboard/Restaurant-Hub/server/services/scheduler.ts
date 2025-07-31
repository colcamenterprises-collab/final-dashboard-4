import { loyverseAPI } from "../loyverseAPI";

export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];

  start() {
    // Schedule daily receipt sync at 3am Bangkok time (end of shift)
    this.scheduleDailyTask(() => {
      this.syncReceiptsAndReports();
    }, 3, 0); // 3:00 AM Bangkok time

    console.log('Scheduler service started - daily sync at 3am Bangkok time');
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

  // Manual trigger for testing
  async triggerManualSync() {
    await this.syncReceiptsAndReports();
  }
}

export const schedulerService = new SchedulerService();
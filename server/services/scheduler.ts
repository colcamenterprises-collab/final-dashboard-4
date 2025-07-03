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
      const bangkokTime = new Date(now.getTime() + (7 * 60 * 60 * 1000)); // Bangkok UTC+7
      
      // Create scheduled time in Bangkok timezone
      const bangkokScheduledTime = new Date(bangkokTime);
      bangkokScheduledTime.setHours(hour, minute, 0, 0);

      // If the scheduled time has passed today in Bangkok, schedule for tomorrow
      if (bangkokScheduledTime <= bangkokTime) {
        bangkokScheduledTime.setDate(bangkokScheduledTime.getDate() + 1);
      }

      // Convert back to UTC for setTimeout
      const utcScheduledTime = new Date(bangkokScheduledTime.getTime() - (7 * 60 * 60 * 1000));
      const timeUntilNext = utcScheduledTime.getTime() - now.getTime();

      const timeout = setTimeout(() => {
        console.log(`🕐 Executing daily sync at ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} Bangkok time`);
        task();
        // Schedule the next occurrence
        scheduleNext();
      }, timeUntilNext);

      console.log(`Next receipt sync scheduled for: ${bangkokScheduledTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} Bangkok time`);
      return timeout;
    };

    scheduleNext();
  }

  private async syncReceiptsAndReports() {
    try {
      console.log('🔄 Starting daily receipt and shift report sync...');
      
      // Sync receipts from Loyverse using Bangkok timezone-aware API
      const receiptCount = await loyverseAPI.syncTodaysReceipts();
      console.log(`✅ Synced ${receiptCount} receipts from completed shift`);

      // Sync additional data (items, customers, etc.)
      const itemCount = await loyverseAPI.syncAllItems();
      console.log(`✅ Synced ${itemCount} menu items`);

      const customerCount = await loyverseAPI.syncCustomers();
      console.log(`✅ Synced ${customerCount} customers`);

      console.log('🎉 Daily sync completed successfully');
    } catch (error) {
      console.error('❌ Daily sync failed:', error);
    }
  }

  // Manual trigger for testing
  async triggerManualSync() {
    await this.syncReceiptsAndReports();
  }
}

export const schedulerService = new SchedulerService();
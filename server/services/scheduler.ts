import { loyverseReceiptService } from "./loyverseReceipts";

export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];

  start() {
    // Schedule daily receipt sync at 4am
    this.scheduleDailyTask(() => {
      this.syncReceiptsAndReports();
    }, 4, 0); // 4:00 AM

    console.log('Scheduler service started - daily sync at 4am');
  }

  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('Scheduler service stopped');
  }

  private scheduleDailyTask(task: () => void, hour: number, minute: number) {
    const scheduleNext = () => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hour, minute, 0, 0);

      // If the scheduled time has passed today, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const timeUntilNext = scheduledTime.getTime() - now.getTime();

      const timeout = setTimeout(() => {
        task();
        // Schedule the next occurrence
        scheduleNext();
      }, timeUntilNext);

      console.log(`Next receipt sync scheduled for: ${scheduledTime.toLocaleString()}`);
      return timeout;
    };

    scheduleNext();
  }

  private async syncReceiptsAndReports() {
    try {
      console.log('Starting daily receipt and shift report sync...');
      
      // Sync receipts from Loyverse
      const receiptResult = await loyverseReceiptService.fetchAndStoreReceipts();
      console.log(`Synced ${receiptResult.receiptsProcessed} receipts`);

      // Generate and store shift reports
      const reportResult = await loyverseReceiptService.fetchAndStoreShiftReports();
      console.log(`Generated ${reportResult.reportsProcessed} shift reports`);

      console.log('Daily sync completed successfully');
    } catch (error) {
      console.error('Daily sync failed:', error);
    }
  }

  // Manual trigger for testing
  async triggerManualSync() {
    await this.syncReceiptsAndReports();
  }
}

export const schedulerService = new SchedulerService();
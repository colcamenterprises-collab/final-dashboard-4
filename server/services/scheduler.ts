import { loyverseAPI } from "../loyverseAPI";
import { buildShiftSummary } from "./receiptSummary";
import { PrismaClient } from '@prisma/client';

export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];
  private prisma = new PrismaClient();

  start() {
    // Initialize restaurant data first
    this.initializeRestaurant();

    // Schedule daily receipt sync at 3:00 AM Bangkok time (end of 5pm-3am shift)
    // Receipts only — shift report sync is intentionally separated (see 3:30 AM below)
    this.scheduleDailyTask(() => {
      this.syncReceiptsOnly();
    }, 3, 0); // 3:00 AM Bangkok time

    // Schedule daily summary job at 3:05 AM Bangkok time  
    this.scheduleDailyTask(() => {
      this.buildDailySummary();
    }, 3, 5); // 3:05 AM Bangkok time

    // Schedule loyverse_shifts sync at 3:30 AM Bangkok time
    // Runs 30 minutes after shift close so the register is fully closed and
    // Loyverse has finalised the shift report before we query the API.
    this.scheduleDailyTask(() => {
      this.syncNewShifts();
    }, 3, 30); // 3:30 AM Bangkok time

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

    console.log('[Scheduler] Daily task pipeline registered');
    console.log('  03:00  receipt sync → lv_receipt');
    console.log('  03:05  daily summary build');
    console.log('  03:10  burger metrics cache');
    console.log('  03:15  Daily Review POS ingest');
    console.log('  03:20  shift analytics MM cache');
    console.log('  03:30  loyverse_shifts sync (post-close)');
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

  // Receipts-only sync — runs at 3:00 AM Bangkok.
  // Shift report sync (syncNewShifts) runs separately at 3:30 AM to avoid
  // racing against the register close, which happens at or after 3:00 AM.
  private async syncReceiptsOnly() {
    try {
      console.log('🔄 [3:00 AM] Starting daily receipt sync...');

      const receiptCount = await loyverseAPI.syncTodaysReceipts();
      console.log(`✅ Synced ${receiptCount} receipts from completed shift`);

      if (receiptCount > 0) {
        console.log('🔄 Processing shift analytics for previous shift...');
        const { processPreviousShift } = await import('./shiftAnalytics');
        const analyticsResult = await processPreviousShift();
        console.log(`📊 Shift analytics: ${analyticsResult.message}`);
      }

      console.log('🎉 Receipt sync completed successfully');
    } catch (error) {
      console.error('❌ Receipt sync failed:', error);
    }
  }

  private async syncNewShifts() {
    try {
      console.log('🔄 [3:30 AM] Syncing shifts (last 3 days + missing shift recovery)...');

      const endTime   = new Date();
      const startTime = new Date(endTime.getTime() - (3 * 24 * 60 * 60 * 1000));

      const shiftsResponse = await loyverseAPI.getShifts({
        start_time: startTime.toISOString(),
        end_time:   endTime.toISOString(),
        limit: 50,
      });

      console.log(`📊 Found ${shiftsResponse.shifts.length} shifts from Loyverse API`);

      const { db }              = await import('../db');
      const { loyverse_shifts } = await import('../../shared/schema');

      // Group closed shifts by Bangkok business date
      const shiftsByDate = new Map<string, any[]>();
      for (const shift of shiftsResponse.shifts as any[]) {
        // Skip open/unclosed shifts — incomplete payment totals until closed_at is set.
        if (!shift.closed_at) {
          console.log(`⏭️  Skipping open shift (no closed_at): id=${shift.id ?? 'unknown'}`);
          continue;
        }
        const openedAt = shift.opened_at || shift.opening_time;
        if (!openedAt) continue;
        const bangkokOpen = new Date(new Date(openedAt).getTime() + (7 * 60 * 60 * 1000));
        const dateStr     = bangkokOpen.toISOString().split('T')[0];
        if (!shiftsByDate.has(dateStr)) shiftsByDate.set(dateStr, []);
        shiftsByDate.get(dateStr)!.push(shift);
      }

      if (!db) throw new Error('[syncNewShifts] DB not available');

      let imported = 0;
      for (const [dateStr, shifts] of shiftsByDate) {
        try {
          await db.insert(loyverse_shifts)
            .values({ shiftDate: dateStr, data: { shifts } })
            .onConflictDoUpdate({ target: loyverse_shifts.shiftDate, set: { data: { shifts } } });
          imported++;
        } catch (e: any) {
          console.error(`Failed to upsert shift for ${dateStr}:`, e.message);
        }
      }

      console.log(imported > 0
        ? `✅ Imported/updated ${imported} shift date(s)`
        : '✅ No new shifts to import — all up to date');

      // ── Missing shift recovery ──────────────────────────────────────────
      // Loyverse sometimes finalises shift reports hours after the register
      // closes. Find any fully-closed BKK business date in the last 3 days
      // that has receipts in lv_receipt but no row in loyverse_shifts, then
      // query Loyverse again with a targeted window for that date.
      const { PrismaClient } = await import('@prisma/client');
      const recoveryPrisma   = new PrismaClient();
      try {
        const missingRows = await recoveryPrisma.$queryRaw<{ biz_date: string }[]>`
          WITH bkk_dates AS (
            SELECT DISTINCT
              CASE
                WHEN EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3
                THEN (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day'
                ELSE (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
              END AS biz_date
            FROM lv_receipt
            WHERE datetime_bkk >= NOW() - INTERVAL '4 days'
          )
          SELECT biz_date::text
          FROM bkk_dates
          WHERE biz_date < (NOW() AT TIME ZONE 'Asia/Bangkok')::date
            AND biz_date NOT IN (SELECT shift_date FROM loyverse_shifts)
          ORDER BY biz_date DESC
        `;

        if (missingRows.length === 0) {
          console.log('✅ [shift-recovery] No missing shift dates in last 3 days');
        } else {
          console.log(`⚠️  [shift-recovery] Missing shift data for: ${missingRows.map(r => r.biz_date).join(', ')}`);

          for (const { biz_date: rawDate } of missingRows) {
            const biz_date = String(rawDate).slice(0, 10); // normalise "2026-06-09 00:00:00" → "2026-06-09"
            try {
              // BKK business date: shift opens biz_date-1 at ~17:00 BKK = 10:00 UTC
              //                    shift closes biz_date  at ~03:00 BKK = biz_date-1 20:00 UTC
              // Query window padded ±2h to catch edge cases.
              const midnight   = new Date(`${biz_date}T00:00:00Z`);
              const retryStart = new Date(midnight.getTime() - (14 * 3_600_000)); // biz_date-1 10:00 UTC
              const retryEnd   = new Date(midnight.getTime() + ( 4 * 3_600_000)); // biz_date 04:00 UTC

              const retryResp    = await loyverseAPI.getShifts({
                start_time: retryStart.toISOString(),
                end_time:   retryEnd.toISOString(),
                limit: 10,
              });
              const closedShifts = (retryResp.shifts as any[]).filter(s => !!s.closed_at);

              if (closedShifts.length > 0 && db) {
                await db.insert(loyverse_shifts)
                  .values({ shiftDate: biz_date, data: { shifts: closedShifts } })
                  .onConflictDoUpdate({
                    target: loyverse_shifts.shiftDate,
                    set: { data: { shifts: closedShifts } },
                  });
                console.log(`✅ [shift-recovery] Recovered shift for ${biz_date} (${closedShifts.length} record(s))`);
              } else if (!db) {
                console.error('[shift-recovery] DB not available for recovery insert');
              } else {
                console.log(`⏳ [shift-recovery] No closed shift yet for ${biz_date} — Loyverse may not have finalised`);
              }
            } catch (retryErr: any) {
              console.error(`❌ [shift-recovery] Failed for ${biz_date}:`, retryErr.message);
            }
          }
        }
      } finally {
        await recoveryPrisma.$disconnect();
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
      
      console.log(`✅ Shift summary built successfully`);
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
        
        // @ts-expect-error - JavaScript module without type declarations
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


  // Manual trigger for testing
  async triggerManualSync() {
    await this.syncReceiptsOnly();
  }

  // Manual trigger for new services
  async triggerPOSSync() {
    // @ts-expect-error - JavaScript module without type declarations
    const { syncReceiptsWindow } = await import('./pos-ingestion/ingester.js');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() - 60); // Last hour
    return await syncReceiptsWindow(startDate, endDate, 'manual');
  }

  async triggerAnalytics() {
    console.log('[scheduler] analytics/processor.js has been removed. No-op.');
    return null;
  }

  async triggerJussiSummary() {
    console.log('[scheduler] Jussi summary system has been removed.');
    return null;
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
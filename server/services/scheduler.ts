import cron from 'node-cron';
import { DateTime } from 'luxon';
import { loyverseAPI } from "../loyverseAPI";
import { buildShiftSummary } from "./receiptSummary";
import { PrismaClient } from '@prisma/client';

const TZ = 'Asia/Bangkok';

export class SchedulerService {
  private prisma = new PrismaClient();
  private jobsRegistered = false;
  private lastStartupCatchupAt: string | null = null;
  private lastScheduledSyncResult: Record<string, any> | null = null;

  start() {
    if (this.jobsRegistered) {
      console.log('[Scheduler] Already registered — skipping duplicate start');
      return;
    }
    this.jobsRegistered = true;

    // Initialize restaurant data on start
    this.initializeRestaurant();

    // ── Daily cron pipeline (node-cron, Asia/Bangkok timezone) ──────────────
    // Previously used custom setTimeout chains which were lost on server restart.
    // node-cron with explicit timezone fires reliably after any restart.

    // 03:00 BKK — receipt sync into lv_receipt (end of 18:00–03:00 shift)
    cron.schedule('0 3 * * *', () => {
      console.log('[Scheduler][CRON] 03:00 BKK — receipt sync fired');
      this.syncReceiptsOnly();
    }, { timezone: TZ });

    // 03:05 BKK — daily summary build
    cron.schedule('5 3 * * *', () => {
      console.log('[Scheduler][CRON] 03:05 BKK — daily summary fired');
      this.buildDailySummary();
    }, { timezone: TZ });

    // 03:10 BKK — burger metrics cache
    cron.schedule('10 3 * * *', () => {
      console.log('[Scheduler][CRON] 03:10 BKK — burger metrics cache fired');
      this.cacheBurgerMetrics();
    }, { timezone: TZ });

    // 03:15 BKK — Daily Review POS ingest
    cron.schedule('15 3 * * *', () => {
      console.log('[Scheduler][CRON] 03:15 BKK — daily review POS ingest fired');
      this.ingestDailyPOSData();
    }, { timezone: TZ });

    // 03:20 BKK — Shift Analytics MM cache
    cron.schedule('20 3 * * *', () => {
      console.log('[Scheduler][CRON] 03:20 BKK — shift analytics rebuild fired');
      this.rebuildShiftAnalytics();
    }, { timezone: TZ });

    // 03:30 BKK — loyverse_shifts sync (30 min after register close)
    cron.schedule('30 3 * * *', () => {
      console.log('[Scheduler][CRON] 03:30 BKK — loyverse_shifts sync fired');
      this.syncNewShifts();
    }, { timezone: TZ });

    console.log('[Scheduler] Cron pipeline registered (Asia/Bangkok)');
    console.log('  03:00  receipt sync → lv_receipt');
    console.log('  03:05  daily summary build');
    console.log('  03:10  burger metrics cache');
    console.log('  03:15  Daily Review POS ingest');
    console.log('  03:20  shift analytics MM cache');
    console.log('  03:30  loyverse_shifts sync (post-close)');

    // Run startup catch-up (async, non-blocking)
    this.startupCatchup().catch(err =>
      console.error('[Scheduler] Startup catch-up error:', err?.message ?? err)
    );
  }

  stop() {
    console.log('[Scheduler] Stop called — node-cron tasks will cease at process exit');
  }

  /**
   * On server start: detect and sync any missing receipt/shift dates
   * for the last 5 completed BKK business dates. Idempotent.
   *
   * A "business date" for day D covers receipts from
   *   D-1 17:00 BKK  →  D 03:00 BKK
   *
   * Dates that already have receipts are skipped.
   * Dates with receipts but no loyverse_shifts row are re-queried.
   */
  async startupCatchup(): Promise<void> {
    const started = Date.now();
    console.log('[Scheduler] ── Startup catch-up starting (last 5 BKK business dates) ──');

    const bkk = DateTime.now().setZone(TZ);
    // Only catch up fully-closed dates (i.e. exclude today — shift may still be open)
    const datesToCheck: string[] = [];
    for (let i = 1; i <= 5; i++) {
      datesToCheck.push(bkk.minus({ days: i }).toISODate()!);
    }

    const missingReceiptDates: string[] = [];
    const missingShiftDates: string[] = [];
    const catchupResults: Record<string, any> = {};

    try {
      const { importShift } = await import('./loyverseImportV2.js');
      const { db }          = await import('../db');
      const { loyverse_shifts } = await import('../../shared/schema');

      if (!db) {
        console.warn('[Scheduler] DB not available — startup catch-up aborted');
        return;
      }

      for (const date of datesToCheck) {
        // Check receipt count for this business date
        // Business window: (date-1) 17:00 BKK → date 03:00 BKK, expressed as UTC
        const windowStart = DateTime.fromISO(date, { zone: TZ }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 }).minus({ hours: 7 }).toUTC().toISO()!;
        const windowEnd   = DateTime.fromISO(date, { zone: TZ }).set({ hour: 3, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO()!;

        const rcRows = await this.prisma.$queryRaw<{ n: number }[]>`
          SELECT COUNT(*)::int AS n
          FROM lv_receipt
          WHERE datetime_bkk >= ${windowStart}::timestamptz
            AND datetime_bkk <  ${windowEnd}::timestamptz`;
        const receiptCount = Number(rcRows[0]?.n ?? 0);

        const shiftRows = await this.prisma.$queryRaw<{ n: number }[]>`
          SELECT COUNT(*)::int AS n FROM loyverse_shifts WHERE shift_date = ${date}::date`;
        const shiftCount = Number(shiftRows[0]?.n ?? 0);

        if (receiptCount === 0) {
          missingReceiptDates.push(date);
          console.log(`[Scheduler] Catch-up: missing receipts for ${date} — syncing now`);
          try {
            const syncResult = await importShift(date);
            catchupResults[date] = {
              receipts: syncResult.importedReceipts ?? 0,
              updated: syncResult.updatedReceipts ?? 0,
              skipped: syncResult.skippedDuplicateReceipts ?? 0,
              status: 'synced',
            };
            console.log(`[Scheduler] Catch-up: ${date} synced — ${catchupResults[date].receipts} new, ${catchupResults[date].updated} updated`);
          } catch (syncErr: any) {
            catchupResults[date] = { status: 'error', error: syncErr?.message ?? String(syncErr) };
            console.error(`[Scheduler] Catch-up: sync failed for ${date}:`, syncErr?.message ?? syncErr);
          }
        } else {
          catchupResults[date] = { receipts: receiptCount, status: 'already_present' };
        }

        if (shiftCount === 0 && receiptCount > 0) {
          missingShiftDates.push(date);
        }
      }

      // Recover missing loyverse_shifts for dates that have receipts
      if (missingShiftDates.length > 0) {
        console.log(`[Scheduler] Catch-up: recovering loyverse_shifts for: ${missingShiftDates.join(', ')}`);
        for (const date of missingShiftDates) {
          try {
            const midnight   = new Date(`${date}T00:00:00Z`);
            const retryStart = new Date(midnight.getTime() - (14 * 3_600_000));
            const retryEnd   = new Date(midnight.getTime() + ( 4 * 3_600_000));

            const shiftsResp = await loyverseAPI.getShifts({
              start_time: retryStart.toISOString(),
              end_time:   retryEnd.toISOString(),
              limit: 10,
            });
            const closedShifts = (shiftsResp.shifts as any[]).filter(s => !!s.closed_at);
            if (closedShifts.length > 0) {
              await db.insert(loyverse_shifts)
                .values({ shiftDate: date, data: { shifts: closedShifts } })
                .onConflictDoUpdate({
                  target: loyverse_shifts.shiftDate,
                  set:    { data: { shifts: closedShifts } },
                });
              console.log(`[Scheduler] Catch-up: recovered loyverse_shifts for ${date} (${closedShifts.length} shift record(s))`);
            } else {
              console.log(`[Scheduler] Catch-up: no closed shift found yet for ${date} — may still be pending in Loyverse`);
            }
          } catch (shiftErr: any) {
            console.error(`[Scheduler] Catch-up: shift recovery failed for ${date}:`, shiftErr?.message ?? shiftErr);
          }
        }
      }

      const durationMs = Date.now() - started;
      this.lastStartupCatchupAt = new Date().toISOString();
      console.log(`[Scheduler] ── Startup catch-up complete in ${durationMs}ms ──`);
      console.log(`[Scheduler]   missing receipts: ${missingReceiptDates.length ? missingReceiptDates.join(', ') : 'none'}`);
      console.log(`[Scheduler]   missing shifts:   ${missingShiftDates.length ? missingShiftDates.join(', ') : 'none'}`);

    } catch (err: any) {
      console.error('[Scheduler] Startup catch-up failed:', err?.message ?? err);
    }
  }

  // ── Receipt sync ────────────────────────────────────────────────────────────
  // Runs at 03:00 BKK. Syncs the just-closed shift into lv_receipt.
  private async syncReceiptsOnly() {
    const started = Date.now();
    console.log('[Scheduler][3:00] Starting scheduled receipt sync...');
    try {
      const receiptCount = await loyverseAPI.syncTodaysReceipts();
      const durationMs = Date.now() - started;
      console.log(`[Scheduler][3:00] Receipt sync complete: ${receiptCount} receipts imported/updated in ${durationMs}ms`);
      this.lastScheduledSyncResult = { type: 'receipt', at: new Date().toISOString(), count: receiptCount, durationMs, status: 'ok' };

      if (receiptCount > 0) {
        const { processPreviousShift } = await import('./shiftAnalytics');
        const analyticsResult = await processPreviousShift();
        console.log(`[Scheduler][3:00] Shift analytics: ${analyticsResult.message}`);
      }
    } catch (error: any) {
      console.error('[Scheduler][3:00] Receipt sync failed:', error?.message ?? error);
      this.lastScheduledSyncResult = { type: 'receipt', at: new Date().toISOString(), status: 'error', error: error?.message ?? String(error) };
    }
  }

  private async syncNewShifts() {
    const started = Date.now();
    try {
      console.log('[Scheduler][3:30] Syncing shifts (last 3 days + missing shift recovery)...');

      const endTime   = new Date();
      const startTime = new Date(endTime.getTime() - (3 * 24 * 60 * 60 * 1000));

      const shiftsResponse = await loyverseAPI.getShifts({
        start_time: startTime.toISOString(),
        end_time:   endTime.toISOString(),
        limit: 50,
      });

      console.log(`[Scheduler][3:30] Found ${shiftsResponse.shifts.length} shifts from Loyverse API`);

      const { db }              = await import('../db');
      const { loyverse_shifts } = await import('../../shared/schema');

      const shiftsByDate = new Map<string, any[]>();
      for (const shift of shiftsResponse.shifts as any[]) {
        if (!shift.closed_at) {
          console.log(`[Scheduler][3:30] Skipping open shift (no closed_at): id=${shift.id ?? 'unknown'}`);
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
          console.error(`[Scheduler][3:30] Failed to upsert shift for ${dateStr}:`, e.message);
        }
      }

      const durationMs = Date.now() - started;
      if (imported > 0) {
        console.log(`[Scheduler][3:30] Shift sync complete: ${imported} date(s) upserted in ${durationMs}ms`);
      } else {
        console.log(`[Scheduler][3:30] Shift sync complete: no new shifts to import (${durationMs}ms)`);
      }

      // ── Missing shift recovery ─────────────────────────────────────────────
      const recoveryPrisma = new PrismaClient();
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
          ORDER BY biz_date DESC`;

        if (missingRows.length === 0) {
          console.log('[Scheduler][3:30] [shift-recovery] No missing shift dates in last 3 days');
        } else {
          console.log(`[Scheduler][3:30] [shift-recovery] Missing: ${missingRows.map(r => r.biz_date).join(', ')}`);

          for (const { biz_date: rawDate } of missingRows) {
            const biz_date = String(rawDate).slice(0, 10);
            try {
              const midnight   = new Date(`${biz_date}T00:00:00Z`);
              const retryStart = new Date(midnight.getTime() - (14 * 3_600_000));
              const retryEnd   = new Date(midnight.getTime() + ( 4 * 3_600_000));

              const retryResp    = await loyverseAPI.getShifts({ start_time: retryStart.toISOString(), end_time: retryEnd.toISOString(), limit: 10 });
              const closedShifts = (retryResp.shifts as any[]).filter(s => !!s.closed_at);

              if (closedShifts.length > 0 && db) {
                await db.insert(loyverse_shifts)
                  .values({ shiftDate: biz_date, data: { shifts: closedShifts } })
                  .onConflictDoUpdate({ target: loyverse_shifts.shiftDate, set: { data: { shifts: closedShifts } } });
                console.log(`[Scheduler][3:30] [shift-recovery] Recovered ${biz_date} (${closedShifts.length} record(s))`);
              } else {
                console.log(`[Scheduler][3:30] [shift-recovery] No closed shift yet for ${biz_date} — Loyverse may not have finalised`);
              }
            } catch (retryErr: any) {
              console.error(`[Scheduler][3:30] [shift-recovery] Failed for ${biz_date}:`, retryErr.message);
            }
          }
        }
      } finally {
        await recoveryPrisma.$disconnect();
      }

    } catch (error: any) {
      console.error('[Scheduler][3:30] Shift sync failed:', error?.message ?? error);
    }
  }

  private async buildDailySummary() {
    try {
      console.log('[Scheduler][3:05] Building daily shift summary...');
      const bangkokNow = new Date(new Date().getTime() + 7 * 3600_000);
      const dateStr = bangkokNow.toISOString().slice(0, 10);
      console.log('[Scheduler][3:05] Building shift summary for', dateStr);
      await buildShiftSummary(dateStr);
      console.log('[Scheduler][3:05] Shift summary built');
    } catch (error: any) {
      console.error('[Scheduler][3:05] Daily summary failed:', error?.message ?? error);
    }
  }

  private async cacheBurgerMetrics() {
    try {
      console.log('[Scheduler][3:10] Caching burger metrics for previous shift...');
      const { buildAndSaveBurgerShiftCache } = await import('./shiftBurgerCache');
      const now  = DateTime.now().setZone(TZ);
      const d    = now.minus({ days: 1 }).startOf('day');
      await buildAndSaveBurgerShiftCache({
        fromISO:       d.plus({ hours: 18 }).toISO()!,
        toISO:         d.plus({ days: 1, hours: 3 }).toISO()!,
        shiftDateLabel: d.toISODate()!,
        restaurantId:  null,
      });
      console.log(`[Scheduler][3:10] Burger metrics cached for ${d.toISODate()}`);
    } catch (error: any) {
      console.error('[Scheduler][3:10] Burger metrics cache failed:', error?.message ?? error);
    }
  }

  private async ingestDailyPOSData() {
    try {
      console.log('[Scheduler][3:15] Starting Daily Review POS data ingestion...');
      const { ingestShiftForDate } = await import('./loyverseIngest');
      const now       = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dateStr   = yesterday.toISOString().split('T')[0];
      await ingestShiftForDate(dateStr);
      console.log(`[Scheduler][3:15] Daily Review POS ingested for ${dateStr}`);
    } catch (error: any) {
      console.error('[Scheduler][3:15] Daily Review POS ingest failed:', error?.message ?? error);
    }
  }

  private async rebuildShiftAnalytics() {
    try {
      console.log('[Scheduler][3:20] Rebuilding Shift Analytics MM cache...');
      const { computeShiftAll } = await import('./shiftItems');
      const now       = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dateStr   = yesterday.toISOString().split('T')[0];
      const result    = await computeShiftAll(dateStr);
      console.log(`[Scheduler][3:20] Shift Analytics rebuilt for ${result.shiftDate}: ${result.items.length} items`);
    } catch (error: any) {
      console.error('[Scheduler][3:20] Shift Analytics rebuild failed:', error?.message ?? error);
    }
  }

  private async initializeRestaurant() {
    try {
      let restaurant = await this.prisma.restaurant.findFirst({ where: { slug: 'smash-brothers-burgers' } });
      if (!restaurant) {
        restaurant = await this.prisma.restaurant.create({
          data: { name: 'Smash Brothers Burgers', slug: 'smash-brothers-burgers', email: 'smashbrothersburgersth@gmail.com', timezone: 'Asia/Bangkok', locale: 'en-TH' },
        });
        console.log('[Scheduler] Restaurant created:', restaurant.name);
      }

      const posConnection = await this.prisma.posConnection.findFirst({ where: { restaurantId: restaurant.id, provider: 'LOYVERSE', isActive: true } });
      if (!posConnection) {
        await this.prisma.posConnection.create({
          data: { restaurantId: restaurant.id, provider: 'LOYVERSE', apiKey: (process.env.LOYVERSE_API_TOKEN ?? '').substring(0, 8) + '...', isActive: true },
        });
        console.log('[Scheduler] POS connection created for Loyverse');
      }
    } catch (error: any) {
      console.error('[Scheduler] Restaurant initialization failed:', error?.message ?? error);
    }
  }

  // ── Public helpers ──────────────────────────────────────────────────────────

  isJobsRegistered(): boolean { return this.jobsRegistered; }
  getLastStartupCatchupAt(): string | null { return this.lastStartupCatchupAt; }
  getLastScheduledSyncResult(): Record<string, any> | null { return this.lastScheduledSyncResult; }

  async triggerManualSync() { await this.syncReceiptsOnly(); }

  async triggerPOSSync() {
    // @ts-expect-error — JS module without type declarations
    const { syncReceiptsWindow } = await import('./pos-ingestion/ingester.js');
    const endDate   = new Date();
    const startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() - 60);
    return await syncReceiptsWindow(startDate, endDate, 'manual');
  }

  async triggerAnalytics() {
    console.log('[Scheduler] analytics/processor.js has been removed. No-op.');
    return null;
  }

  async triggerJussiSummary() {
    console.log('[Scheduler] Jussi summary system has been removed.');
    return null;
  }
}

export const schedulerService = new SchedulerService();

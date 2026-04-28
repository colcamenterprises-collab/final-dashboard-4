import cron from 'node-cron';
import { DateTime } from 'luxon';
import {
  getLocationsWithRostersInWeek,
  prepareWeeklyRosterDistribution,
} from '../services/rosterExportService';

function getWeekStartForNow(nowBkk: DateTime): string {
  return nowBkk.startOf('week').toISODate() as string;
}

export function registerWeeklyRosterDistributionCron() {
  console.log('[CRON] Weekly roster export cron registered (Sunday 03:30 Asia/Bangkok)');

  cron.schedule(
    '30 3 * * 0',
    async () => {
      try {
        const nowBkk = DateTime.now().setZone('Asia/Bangkok');
        const weekStart = getWeekStartForNow(nowBkk);
        const locations = await getLocationsWithRostersInWeek(weekStart);

        if (locations.length === 0) {
          console.log(`[CRON] Weekly roster export skipped. No rosters for weekStart=${weekStart}`);
          return;
        }

        for (const locationId of locations) {
          const prepared = await prepareWeeklyRosterDistribution(weekStart, locationId);
          console.log('[CRON] Weekly roster distribution prepared', {
            weekStart: prepared.weekStart,
            locationId: prepared.locationId,
            artifactCount: prepared.artifacts.length,
            distributionPlan: prepared.distributionPlan,
          });
        }
      } catch (error) {
        console.error('[CRON] Weekly roster distribution failed:', error);
      }
    },
    { timezone: 'Asia/Bangkok' }
  );
}

import { computeShiftAll } from './shiftItems.js';

/**
 * Backfill shift analytics cache for a date range
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format (inclusive)
 */
export async function backfillShiftAnalytics(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    throw new Error('Start date must be before or equal to end date');
  }

  const results = [];
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    
    try {
      console.log(`📊 Processing ${dateStr}...`);
      const result = await computeShiftAll(dateStr);
      results.push({
        date: dateStr,
        success: true,
        itemCount: result.items.length,
        shiftDate: result.shiftDate
      });
      console.log(`✅ ${dateStr}: ${result.items.length} items cached`);
    } catch (error) {
      console.error(`❌ Failed to process ${dateStr}:`, error);
      results.push({
        date: dateStr,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return results;
}

/**
 * Backfill the last N days of shift analytics
 */
export async function backfillLastNDays(days: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log(`📊 Backfilling shift analytics from ${startStr} to ${endStr} (${days} days)`);
  return await backfillShiftAnalytics(startStr, endStr);
}

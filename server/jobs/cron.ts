// server/jobs/cron.ts
import cron from 'node-cron';
import { computeShiftAll } from '../services/shiftItems.js';
import { computeAndUpsertRollsLedger } from '../services/rollsLedger.js';
import { computeAndUpsertMeatLedger } from '../services/meatLedger.js';
import { computeAndUpsertDrinksLedger } from '../services/drinksLedger.js';

console.log('📊 SBB POS analytics + stock ledger cron jobs scheduled');

function bkkYesterdayISODate(): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0,10);
}

// 03:05 BKK — build internal POS analytics cache for yesterday's shift.
cron.schedule('5 3 * * *', async () => {
  const d = bkkYesterdayISODate();
  try {
    await computeShiftAll(d);
    console.log(`[CRON] SBB POS analytics built for ${d}`);
  } catch (e) {
    console.error(`[CRON] SBB POS analytics build failed for ${d}`, e);
  }
}, { timezone: 'Asia/Bangkok' });

// 03:15 BKK — rebuild all stock ledgers from the POS-native analytics cache.
cron.schedule('15 3 * * *', async () => {
  const shiftDate = bkkYesterdayISODate();
  try {
    await computeAndUpsertRollsLedger(shiftDate);
    await computeAndUpsertMeatLedger(shiftDate);
    await computeAndUpsertDrinksLedger(shiftDate);
    console.log(`[CRON] Ledger parity rebuild complete for ${shiftDate}`);
  } catch (e) {
    console.error(`[CRON] Ledger parity rebuild failed`, e);
  }
}, { timezone: 'Asia/Bangkok' });

// Hourly safety re-run for today's in-progress shift.
cron.schedule('0 * * * *', async () => {
  const shiftDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  try {
    await computeShiftAll(shiftDate);
    await computeAndUpsertRollsLedger(shiftDate);
    await computeAndUpsertMeatLedger(shiftDate);
    await computeAndUpsertDrinksLedger(shiftDate);
    console.log(`[CRON] Hourly POS/ledger refresh for ${shiftDate}`);
  } catch (_e) {
    // non-fatal
  }
}, { timezone: 'Asia/Bangkok' });

export {};

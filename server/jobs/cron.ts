// server/jobs/cron.ts
import cron from 'node-cron';
import fetch from 'node-fetch';
import { computeShiftAll } from '../services/shiftItems.js';
import { computeAndUpsertRollsLedger } from '../services/rollsLedger.js';

console.log('📊 Ingestion audit + analytics + rolls ledger cron jobs scheduled');

// yesterday in BKK terms
function bkkYesterdayISODate(): string {
  const now = new Date();
  // BKK is UTC+7, but we work in UTC window using the "shiftDate" day key.
  // Yesterday relative to server clock is fine for our shift key.
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0,10);
}

// 02:55 BKK — ensure POS data exists + audit (before analytics)
cron.schedule('55 2 * * *', async () => {
  const d = bkkYesterdayISODate();
  try {
    const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5000';
    const resp = await fetch(`${base}/api/loyverse/ensure-shift?date=${d}`, { method: 'POST' });
    const result = await resp.json();
    console.log('[CRON] ensure-shift', result);
  } catch (e) {
    console.error('[CRON] ensure-shift failed', e);
  }
}, { timezone: 'Asia/Bangkok' });

// 03:05 BKK — ensure analytics cache for yesterday's shift (pulls POS + writes analytics cache via computeShiftAll)
cron.schedule('5 3 * * *', async () => {
  const d = bkkYesterdayISODate();
  try {
    await computeShiftAll(d);
    console.log(`[CRON] Analytics built for ${d}`);
  } catch (e) {
    console.error(`[CRON] Analytics build failed for ${d}`, e);
  }
}, { timezone: 'Asia/Bangkok' });

// 03:15 BKK — update rolls ledger for yesterday (uses analytics + forms + expenses)
cron.schedule('15 3 * * *', async () => {
  const d = bkkYesterdayISODate();
  try {
    const res = await computeAndUpsertRollsLedger(d);
    console.log(`[CRON] Rolls ledger upserted`, res);
  } catch (e) {
    console.error(`[CRON] Rolls ledger failed`, e);
  }
}, { timezone: 'Asia/Bangkok' });

// Hourly safety re-run for today's in-progress shift (keeps ledger fresh if stock form arrives late)
cron.schedule('0 * * * *', async () => {
  const now = new Date().toISOString().slice(0,10);
  try {
    await computeAndUpsertRollsLedger(now);
    console.log(`[CRON] Hourly refresh for ${now}`);
  } catch (e) {
    // non-fatal
  }
}, { timezone: 'Asia/Bangkok' });

export {};

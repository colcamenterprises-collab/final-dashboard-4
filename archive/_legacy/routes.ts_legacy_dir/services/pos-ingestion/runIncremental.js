#!/usr/bin/env node
/**
 * One-shot incremental sync runner with configurable window
 * Usage: WINDOW_MINUTES=1440 node server/services/pos-ingestion/runIncremental.js
 */
import { syncReceiptsWindow } from './ingester.js';

async function main() {
  const windowMinutes = parseInt(process.env.WINDOW_MINUTES || '60', 10);
  
  // Calculate Bangkok time window
  const endLocal = new Date(); // Current time
  const startLocal = new Date(endLocal.getTime() - (windowMinutes * 60 * 1000));
  
  console.log(`🔄 Running incremental sync for last ${windowMinutes} minutes`);
  console.log('Bangkok window:', {
    start: startLocal.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }),
    end: endLocal.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
  });
  
  try {
    const result = await syncReceiptsWindow(startLocal, endLocal, 'manual-incremental');
    console.log('✅ Incremental sync completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Incremental sync failed:', error.message);
    process.exit(1);
  }
}

main();
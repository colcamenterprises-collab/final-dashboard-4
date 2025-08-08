/**
 * Incremental sync worker - fetch last 15 minutes of POS data
 */
import { syncReceiptsWindow } from './ingester.js';

async function runIncremental() {
  try {
    console.log('Starting incremental POS sync...');
    
    // Calculate last 15 minutes
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() - 15);
    
    console.log(`Syncing receipts from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Sync receipts
    const result = await syncReceiptsWindow(startDate, endDate, 'incremental');
    console.log('Incremental sync result:', result);
    
    console.log('Incremental sync completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Incremental sync failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIncremental();
}

export { runIncremental };
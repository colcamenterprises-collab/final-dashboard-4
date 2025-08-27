/**
 * Backfill worker - fetch last 90 days of POS data
 */
import { syncReceiptsWindow, syncMenuItems } from './ingester.js';

async function runBackfill() {
  try {
    console.log('Starting POS backfill...');
    
    // Calculate 90 days ago
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    console.log(`Backfilling receipts from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Sync receipts
    const receiptResult = await syncReceiptsWindow(startDate, endDate, 'backfill');
    console.log('Receipt sync result:', receiptResult);
    
    // Sync menu items
    const menuResult = await syncMenuItems();
    console.log('Menu sync result:', menuResult);
    
    console.log('Backfill completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBackfill();
}

export { runBackfill };
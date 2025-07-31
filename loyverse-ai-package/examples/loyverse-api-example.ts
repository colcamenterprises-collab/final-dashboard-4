// Example: How to use Loyverse services
import { LiveReceiptService } from '../server/services/liveReceiptService';
import { calculateShiftWindow } from '../server/utils/shiftTimeCalculator';

// Get current shift data
const shiftWindow = calculateShiftWindow(new Date());
console.log('Current shift:', shiftWindow);

// Get latest shift summary
const receiptService = new LiveReceiptService();
const summary = await receiptService.getLatestShiftSummary();
console.log('Shift summary:', summary);

import { generateShiftSummary } from './server/services/burgerVarianceService.js';

async function testRollVariance() {
  console.log('Testing roll variance tracking...');
  
  // Test with today's date
  const today = new Date();
  const result = await generateShiftSummary(today);
  console.log('Result:', result);
  
  // Test with a specific date
  const testDate = new Date('2025-07-12');
  const result2 = await generateShiftSummary(testDate);
  console.log('Result for July 12:', result2);
}

testRollVariance().catch(console.error);
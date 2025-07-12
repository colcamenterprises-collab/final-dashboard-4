import { buildShiftSummary } from './server/services/receiptSummary.ts';

async function testSummary() {
  try {
    console.log('Testing shift summary generation...');
    
    // Test with July 12, 2025 (has 246 receipts)
    const dateStr = '2025-07-12';
    
    console.log('Building summary for date:', dateStr);
    const summary = await buildShiftSummary(dateStr);
    
    console.log('Summary built successfully:');
    console.log('- Burgers sold:', summary.burgersSold);
    console.log('- Drinks sold:', summary.drinksSold);
    console.log('- Items breakdown:', Object.keys(summary.itemsBreakdown));
    console.log('- Modifiers:', Object.keys(summary.modifiersSummary));
    
    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSummary();
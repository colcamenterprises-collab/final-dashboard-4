import { importReceiptsV2 } from '../services/loyverseImportV2.js';
import { computeShift } from '../services/shiftItems.js';
import { shiftWindow } from '../services/time/shiftWindow.js';

async function testMeekongMumba() {
  console.log('='.repeat(60));
  console.log('MEEKONG MUMBA V1.0 - INTEGRATION TEST');
  console.log('='.repeat(60));

  const testDate = '2025-10-19';
  const { fromISO, toISO } = shiftWindow(testDate);
  
  console.log(`\n📅 Testing shift: ${testDate} (5 PM → 3 AM Bangkok)`);
  console.log(`   Time window: ${fromISO} → ${toISO}`);
  
  // Step 1: Import receipts
  console.log('\n--- STEP 1: Import Receipts ---');
  try {
    const imported = await importReceiptsV2(fromISO, toISO);
    console.log(`✅ Imported ${imported.receipts} receipts, ${imported.lineItems} line items, ${imported.modifiers} modifiers`);
  } catch (err) {
    console.error('❌ Import failed:', err);
    throw err;
  }
  
  // Step 2: Compute shift analytics
  console.log('\n--- STEP 2: Compute Shift Analytics ---');
  try {
    const result = await computeShift(testDate);
    
    console.log(`\n📊 SHIFT ANALYTICS (${testDate})`);
    console.log(`   Shift window: ${result.fromISO} → ${result.toISO}`);
    console.log(`   Total items: ${result.items.length}`);
    
    console.log('\n🍔 CATEGORY BREAKDOWN:');
    for (const [category, total] of Object.entries(result.totalsByCategory)) {
      console.log(`   ${String(category).padEnd(12)}: ${String(total).padStart(4)} items`);
    }
    
    console.log('\n🥩 MEAT CALCULATIONS:');
    const burgers = result.items.filter(i => i.category === 'burger');
    const totalPatties = burgers.reduce((sum, b) => sum + b.patties, 0);
    const totalRed = burgers.reduce((sum, b) => sum + b.redMeatGrams, 0);
    const totalChicken = burgers.reduce((sum, b) => sum + b.chickenGrams, 0);
    const totalRolls = burgers.reduce((sum, b) => sum + b.rolls, 0);
    
    console.log(`   Total patties: ${totalPatties}`);
    console.log(`   Beef (red):    ${totalRed}g`);
    console.log(`   Chicken:       ${totalChicken}g`);
    console.log(`   Rolls:         ${totalRolls}`);
    
    console.log('\n🍔 TOP 5 BURGERS:');
    const top5 = burgers
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    for (const b of top5) {
      const sku = b.sku ? `[${b.sku}]` : '[no-sku]';
      console.log(`   ${sku.padEnd(10)} ${b.name.padEnd(30)} x${b.qty}`);
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('❌ Analytics failed:', err);
    throw err;
  }
}

testMeekongMumba()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });

import { db } from './db.ts';
import { loyverseReceipts, dailyShiftSummary, inventory, shiftItemSales, dailyStockSales } from '../shared/schema.ts';
import { eq, desc, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';

async function syncData() {
  try {
    console.log('🔄 Starting comprehensive data sync...');
    
    const today = DateTime.now().setZone('Asia/Bangkok').toISODate();
    console.log(`📅 Syncing data for: ${today}`);

    // 1. Sync receipts from today's shift
    const receipts = await db.select().from(loyverseReceipts)
      .where(eq(loyverseReceipts.shiftDate, new Date(today)))
      .orderBy(desc(loyverseReceipts.createdAt));

    console.log(`📋 Found ${receipts.length} receipts for today`);

    if (receipts.length === 0) {
      console.log('⚠️  No receipts found for today. Run Loyverse sync first.');
      return;
    }

    // 2. Calculate burger sales from receipts
    const burgersSold = receipts.reduce((sum, receipt) => {
      const receiptItems = receipt.items || [];
      const burgerItems = receiptItems.filter(item => 
        item.item_name && item.item_name.toLowerCase().includes('burger')
      );
      return sum + burgerItems.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0);
    }, 0);

    console.log(`🍔 Total burgers sold: ${burgersSold}`);

    // 3. Update shift summary
    const existingSummary = await db.select().from(dailyShiftSummary)
      .where(eq(dailyShiftSummary.shiftDate, new Date(today)))
      .limit(1);

    if (existingSummary.length > 0) {
      await db.update(dailyShiftSummary)
        .set({ 
          burgersSold,
          updatedAt: new Date()
        })
        .where(eq(dailyShiftSummary.shiftDate, new Date(today)));
      console.log('✅ Updated existing shift summary');
    } else {
      await db.insert(dailyShiftSummary).values({
        shiftDate: new Date(today),
        burgersSold,
        rollsUsed: burgersSold, // 1 roll per burger
        rollsRemaining: 0, // Will be calculated below
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Created new shift summary');
    }

    // 4. Update stock levels based on usage
    const lastForm = await db.select().from(dailyStockSales)
      .orderBy(desc(dailyStockSales.shiftDate))
      .limit(1);

    let currentRolls = 0;
    let currentMeat = 0;
    let currentDrinks = 0;

    if (lastForm.length > 0) {
      const form = lastForm[0];
      
      // Calculate current stock (starting + purchases - usage)
      currentRolls = Math.max(0, (form.burgerBunsStock || 0) - burgersSold);
      currentMeat = Math.max(0, (form.meatWeight || 0) - (burgersSold * 0.15)); // 150g per burger
      currentDrinks = Math.max(0, (form.drinkStockCount || 0) - (burgersSold * 0.3)); // 30% drink attachment
      
      console.log(`📦 Stock calculations:
        - Burger Rolls: ${form.burgerBunsStock || 0} - ${burgersSold} = ${currentRolls}
        - Meat: ${form.meatWeight || 0}kg - ${(burgersSold * 0.15).toFixed(1)}kg = ${currentMeat.toFixed(1)}kg
        - Drinks: ${form.drinkStockCount || 0} - ${Math.round(burgersSold * 0.3)} = ${currentDrinks}`);
    }

    // Update inventory table
    const inventoryUpdates = [
      { name: 'Burger Rolls', quantity: Math.round(currentRolls), unit: 'pieces' },
      { name: 'Meat', quantity: Math.round(currentMeat * 100) / 100, unit: 'kg' },
      { name: 'Drinks', quantity: Math.round(currentDrinks), unit: 'bottles' }
    ];

    for (const item of inventoryUpdates) {
      const existing = await db.select().from(inventory)
        .where(eq(inventory.name, item.name))
        .limit(1);

      if (existing.length > 0) {
        await db.update(inventory)
          .set({ 
            quantity: item.quantity,
            unit: item.unit,
            updatedAt: new Date()
          })
          .where(eq(inventory.name, item.name));
      } else {
        await db.insert(inventory).values({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: 'Stock',
          cost: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    console.log('✅ Updated inventory levels');

    // 5. Update top sales items
    await db.delete(shiftItemSales).where(eq(shiftItemSales.shiftDate, new Date(today)));

    const salesData = [];
    for (const receipt of receipts) {
      const receiptItems = receipt.items || [];
      for (const item of receiptItems) {
        if (item.item_name && item.quantity && item.line_total) {
          salesData.push({
            shiftDate: new Date(today),
            itemName: item.item_name,
            quantity: item.quantity,
            salesTotal: parseFloat(item.line_total),
            createdAt: new Date()
          });
        }
      }
    }

    if (salesData.length > 0) {
      await db.insert(shiftItemSales).values(salesData);
      console.log(`✅ Updated ${salesData.length} sales items`);
    }

    // 6. Display summary results
    console.log('\n📊 SYNC RESULTS:');
    console.log('================');
    
    const summary = await db.select().from(dailyShiftSummary)
      .where(eq(dailyShiftSummary.shiftDate, new Date(today)));
    console.log('\n📋 Shift Summary:');
    console.table(summary);

    const stock = await db.select().from(inventory)
      .where(sql`name IN ('Burger Rolls', 'Meat', 'Drinks')`);
    console.log('\n📦 Current Stock:');
    console.table(stock);

    const topSales = await db.select({
      itemName: shiftItemSales.itemName,
      totalQuantity: sql`SUM(${shiftItemSales.quantity})`.as('total_quantity'),
      totalSales: sql`SUM(${shiftItemSales.salesTotal})`.as('total_sales')
    })
    .from(shiftItemSales)
    .where(eq(shiftItemSales.shiftDate, new Date(today)))
    .groupBy(shiftItemSales.itemName)
    .orderBy(desc(sql`SUM(${shiftItemSales.salesTotal})`))
    .limit(5);
    
    console.log('\n🏆 Top Sales Items:');
    console.table(topSales);

    console.log('\n✅ Data sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during data sync:', error);
    console.error('Error details:', error.message);
  }
}

// Run the sync
syncData();
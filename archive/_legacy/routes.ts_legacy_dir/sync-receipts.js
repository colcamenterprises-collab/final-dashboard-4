import { db } from './db.ts';
import { loyverseReceipts, shiftSummary, inventory, shiftItemSales } from '../shared/schema.ts';
import { eq, sql, desc } from 'drizzle-orm';
import { DateTime } from 'luxon';
import winston from 'winston';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const logger = winston.createLogger({ 
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/sync.log' })
  ]
});

async function syncReceipts() {
  try {
    const today = DateTime.now().setZone('Asia/Bangkok').toISODate();
    const shiftDate = '2025-07-17';
    
    logger.info('Starting receipt sync for July 17-18 shift');
    
    // Read CSV - using the exact filename from attached_assets
    const csvPath = 'attached_assets/1 receipts_1752803228439.csv';
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true });
    
    logger.info(`Found ${records.length} receipts to process`);
    
    // Clear existing data for this shift
    await db.delete(loyverseReceipts).where(eq(loyverseReceipts.shiftDate, shiftDate));
    await db.delete(shiftItemSales).where(eq(shiftItemSales.shiftDate, shiftDate));
    
    // Process each receipt
    const itemCounts = {};
    const itemSales = {};
    let totalSales = 0;
    let burgerCount = 0;
    let drinkCount = 0;
    
    for (const record of records) {
      const receiptId = record['Receipt number'];
      const netSales = parseFloat(record['Net sales'].replace(/[฿,]/g, ''));
      const paymentType = record['Payment type'];
      const description = record['Description'];
      
      // Parse receipt date
      const receiptDate = DateTime.fromFormat(record['Date'], 'M/d/yy h:mm a', { zone: 'Asia/Bangkok' }).toISO();
      
      // Insert receipt
      await db.insert(loyverseReceipts).values({
        receiptId,
        receiptNumber: receiptId,
        receiptDate: new Date(receiptDate),
        shiftDate: new Date(shiftDate),
        totalAmount: netSales,
        paymentMethod: paymentType,
        items: JSON.stringify([{ description, amount: netSales }]),
        createdAt: new Date()
      });
      
      totalSales += netSales;
      
      // Parse items from description
      const itemList = description.split(', ');
      for (const item of itemList) {
        const match = item.match(/^(\d+)\s+x\s+(.+)$/);
        if (match) {
          const quantity = parseInt(match[1]);
          const itemName = match[2];
          
          itemCounts[itemName] = (itemCounts[itemName] || 0) + quantity;
          itemSales[itemName] = (itemSales[itemName] || 0) + (netSales / itemList.length);
          
          // Count burgers and drinks
          if (itemName.includes('Burger') || itemName.includes('เบอร์เกอร์')) {
            burgerCount += quantity;
          }
          if (itemName.includes('Coke') || itemName.includes('Sprite') || itemName.includes('Fanta') || itemName.includes('Bottle Water')) {
            drinkCount += quantity;
          }
        } else {
          // Handle single items without quantity prefix
          const itemName = item;
          itemCounts[itemName] = (itemCounts[itemName] || 0) + 1;
          itemSales[itemName] = (itemSales[itemName] || 0) + (netSales / itemList.length);
          
          if (itemName.includes('Burger') || itemName.includes('เบอร์เกอร์')) {
            burgerCount += 1;
          }
          if (itemName.includes('Coke') || itemName.includes('Sprite') || itemName.includes('Fanta') || itemName.includes('Bottle Water')) {
            drinkCount += 1;
          }
        }
      }
    }
    
    logger.info(`Total sales: ฿${totalSales}, Burgers: ${burgerCount}, Drinks: ${drinkCount}`);
    
    // Update shift summary
    await db.delete(shiftSummary).where(eq(shiftSummary.shiftDate, shiftDate));
    await db.insert(shiftSummary).values({
      shiftDate: shiftDate,
      totalSales,
      burgersSold: burgerCount,
      drinksSold: drinkCount,
      sidesSold: 0, // Will be calculated from receipt items
      extrasSold: 0,
      otherSold: 0,
      totalReceipts: records.length,
      createdAt: new Date()
    });
    
    // Insert top sales items
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [itemName, quantity] of topItems) {
      await db.insert(shiftItemSales).values({
        shiftDate: shiftDate,
        category: 'OTHER', // Will categorize based on item name
        itemName,
        quantity,
        salesTotal: Math.round(itemSales[itemName] || 0),
        createdAt: new Date()
      });
    }
    
    // Update inventory based on usage
    const rollsUsed = burgerCount;
    const meatUsed = burgerCount * 0.15; // 150g per burger average
    const drinksUsed = drinkCount;
    
    // Get current inventory
    const currentInventory = await db.select().from(inventory);
    
    // Update rolls
    const rollsItem = currentInventory.find(item => item.name === 'Burger Rolls');
    if (rollsItem) {
      const newQuantity = Math.max(0, parseInt(rollsItem.quantity) - rollsUsed);
      await db.update(inventory)
        .set({ quantity: newQuantity.toString() })
        .where(eq(inventory.name, 'Burger Rolls'));
    }
    
    // Update meat
    const meatItem = currentInventory.find(item => item.name === 'Meat');
    if (meatItem) {
      const newQuantity = Math.max(0, parseFloat(meatItem.quantity) - meatUsed);
      await db.update(inventory)
        .set({ quantity: newQuantity.toFixed(2) })
        .where(eq(inventory.name, 'Meat'));
    }
    
    // Update drinks
    const drinksItem = currentInventory.find(item => item.name === 'Drinks');
    if (drinksItem) {
      const newQuantity = Math.max(0, parseInt(drinksItem.quantity) - drinksUsed);
      await db.update(inventory)
        .set({ quantity: newQuantity.toString() })
        .where(eq(inventory.name, 'Drinks'));
    }
    
    logger.info('Sync completed successfully');
    
    // Display results
    console.log('\n=== SYNC RESULTS ===');
    console.log(`Shift Date: ${shiftDate}`);
    console.log(`Total Sales: ฿${totalSales.toLocaleString()}`);
    console.log(`Receipts Processed: ${records.length}`);
    console.log(`Burgers Sold: ${burgerCount}`);
    console.log(`Drinks Sold: ${drinkCount}`);
    
    console.log('\nTop 5 Items:');
    topItems.slice(0, 5).forEach(([item, qty], index) => {
      console.log(`${index + 1}. ${item}: ${qty} units`);
    });
    
    console.log('\nUpdated Inventory:');
    const updatedInventory = await db.select().from(inventory);
    updatedInventory.forEach(item => {
      console.log(`${item.name}: ${item.quantity} ${item.unit}`);
    });
    
  } catch (error) {
    logger.error('Sync failed:', error);
    console.error('Error during sync:', error);
  }
}

// Run sync
syncReceipts().then(() => {
  console.log('\nData synchronization completed!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
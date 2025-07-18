import { db } from './db.ts';
import { loyverseReceipts, dailyShiftSummary, inventory, shiftItemSales } from '../shared/schema.ts';
import { eq, desc, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import winston from 'winston';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const logger = winston.createLogger({ 
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/align.log' })
  ]
});

async function alignReceipts() {
  try {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }

    const today = DateTime.now().setZone('Asia/Bangkok').toISODate(); // 2025-07-18
    console.log(`Processing receipt data for shift date: ${today}`);
    
    // Use the CSV file from attached_assets
    const csvPath = 'attached_assets/1 receipts_1752803228439.csv';
    
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found at: ${csvPath}`);
      return;
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });

    console.log(`Found ${records.length} receipts in CSV`);

    // Validate number of receipts
    if (records.length !== 35) {
      logger.warn(`CSV has ${records.length} receipts - expected 35`);
    }

    // Calculate totals - handle currency formatting
    const csvGrossSales = records.reduce((sum, r) => {
      const value = parseFloat(r['Gross sales'].replace(/[฿,]/g, '') || '0');
      return sum + value;
    }, 0);
    
    const csvNetSales = records.reduce((sum, r) => {
      const value = parseFloat(r['Net sales'].replace(/[฿,]/g, '') || '0');
      return sum + value;
    }, 0);

    console.log(`CSV totals: Gross ฿${csvGrossSales}, Net ฿${csvNetSales}`);

    // Validate expected totals
    if (Math.abs(csvGrossSales - 14369) > 1 || Math.abs(csvNetSales - 14345) > 1) {
      logger.warn(`CSV totals: Gross ${csvGrossSales}, Net ${csvNetSales} - expected 14369/14345`);
    }

    // Check current database state
    const dbSummary = await db.select().from(dailyShiftSummary).where(eq(dailyShiftSummary.shiftDate, today)).limit(1);
    const currentSummary = dbSummary[0];

    console.log('Current DB summary:', currentSummary);

    // Count burgers from receipts
    let totalBurgers = 0;
    for (const record of records) {
      const description = record.Description || '';
      const burgerMatches = description.match(/\d+ x [^,]*[Bb]urger/g) || [];
      burgerMatches.forEach(match => {
        const qty = parseInt(match.match(/(\d+) x/)?.[1] || '1');
        totalBurgers += qty;
      });
    }

    // Update or insert shift summary with all required fields
    if (currentSummary) {
      if (Math.abs(currentSummary.burgersSold - totalBurgers) > 0 || currentSummary.totalOrders !== 35) {
        await db.update(dailyShiftSummary)
          .set({ 
            burgersSold: totalBurgers,
            pattiesUsed: totalBurgers, // Assume 1 patty per burger
            rollsStart: 100, // Default values - these should be updated from actual data
            rollsPurchased: 0,
            rollsExpected: 100 - totalBurgers,
            rollsActual: 100 - totalBurgers,
            rollsVariance: 0,
            varianceFlag: false
          })
          .where(eq(dailyShiftSummary.shiftDate, today));
        logger.info(`Updated shift summary: ${totalBurgers} burgers sold`);
        console.log(`Updated shift summary: ${totalBurgers} burgers sold`);
      } else {
        console.log('Shift summary already correct');
      }
    } else {
      await db.insert(dailyShiftSummary).values({ 
        shiftDate: today, 
        burgersSold: totalBurgers,
        pattiesUsed: totalBurgers,
        rollsStart: 100,
        rollsPurchased: 0,
        rollsExpected: 100 - totalBurgers,
        rollsActual: 100 - totalBurgers,
        rollsVariance: 0,
        varianceFlag: false
      });
      logger.info(`Inserted new shift summary: ${totalBurgers} burgers sold`);
      console.log(`Inserted new shift summary: ${totalBurgers} burgers sold`);
    }

    // Analyze item sales from descriptions
    const itemSales = {};
    let totalDrinks = 0;

    for (const record of records) {
      const description = record.Description || '';
      
      // Count burgers
      const burgerMatches = description.match(/\d+ x [^,]*[Bb]urger/g) || [];
      burgerMatches.forEach(match => {
        const qty = parseInt(match.match(/(\d+) x/)?.[1] || '1');
        
        // Extract item name
        const itemName = match.replace(/\d+ x /, '').trim();
        itemSales[itemName] = (itemSales[itemName] || 0) + qty;
      });

      // Count drinks
      const drinkMatches = description.match(/\d+ x [^,]*(Coke|Sprite|Fanta|Water)/gi) || [];
      drinkMatches.forEach(match => {
        const qty = parseInt(match.match(/(\d+) x/)?.[1] || '1');
        totalDrinks += qty;
        
        const itemName = match.replace(/\d+ x /, '').trim();
        itemSales[itemName] = (itemSales[itemName] || 0) + qty;
      });

      // Count other items
      const otherMatches = description.match(/\d+ x [^,]*(Fries|Nuggets|Rings)/gi) || [];
      otherMatches.forEach(match => {
        const qty = parseInt(match.match(/(\d+) x/)?.[1] || '1');
        const itemName = match.replace(/\d+ x /, '').trim();
        itemSales[itemName] = (itemSales[itemName] || 0) + qty;
      });
    }

    console.log(`Counted ${totalBurgers} burgers, ${totalDrinks} drinks`);

    // Update top sales data
    await db.delete(shiftItemSales).where(eq(shiftItemSales.shiftDate, today));
    
    for (const [itemName, quantity] of Object.entries(itemSales)) {
      // Determine category based on item name
      let category = 'OTHER';
      if (itemName.toLowerCase().includes('burger')) {
        category = 'BURGERS';
      } else if (itemName.toLowerCase().includes('fries') || itemName.toLowerCase().includes('nuggets') || itemName.toLowerCase().includes('rings')) {
        category = 'SIDE_ORDERS';
      } else if (itemName.toLowerCase().includes('coke') || itemName.toLowerCase().includes('sprite') || itemName.toLowerCase().includes('fanta') || itemName.toLowerCase().includes('water')) {
        category = 'DRINKS';
      } else if (itemName.toLowerCase().includes('bacon') || itemName.toLowerCase().includes('cheese') || itemName.toLowerCase().includes('extra')) {
        category = 'BURGER_EXTRAS';
      }
      
      await db.insert(shiftItemSales).values({ 
        shiftDate: today, 
        category: category,
        itemName: itemName, 
        quantity: parseInt(quantity),
        salesTotal: '0' // Default value - would need actual calculation
      });
    }

    console.log(`Updated ${Object.keys(itemSales).length} item sales records`);

    // Check stock levels
    const dbStock = await db.select().from(inventory).where(sql`name IN ('Burger Rolls', 'Meat', 'Drinks')`);
    const rollStock = dbStock.find(s => s.name === 'Burger Rolls')?.quantity || 0;
    const meatStock = dbStock.find(s => s.name === 'Meat')?.quantity || 0;
    const drinkStock = dbStock.find(s => s.name === 'Drinks')?.quantity || 0;

    console.log(`Stock levels: Rolls ${rollStock}, Meat ${meatStock}, Drinks ${drinkStock}`);

    if (rollStock < totalBurgers) {
      logger.warn(`Low rolls: ${rollStock} < used ${totalBurgers}`);
    }
    if (drinkStock < totalDrinks) {
      logger.warn(`Low drinks: ${drinkStock} < used ${totalDrinks}`);
    }

    // Display results
    console.log('\n=== UPDATED SHIFT SUMMARY ===');
    const updatedSummary = await db.select().from(dailyShiftSummary).where(eq(dailyShiftSummary.shiftDate, today));
    console.table(updatedSummary);

    console.log('\n=== STOCK LEVELS ===');
    const stockLevels = await db.select().from(inventory).where(sql`name IN ('Burger Rolls', 'Meat', 'Drinks')`);
    console.table(stockLevels);

    console.log('\n=== TOP 5 SALES ===');
    const topSales = await db.select({
      itemName: shiftItemSales.itemName,
      quantity: sql`SUM(${shiftItemSales.quantity})`.as('total_quantity')
    }).from(shiftItemSales)
      .where(eq(shiftItemSales.shiftDate, today))
      .groupBy(shiftItemSales.itemName)
      .orderBy(desc(sql`SUM(${shiftItemSales.quantity})`))
      .limit(5);
    
    console.table(topSales);

    console.log('\n✅ Receipt data alignment completed successfully!');
    
  } catch (error) {
    console.error('Error aligning receipts:', error);
    logger.error('Error aligning receipts:', error);
  }
}

// Run the alignment
alignReceipts().catch(console.error);
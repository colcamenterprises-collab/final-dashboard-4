/**
 * PATCH A - DATA PARITY BACKFILL
 * 
 * This script ensures:
 * 1. All daily_sales_v2 records have corresponding daily_stock_v2 rows
 * 2. All daily_stock_v2 records have purchasing_shift_items for ALL active items
 * 
 * Run: npx tsx server/scripts/patchA-backfill.ts
 */

import { PrismaClient } from '@prisma/client';
import { pool } from '../db';

const prisma = new PrismaClient();

async function backfillDailyStock() {
  console.log('=== PATCH A: Data Parity Backfill ===\n');
  
  // Step 1: Find sales without stock records
  const salesWithoutStock = await pool.query(`
    SELECT dsv.id, dsv."shiftDate", dsv.payload
    FROM daily_sales_v2 dsv
    LEFT JOIN daily_stock_v2 ds ON ds."salesId" = dsv.id
    WHERE dsv."deletedAt" IS NULL AND ds.id IS NULL
  `);
  
  console.log(`[Step 1] Found ${salesWithoutStock.rows.length} sales records without daily_stock_v2`);
  
  for (const sale of salesWithoutStock.rows) {
    const payload = sale.payload || {};
    const rollsEnd = payload.rollsEnd ?? 0;
    const meatEnd = payload.meatEnd ?? 0;
    const drinkStock = payload.drinkStock ?? {};
    const purchasingJson = payload.purchasingJson ?? {};
    
    await pool.query(`
      INSERT INTO daily_stock_v2 (id, "salesId", "burgerBuns", "meatWeightG", "drinksJson", "purchasingJson", "createdAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
      ON CONFLICT ("salesId") DO NOTHING
    `, [sale.id, rollsEnd, meatEnd, JSON.stringify(drinkStock), JSON.stringify(purchasingJson)]);
    
    console.log(`  Created daily_stock_v2 for salesId=${sale.id} (${sale.shiftDate})`);
  }
  
  // Step 2: Get all active purchasing items
  const activeItems = await prisma.purchasingItem.findMany({
    where: { active: true }
  });
  console.log(`\n[Step 2] Found ${activeItems.length} active purchasing items`);
  
  // Step 3: Get all daily_stock_v2 records
  const stockRecords = await pool.query(`
    SELECT ds.id, dsv."shiftDate", dsv.payload
    FROM daily_stock_v2 ds
    JOIN daily_sales_v2 dsv ON ds."salesId" = dsv.id
    WHERE dsv."deletedAt" IS NULL
  `);
  
  console.log(`\n[Step 3] Processing ${stockRecords.rows.length} stock records for item sync`);
  
  let totalUpserts = 0;
  for (const stock of stockRecords.rows) {
    const payload = stock.payload || {};
    const requisition = payload.requisition || [];
    
    // Build qty map from requisition
    const qtyMap: Record<string, number> = {};
    if (Array.isArray(requisition)) {
      for (const item of requisition) {
        if (item.name) {
          qtyMap[item.name] = item.qty || 0;
        }
      }
    }
    
    // Upsert ALL active items
    for (const pItem of activeItems) {
      const qty = qtyMap[pItem.item] || 0;
      
      await prisma.purchasingShiftItem.upsert({
        where: {
          dailyStockId_purchasingItemId: {
            dailyStockId: stock.id,
            purchasingItemId: pItem.id
          }
        },
        update: { quantity: qty },
        create: {
          dailyStockId: stock.id,
          purchasingItemId: pItem.id,
          quantity: qty
        }
      });
      totalUpserts++;
    }
  }
  
  console.log(`\n[Step 4] Upserted ${totalUpserts} purchasing_shift_items rows`);
  
  // Verify
  const finalStockCount = await pool.query('SELECT COUNT(*) as cnt FROM daily_stock_v2');
  const finalItemCount = await pool.query('SELECT COUNT(*) as cnt FROM purchasing_shift_items');
  const salesCount = await pool.query(`SELECT COUNT(*) as cnt FROM daily_sales_v2 WHERE "deletedAt" IS NULL`);
  
  console.log('\n=== VERIFICATION ===');
  console.log(`daily_sales_v2 (active): ${salesCount.rows[0].cnt}`);
  console.log(`daily_stock_v2: ${finalStockCount.rows[0].cnt}`);
  console.log(`purchasing_shift_items: ${finalItemCount.rows[0].cnt}`);
  console.log(`Expected shift_items: ${stockRecords.rows.length} shifts × ${activeItems.length} items = ${stockRecords.rows.length * activeItems.length}`);
  
  await prisma.$disconnect();
  await pool.end();
  
  console.log('\n=== PATCH A BACKFILL COMPLETE ===');
}

backfillDailyStock().catch(console.error);

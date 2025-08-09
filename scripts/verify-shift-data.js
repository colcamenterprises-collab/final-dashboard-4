/**
 * Verification script to compare database receipts with CSV data for specific shift
 * Usage: node scripts/verify-shift-data.js [csv-path]
 */
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const TZ = 'Asia/Bangkok';
const prisma = new PrismaClient();

// Configuration
const RESTAURANT_SLUG = 'smash-brothers-burgers';
const CSV_PATH = process.argv[2] || './data/receipts_export.csv'; // pass path as arg
const SHIFT_START_LOCAL = new Date('2025-08-08T18:00:00+07:00');
const SHIFT_END_LOCAL   = new Date('2025-08-09T03:00:00+07:00');

function toUTC(d) { 
  return new Date(new Date(d).toISOString()); 
}

async function dbTotals(restaurantId) {
  const startUTC = toUTC(SHIFT_START_LOCAL);
  const endUTC   = toUTC(SHIFT_END_LOCAL);
  
  console.log(`🔍 Querying database for shift: ${SHIFT_START_LOCAL.toISOString()} to ${SHIFT_END_LOCAL.toISOString()}`);
  console.log(`🔍 UTC range: ${startUTC.toISOString()} to ${endUTC.toISOString()}`);
  
  const rows = await prisma.receipt.findMany({
    where: { 
      restaurantId, 
      createdAtUTC: { 
        gte: startUTC, 
        lte: endUTC 
      } 
    },
    include: { 
      payments: true, 
      items: true 
    }
  });
  
  const total = rows.reduce((a, r) => a + (r.total || 0), 0);
  const byPay = rows.flatMap(r => r.payments).reduce((m, p) => {
    m[p.method] = (m[p.method] || 0) + p.amount;
    return m;
  }, {});
  const count = rows.length;
  
  return { total, byPay, count, receipts: rows };
}

function csvTotals(csvPath) {
  if (!fs.existsSync(csvPath)) {
    console.log(`⚠️  CSV file not found: ${csvPath}`);
    return { total: 0, byPay: {}, count: 0, records: [] };
  }
  
  const input = fs.readFileSync(csvPath);
  const records = parse(input, { columns: true, skip_empty_lines: true });
  
  console.log(`📊 CSV contains ${records.length} total records`);
  console.log(`📊 CSV columns: ${Object.keys(records[0] || {}).join(', ')}`);
  
  // Filter for shift window
  const rows = records.filter(r => {
    const d = new Date(r.created_at || r.date || r.timestamp);
    return d >= SHIFT_START_LOCAL && d <= SHIFT_END_LOCAL;
  });
  
  const total = rows.reduce((a, r) => a + Number(r.total_money || r.total || r.amount || 0), 0);
  const byPay = rows.reduce((m, r) => {
    const k = String(r.payment_method || r.method || 'OTHER').toUpperCase();
    m[k] = (m[k] || 0) + Number(r.total_money || r.total || r.amount || 0);
    return m;
  }, {});
  const count = rows.length;
  
  return { total, byPay, count, records: rows };
}

async function main() {
  try {
    console.log('🏪 Shift Data Verification Tool');
    console.log('================================');
    
    const restaurant = await prisma.restaurant.findFirst({ 
      where: { slug: RESTAURANT_SLUG } 
    });
    
    if (!restaurant) { 
      console.error('❌ Restaurant not found'); 
      process.exit(1); 
    }
    
    console.log(`✅ Restaurant found: ${restaurant.name} (ID: ${restaurant.id})`);
    
    const db = await dbTotals(restaurant.id);
    const csv = csvTotals(CSV_PATH);
    
    const diffTotal = (db.total - csv.total);
    const diffCount = (db.count - csv.count);
    
    console.log('\n📊 COMPARISON RESULTS');
    console.log('=====================');
    console.log('Database:', {
      receipts: db.count,
      total: `$${(db.total / 100).toFixed(2)}`,
      payments: db.byPay
    });
    console.log('CSV File:', {
      receipts: csv.count,
      total: `$${(csv.total / 100).toFixed(2)}`,
      payments: csv.byPay
    });
    console.log('Differences:', {
      receipts: diffCount,
      total: `$${(diffTotal / 100).toFixed(2)}`,
      status: diffTotal === 0 && diffCount === 0 ? '✅ MATCH' : '⚠️  MISMATCH'
    });
    
    // Show sample receipts from database
    if (db.receipts.length > 0) {
      console.log('\n🧾 Sample Database Receipts:');
      db.receipts.slice(0, 3).forEach(r => {
        console.log(`  - ${r.number}: $${(r.total / 100).toFixed(2)} at ${r.createdAtUTC}`);
      });
    }
    
    // Show sample CSV records
    if (csv.records.length > 0) {
      console.log('\n📄 Sample CSV Records:');
      csv.records.slice(0, 3).forEach(r => {
        const total = r.total_money || r.total || r.amount || 0;
        const date = r.created_at || r.date || r.timestamp;
        console.log(`  - ${r.number || r.id || 'N/A'}: $${(total / 100).toFixed(2)} at ${date}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
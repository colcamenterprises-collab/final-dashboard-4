#!/usr/bin/env node
/**
 * CSV vs Database reconciliation script
 * Compares shift totals from CSV against database receipts
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function main() {
  try {
    // Load CSV data
    const csvPath = 'attached_assets/receipts-2025-08-08-2025-08-08_1754712009734.csv';
    console.log('📄 Loading CSV from:', csvPath);
    
    if (!fs.existsSync(csvPath)) {
      console.log('❌ CSV file not found at:', csvPath);
      process.exit(1);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, { 
      headers: true, 
      skip_empty_lines: true 
    });
    
    console.log('📊 CSV Analysis:');
    console.log('Total records:', records.length);
    
    // Calculate CSV totals
    let csvTotal = 0;
    let csvCount = 0;
    
    for (const record of records) {
      // Try different column name variations
      const total = parseFloat(
        record['Total collected'] || 
        record['total_money'] || 
        record['Total'] || 
        record['Amount'] ||
        record['Net sales'] ||
        0
      );
      if (total > 0) {
        csvTotal += total;
        csvCount++;
        console.log(`CSV Record: ${JSON.stringify(record).substring(0, 100)}...`);
        break; // Just check first valid record for debugging
      }
    }
    
    console.log('CSV totals:', {
      count: csvCount,
      totalAmount: csvTotal.toFixed(2),
      avgTicket: csvCount > 0 ? (csvTotal / csvCount).toFixed(2) : '0.00'
    });
    
    // Database analysis for shift window (Bangkok 17:00 Aug 8 → 03:00 Aug 9)
    const shiftStart = new Date('2025-08-08T10:00:00.000Z'); // 17:00 Bangkok = 10:00 UTC
    const shiftEnd = new Date('2025-08-08T20:00:00.000Z');   // 03:00 Bangkok = 20:00 UTC
    
    console.log('\n🗄️  Database Analysis:');
    console.log('Shift window UTC:', {
      start: shiftStart.toISOString(),
      end: shiftEnd.toISOString()
    });
    
    const dbReceipts = await prisma.receipt.findMany({
      where: {
        createdAtUTC: {
          gte: shiftStart,
          lte: shiftEnd
        }
      },
      select: {
        receiptNumber: true,
        total: true,
        createdAtUTC: true,
        externalId: true
      }
    });
    
    const dbTotal = dbReceipts.reduce((sum, receipt) => sum + (receipt.total || 0), 0);
    const dbCount = dbReceipts.length;
    
    console.log('Database totals:', {
      count: dbCount,
      totalAmount: (dbTotal / 100).toFixed(2), // Convert from cents
      avgTicket: dbCount > 0 ? (dbTotal / dbCount / 100).toFixed(2) : '0.00'
    });
    
    // Reconciliation
    console.log('\n🔍 Reconciliation:');
    const countDiff = Math.abs(csvCount - dbCount);
    const totalDiff = Math.abs(csvTotal - (dbTotal / 100));
    
    console.log('Differences:', {
      countGap: countDiff,
      totalGap: totalDiff.toFixed(2),
      percentageMatch: dbCount > 0 ? ((Math.min(csvCount, dbCount) / Math.max(csvCount, dbCount)) * 100).toFixed(1) + '%' : '0%'
    });
    
    if (countDiff > 5 || totalDiff > 100) {
      console.log('\n⚠️  Large discrepancies detected!');
      console.log('Possible causes:');
      console.log('• Wrong timezone conversion (check UTC window)');
      console.log('• Missing store_id filter');
      console.log('• Incomplete pagination (check cursor loop)');
      console.log('• CSV covers different time period');
    } else {
      console.log('\n✅ Data reconciliation looks good!');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
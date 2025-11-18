import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface PurchasingCSVRow {
  Item: string;
  Category: string;
  'Supplier Name': string;
  Brand: string;
  'Supplier SKU': string;
  'Order Unit ': string;
  'Unit Description': string;
  'Unit Cost': string;
  'Last Review Date': string;
}

export async function importPurchasingItems(csvPath: string) {
  try {
    console.log(`[ImportPurchasing] Reading CSV from: ${csvPath}`);

    const rows: PurchasingCSVRow[] = [];

    // Read CSV file
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row: PurchasingCSVRow) => {
          rows.push(row);
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    console.log(`[ImportPurchasing] Found ${rows.length} rows in CSV`);

    // Clear existing data (optional - comment out if you want to keep existing)
    const deletedCount = await prisma.purchasingItem.deleteMany({});
    console.log(`[ImportPurchasing] Deleted ${deletedCount.count} existing items`);

    // Parse and insert items
    const itemsToInsert = rows.map((row) => {
      // Parse unit cost - remove currency symbol and commas
      const unitCostStr = (row['Unit Cost'] || '').replace(/[฿,]/g, '').trim();
      const unitCost = unitCostStr ? parseFloat(unitCostStr) : null;

      return {
        item: row.Item?.trim() || '',
        category: row.Category?.trim() || null,
        supplierName: row['Supplier Name']?.trim() || null,
        brand: row.Brand?.trim() || null,
        supplierSku: row['Supplier SKU']?.trim() || null,
        orderUnit: row['Order Unit ']?.trim() || null, // Note the space in column name
        unitDescription: row['Unit Description']?.trim() || null,
        unitCost: unitCost,
        lastReviewDate: row['Last Review Date']?.trim() || null,
      };
    }).filter(item => item.item); // Only include rows with item names

    // Batch insert
    const result = await prisma.purchasingItem.createMany({
      data: itemsToInsert,
      skipDuplicates: true,
    });

    console.log(`[ImportPurchasing] Successfully imported ${result.count} purchasing items`);
    
    // Display sample of imported items
    const samples = await prisma.purchasingItem.findMany({ take: 5 });
    console.log('[ImportPurchasing] Sample items:');
    samples.forEach(item => {
      console.log(`  - ${item.item} (${item.category}) - ${item.unitCost ? `฿${item.unitCost}` : 'No price'}`);
    });

    return result.count;
  } catch (error) {
    console.error('[ImportPurchasing] Error:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const csvPath = process.argv[2] || path.join(process.cwd(), 'attached_assets', 'Purchasing list - Pricing - Supplier List new v1.1_1763327273802.csv');
  
  importPurchasingItems(csvPath)
    .then((count) => {
      console.log(`Import completed successfully: ${count} items imported`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

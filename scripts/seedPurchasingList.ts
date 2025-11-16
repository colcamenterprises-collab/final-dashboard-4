import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Purchasing List import...');

  const csvPath = path.join(process.cwd(), 'attached_assets', 'Purchasing list - Pricing - Supplier List new v1.1_1763327273802.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found at:', csvPath);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📄 Found ${records.length} items to import`);

  let imported = 0;
  let skipped = 0;

  for (const row of records) {
    try {
      const unitCostStr = row['Unit Cost'] || '';
      const unitCost = unitCostStr.replace('฿', '').replace(',', '').trim();

      const data = {
        item: row['Item'] || '',
        category: row['Category'] || null,
        supplierName: row['Supplier Name'] || null,
        brand: row['Brand'] || null,
        supplierSku: row['Supplier SKU'] || null,
        orderUnit: row['Order Unit '] || null, // Note: trailing space in CSV header
        unitDescription: row['Unit Description'] || null,
        unitCost: unitCost ? parseFloat(unitCost) : null,
        lastReviewDate: row['Last Review Date'] || null,
      };

      if (!data.item) {
        console.warn('⚠️  Skipping row with empty Item field');
        skipped++;
        continue;
      }

      await prisma.purchasingItem.create({
        data,
      });

      imported++;
      
      if (imported % 10 === 0) {
        console.log(`✓ Imported ${imported} items...`);
      }
    } catch (error) {
      console.error('❌ Error importing row:', row, error);
      skipped++;
    }
  }

  console.log('\n✅ Import complete!');
  console.log(`   Imported: ${imported}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${records.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const db = new PrismaClient();

interface MenuItem {
  itemName: string;
  sku: string;
  category: string;
  description: string;
  price: number;
}

async function parseCSV(filePath: string): Promise<MenuItem[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const menuItems: MenuItem[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/(?:^|,)(?:"([^"]*)"|([^",]*))/g);
    if (!matches || matches.length < 5) continue;
    
    const fields = matches.map(m => m.replace(/^,?"?|"?$/g, '').trim());
    
    menuItems.push({
      itemName: fields[0],
      sku: fields[1],
      category: fields[2],
      description: fields[3] || '',
      price: parseFloat(fields[4]) || 0
    });
  }
  
  return menuItems;
}

async function insertMissingItems() {
  console.log('🔄 Loading menu items from CSV...');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'All Menu Items- SKU and Categories - Loyverse_1761808391619.csv');
  const menuItems = await parseCSV(csvPath);
  
  console.log(`📦 Found ${menuItems.length} menu items in CSV`);
  
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const item of menuItems) {
    // Check if item exists
    const existing = await db.$queryRaw<{count: number}[]>`
      SELECT COUNT(*)::int as count FROM item_catalog WHERE sku = ${item.sku}
    `;
    
    if (existing[0].count > 0) {
      // Update category for existing items
      await db.$executeRaw`
        UPDATE item_catalog 
        SET category = ${item.category}, name = ${item.itemName}
        WHERE sku = ${item.sku}
      `;
      updated++;
      console.log(`✏️  Updated SKU ${item.sku}: ${item.itemName} → ${item.category}`);
    } else {
      // Insert new item
      await db.$executeRaw`
        INSERT INTO item_catalog (sku, name, category, active)
        VALUES (${item.sku}, ${item.itemName}, ${item.category}, true)
      `;
      inserted++;
      console.log(`✅ Inserted SKU ${item.sku}: ${item.itemName} (${item.category})`);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Inserted: ${inserted} new items`);
  console.log(`   ✏️  Updated: ${updated} existing items`);
  console.log(`   Total processed: ${menuItems.length} items`);
  
  // Display category distribution
  console.log('\n📂 Final category distribution:');
  const distribution = await db.$queryRaw<{category: string; count: number}[]>`
    SELECT category, COUNT(*)::int as count
    FROM item_catalog
    WHERE active = true
    GROUP BY category
    ORDER BY category
  `;
  
  for (const row of distribution) {
    console.log(`   ${row.category}: ${row.count} items`);
  }
}

insertMissingItems()
  .then(() => {
    console.log('\n✅ Item catalog update complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

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
    // Parse CSV line (handle quoted fields)
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

async function updateCategories() {
  console.log('🔄 Loading menu items from CSV...');
  
  const csvPath = path.join(process.cwd(), 'attached_assets', 'All Menu Items- SKU and Categories - Loyverse_1761808391619.csv');
  const menuItems = await parseCSV(csvPath);
  
  console.log(`📦 Found ${menuItems.length} menu items in CSV`);
  
  // Group by unique categories
  const categories = new Set(menuItems.map(m => m.category));
  console.log(`📂 Categories found: ${Array.from(categories).join(', ')}`);
  
  let updated = 0;
  let notFound = 0;
  
  for (const item of menuItems) {
    // Update item_catalog with correct category
    const result = await db.$executeRaw`
      UPDATE item_catalog 
      SET category = ${item.category}
      WHERE sku = ${item.sku}
    `;
    
    if (result > 0) {
      updated++;
      console.log(`✅ Updated SKU ${item.sku}: ${item.itemName} → ${item.category}`);
    } else {
      notFound++;
      console.log(`⚠️  SKU ${item.sku} not found in catalog: ${item.itemName}`);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updated} items`);
  console.log(`   ⚠️  Not found: ${notFound} items`);
  
  // Display current category distribution
  console.log('\n📂 Current category distribution:');
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

updateCategories()
  .then(() => {
    console.log('\n✅ Category update complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

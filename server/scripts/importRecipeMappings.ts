import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { db } from '../db';
import { recipeSkuMap } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CsvRow {
  channel: string;
  channelSku: string;
  recipeId: string;
}

async function importRecipeMappings() {
  console.log('🔄 Starting recipe mapping import...');
  
  const csvPath = path.resolve(__dirname, '../../data/recipe_mapping_seed.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rows: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  console.log(`📄 Found ${rows.length} rows in CSV`);
  
  let imported = 0;
  let skipped = 0;
  const unmatchedSkus: string[] = [];
  
  // Verify recipes exist - use bigint conversion
  const recipesResult = await db.execute<{ id: string; name: string }>(`SELECT id::text, name FROM recipes`);
  const recipeIds = new Set(recipesResult.rows.map(r => parseInt(r.id, 10)));
  console.log(`📋 Found ${recipeIds.size} recipes in database`);
  console.log(`📋 Recipe IDs: ${Array.from(recipeIds).slice(0, 10).join(', ')}...`);
  
  for (const row of rows) {
    const recipeId = parseInt(row.recipeId, 10);
    
    if (!recipeIds.has(recipeId)) {
      console.warn(`⚠️  Recipe ID ${recipeId} not found for SKU ${row.channelSku} - skipping`);
      unmatchedSkus.push(`${row.channel}:${row.channelSku} -> Recipe ${recipeId}`);
      skipped++;
      continue;
    }
    
    try {
      // Check if mapping already exists
      const existing = await db.select()
        .from(recipeSkuMap)
        .where(and(
          eq(recipeSkuMap.channel, row.channel),
          eq(recipeSkuMap.channelSku, row.channelSku)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing mapping
        await db.update(recipeSkuMap)
          .set({ 
            recipeId,
            updatedAt: new Date(),
            active: true 
          })
          .where(eq(recipeSkuMap.id, existing[0].id));
        console.log(`🔄 Updated: ${row.channel}:${row.channelSku} -> Recipe ${recipeId}`);
      } else {
        // Insert new mapping
        await db.insert(recipeSkuMap).values({
          channel: row.channel,
          channelSku: row.channelSku,
          recipeId,
          active: true,
        });
        console.log(`✅ Inserted: ${row.channel}:${row.channelSku} -> Recipe ${recipeId}`);
      }
      imported++;
    } catch (error) {
      console.error(`❌ Error processing ${row.channelSku}:`, error);
      skipped++;
    }
  }
  
  console.log('\n📊 Import Summary:');
  console.log(`   ✅ Imported: ${imported}`);
  console.log(`   ⚠️  Skipped: ${skipped}`);
  
  if (unmatchedSkus.length > 0) {
    console.log('\n❌ Unmatched SKUs (recipe not found):');
    unmatchedSkus.forEach(sku => console.log(`   - ${sku}`));
  }
  
  console.log('\n✅ Recipe mapping import complete!');
  process.exit(0);
}

importRecipeMappings().catch(err => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});

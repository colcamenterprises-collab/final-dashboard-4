// God file seed service - makes foodCostings.ts the permanent source of truth
import { db } from '../db';
import { ingredients } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { foodCostings } from '../data/foodCostings';

function cleanMoney(costStr: string): number {
  const cleaned = costStr.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export async function seedGodList() {
  try {
    console.log('[seedGodList] Starting seed from foodCostings.ts...');
    
    const rows = foodCostings;
    let seeded = 0;
    let updated = 0;
    
    for (const row of rows) {
      const cost = cleanMoney(row.cost);
      
      // Check if ingredient exists by name
      const existing = await db.select().from(ingredients).where(eq(ingredients.name, row.item));
      
      const ingredientData = {
        name: row.item,
        category: row.category,
        supplier: row.supplier,
        unitPrice: cost.toString(), // Keep legacy field
        price: cost.toString(),
        packageSize: '1', // Will be parsed from packagingQty if needed
        portionSize: parseFloat(row.averageMenuPortion?.replace(/[^\d.]/g, '') || '0').toString(),
        unit: 'g', // Default unit
        brand: row.brand || '',
        packagingQty: row.packagingQty || '',
        lastReviewDate: row.lastReviewDate || '',
        source: 'god', // Mark as from god file
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdated: new Date()
      };
      
      if (existing.length === 0) {
        // Insert new ingredient
        await db.insert(ingredients).values(ingredientData);
        seeded++;
      } else {
        // Update existing ingredient
        await db.update(ingredients)
          .set({ ...ingredientData, id: existing[0].id })
          .where(eq(ingredients.id, existing[0].id));
        updated++;
      }
    }
    
    console.log(`[seedGodList] ✅ Seeded from foodCostings.ts: ${seeded} new, ${updated} updated, total: ${rows.length} items`);
    return { seeded, updated, total: rows.length };
  } catch (error) {
    console.error('[seedGodList] ❌ Error seeding ingredients:', error);
    throw error;
  }
}

// Auto-seed on module load (called from server startup)
export async function autoSeedOnStartup() {
  console.log('[autoSeedOnStartup] Checking if auto-seed needed...');
  
  try {
    const existingCount = await db.select({ count: sql`count(*)` }).from(ingredients);
    const currentCount = Number(existingCount[0]?.count || 0);
    const godFileCount = foodCostings.length;
    
    if (currentCount === 0 || currentCount !== godFileCount) {
      console.log(`[autoSeedOnStartup] DB has ${currentCount} items, god file has ${godFileCount}. Auto-seeding...`);
      return await seedGodList();
    } else {
      console.log(`[autoSeedOnStartup] ✅ DB already synced: ${currentCount} items match god file`);
      return { seeded: 0, updated: 0, total: currentCount };
    }
  } catch (error) {
    console.error('[autoSeedOnStartup] ❌ Auto-seed failed:', error);
    return { seeded: 0, updated: 0, total: 0, error: error.message };
  }
}
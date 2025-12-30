/**
 * 🔒 PATCH 8 — RECIPE TEMPLATE SEED (SAFE, ADDITIVE)
 * 
 * Seeds Recipe Management with real recipe entries for every sellable POS item.
 * 
 * RULES:
 * - ADDITIVE ONLY - No deletions, no modifications to existing recipes
 * - IDEMPOTENT - Safe to re-run (skips existing recipes)
 * - Uses exact POS item names from lv_line_item
 * - NO ingredient mapping
 * - NO POS mapping
 * 
 * RUN ONCE:
 *   npx tsx server/scripts/seedRecipesFromPOS.ts
 */

import { db } from '../db';
import { recipe } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function seedRecipesFromPOS() {
  console.log('🍔 PATCH 8: Recipe Template Seed');
  console.log('================================\n');

  // Get all unique POS item names from lv_line_item
  const posItems = await db.execute<{ name: string }>(sql`
    SELECT DISTINCT name 
    FROM lv_line_item 
    WHERE name IS NOT NULL 
    ORDER BY name
  `);

  const posItemNames = posItems.rows.map(row => row.name);
  console.log(`📋 Found ${posItemNames.length} unique POS items\n`);

  // Get existing recipes
  const existingRecipes = await db.select({ name: recipe.name }).from(recipe);
  const existingNames = new Set(existingRecipes.map(r => r.name.toLowerCase()));

  let seeded = 0;
  let skipped = 0;

  for (const itemName of posItemNames) {
    // Check if recipe already exists (case-insensitive)
    if (existingNames.has(itemName.toLowerCase())) {
      console.log(`⏭️  SKIP: "${itemName}" (already exists)`);
      skipped++;
      continue;
    }

    // Insert new recipe
    try {
      await db.insert(recipe).values({
        name: itemName,
        yieldUnits: '1',
        active: true,
      });
      console.log(`✅ SEEDED: "${itemName}"`);
      seeded++;
      existingNames.add(itemName.toLowerCase()); // Prevent duplicates in same run
    } catch (err: any) {
      // Handle unique constraint violation gracefully
      if (err.code === '23505') {
        console.log(`⏭️  SKIP: "${itemName}" (unique constraint)`);
        skipped++;
      } else {
        console.error(`❌ ERROR seeding "${itemName}":`, err.message);
      }
    }
  }

  console.log('\n================================');
  console.log(`📊 RESULTS:`);
  console.log(`   Seeded: ${seeded} recipes`);
  console.log(`   Skipped (already existed): ${skipped}`);
  console.log(`   Total POS items: ${posItemNames.length}`);
  console.log('================================\n');

  return { seeded, skipped, total: posItemNames.length };
}

// Run if called directly
seedRecipesFromPOS()
  .then(result => {
    console.log('✅ Recipe seed complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Recipe seed failed:', err);
    process.exit(1);
  });

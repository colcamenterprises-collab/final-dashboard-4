import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds PurchasingFieldMap table by mapping ingredient names (field keys) to PurchasingItem records
 * This creates the bridge between Form 2 input fields and the purchasing master list
 */
export async function seedPurchasingMaps() {
  try {
    console.log('[SeedPurchasingMaps] Starting...');
    
    // Get all purchasing items
    const purchasingItems = await prisma.purchasingItem.findMany();
    
    if (purchasingItems.length === 0) {
      console.log('[SeedPurchasingMaps] No purchasing items found. Skipping mapping.');
      return;
    }

    console.log(`[SeedPurchasingMaps] Found ${purchasingItems.length} purchasing items`);

    // Create a map of item names to IDs for easier matching
    const itemNameMap = new Map<string, number>();
    for (const item of purchasingItems) {
      // Normalize item name for matching (lowercase, trim spaces)
      const normalizedName = item.item.toLowerCase().trim();
      itemNameMap.set(normalizedName, item.id);
    }

    // Get existing mappings to avoid duplicates
    const existingMaps = await prisma.purchasingFieldMap.findMany();
    const existingFieldKeys = new Set(existingMaps.map(m => m.fieldKey));

    console.log(`[SeedPurchasingMaps] Found ${existingMaps.length} existing mappings`);

    // Create mappings for each purchasing item using item name as fieldKey
    const mappingsToCreate = [];
    
    for (const item of purchasingItems) {
      // Use the item name as the fieldKey (this matches what Form 2 uses for quantities)
      const fieldKey = item.item;
      
      // Skip if mapping already exists
      if (existingFieldKeys.has(fieldKey)) {
        continue;
      }

      mappingsToCreate.push({
        fieldKey: fieldKey,
        purchasingItemId: item.id,
      });
    }

    if (mappingsToCreate.length === 0) {
      console.log('[SeedPurchasingMaps] All items already mapped');
      return;
    }

    // Batch create mappings
    const result = await prisma.purchasingFieldMap.createMany({
      data: mappingsToCreate,
      skipDuplicates: true,
    });

    console.log(`[SeedPurchasingMaps] Created ${result.count} new field mappings`);
    console.log('[SeedPurchasingMaps] Completed successfully');

  } catch (error) {
    console.error('[SeedPurchasingMaps] Error:', error);
    throw error;
  }
}

// Run if executed directly (ESM compatible check)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPurchasingMaps()
    .then(() => {
      console.log('Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

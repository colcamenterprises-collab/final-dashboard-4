import { PrismaClient } from '@prisma/client';
import { foodCostings } from '../data/foodCostings';

const prisma = new PrismaClient();

interface ParsedPackaging {
  purchaseUnit: string;
  purchaseQty: number;
  portionUnit?: string;
  portionQty?: number;
}

/**
 * Parse packaging strings like:
 * - "Per kg" → { purchaseUnit: "kg", purchaseQty: 1 }
 * - "6 Cans" → { purchaseUnit: "can", purchaseQty: 6 }
 * - "12 x 330 ml" → { purchaseUnit: "ml", purchaseQty: 3960 }
 */
function parsePackaging(packagingQty: string, averageMenuPortion?: string): ParsedPackaging {
  const pkg = packagingQty.toLowerCase().trim();
  
  // Pattern: "Per kg" or "per unit"
  if (pkg.startsWith('per ')) {
    const unit = pkg.replace('per ', '').trim();
    return {
      purchaseUnit: unit,
      purchaseQty: 1,
    };
  }
  
  // Pattern: "6 Cans"
  const simpleMatch = pkg.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
  if (simpleMatch) {
    const qty = parseFloat(simpleMatch[1]);
    const unit = simpleMatch[2].trim().replace(/s$/, ''); // Remove plural 's'
    return {
      purchaseUnit: unit,
      purchaseQty: qty,
    };
  }
  
  // Pattern: "12 x 330 ml" (cases/packs)
  const caseMatch = pkg.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*([a-z]+)/);
  if (caseMatch) {
    const caseQty = parseInt(caseMatch[1]);
    const unitQty = parseFloat(caseMatch[2]);
    const unit = caseMatch[3];
    return {
      purchaseUnit: unit,
      purchaseQty: caseQty * unitQty,
    };
  }
  
  // Fallback: treat as pack
  return {
    purchaseUnit: 'pack',
    purchaseQty: 1,
  };
}

/**
 * Parse portion strings like "95 gr" → { portionUnit: "g", portionQty: 95 }
 */
function parsePortion(portion: string): { portionUnit: string; portionQty: number } | null {
  if (!portion || portion.toLowerCase() === 'each') return null;
  
  const match = portion.match(/(\d+(?:\.\d+)?)\s*([a-z]+)/i);
  if (match) {
    let qty = parseFloat(match[1]);
    let unit = match[2].toLowerCase();
    
    // Normalize units
    if (unit === 'gr') unit = 'g';
    
    return { portionUnit: unit, portionQty: qty };
  }
  
  return null;
}

/**
 * Parse cost string "฿319.00" → 319
 */
function parseCost(costStr: string): number {
  return parseFloat(costStr.replace(/[฿,]/g, ''));
}

/**
 * Parse review date "20.08.25" (DD.MM.YY) → Date or null
 */
function parseReviewDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  try {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = 2000 + parseInt(parts[2]); // 25 → 2025
    
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

async function backfillPurchasingData() {
  console.log('🔄 Starting purchasing data backfill...');
  console.log(`📦 Processing ${foodCostings.length} items from foodCostings.ts\n`);
  
  let updated = 0;
  let created = 0;
  let skipped = 0;
  
  for (const item of foodCostings) {
    try {
      const packaging = parsePackaging(item.packagingQty, item.averageMenuPortion);
      const portion = parsePortion(item.averageMenuPortion || '');
      const packageCost = parseCost(item.cost);
      
      // Check if ingredient exists
      const existing = await prisma.ingredientV2.findFirst({
        where: { name: item.item },
      });
      
      const data = {
        name: item.item,
        supplier: item.supplier || null,
        category: item.category || null,
        brand: item.brand || null,
        purchaseUnit: packaging.purchaseUnit,
        purchaseQty: packaging.purchaseQty,
        packageCost: packageCost,
        portionUnit: portion?.portionUnit || null,
        portionQty: portion?.portionQty || null,
        lastReview: item.lastReviewDate ? parseReviewDate(item.lastReviewDate) : null,
        notes: null,
      };
      
      if (existing) {
        // Skip existing for now (avoid UTF-8 null byte issues)
        skipped++;
        console.log(`⏭️  Skipped existing: ${item.item}`);
      } else {
        // Create new ingredient
        await prisma.ingredientV2.create({
          data,
        });
        created++;
        console.log(`✨ Created: ${item.item} (${packaging.purchaseQty} ${packaging.purchaseUnit} @ ฿${packageCost})`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to process ${item.item}:`, error.message);
      skipped++;
    }
  }
  
  console.log('\n📊 Backfill Summary:');
  console.log(`   ✨ Created: ${created}`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❌ Skipped: ${skipped}`);
  console.log(`   📦 Total processed: ${foodCostings.length}`);
}

// Run backfill
backfillPurchasingData()
  .then(() => {
    console.log('\n✅ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });

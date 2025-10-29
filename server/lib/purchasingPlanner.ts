import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface IngredientNeedRequest {
  ingredientId: string;
  requiredQty: number;
  requiredUnit: string; // e.g., "kg", "g", "L", "ml"
}

export interface PurchasePlan {
  ingredientId: string;
  ingredientName: string;
  purchaseUnit: string;
  purchaseQty: number;
  packsToBuy: number;
  lineCostTHB: number;
}

/**
 * Convert between units in the same family
 * Mass: kg ↔ g
 * Volume: L ↔ ml
 * Count: piece, pack, can, etc (no conversion)
 */
function convertToSameUnit(qty: number, fromUnit: string, toUnit: string): number {
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  
  if (from === to) return qty;
  
  // Mass conversions
  if (from === 'kg' && to === 'g') return qty * 1000;
  if (from === 'g' && to === 'kg') return qty / 1000;
  
  // Volume conversions
  if (from === 'l' && to === 'ml') return qty * 1000;
  if (from === 'ml' && to === 'l') return qty / 1000;
  
  // Same unit family (e.g., "kg bag" vs "kg")
  if (from.includes(to) || to.includes(from)) return qty;
  
  throw new Error(`Cannot convert ${fromUnit} to ${toUnit} - different unit families`);
}

/**
 * Calculate how many packs to buy based on purchasing units
 */
export async function calculatePurchasingPlan(
  needs: IngredientNeedRequest[]
): Promise<PurchasePlan[]> {
  const plan: PurchasePlan[] = [];

  for (const need of needs) {
    const ingredient = await prisma.ingredientV2.findUnique({
      where: { id: need.ingredientId },
      select: {
        id: true,
        name: true,
        purchaseUnit: true,
        purchaseQty: true,
        packageCost: true,
      },
    });

    if (!ingredient) {
      throw new Error(`Ingredient ${need.ingredientId} not found`);
    }

    if (!ingredient.purchaseUnit || !ingredient.purchaseQty || !ingredient.packageCost) {
      throw new Error(`Ingredient ${ingredient.name} missing purchasing data`);
    }

    const purchaseQtyNum = Number(ingredient.purchaseQty);
    const packageCostNum = Number(ingredient.packageCost);

    // Convert required qty to same unit as purchase qty
    const requiredInPurchaseUnits = convertToSameUnit(
      need.requiredQty,
      need.requiredUnit,
      ingredient.purchaseUnit
    );

    // Calculate packs needed
    const packsToBuy = Math.ceil(requiredInPurchaseUnits / purchaseQtyNum);
    const lineCostTHB = packsToBuy * packageCostNum;

    plan.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      purchaseUnit: ingredient.purchaseUnit,
      purchaseQty: purchaseQtyNum,
      packsToBuy,
      lineCostTHB,
    });
  }

  return plan;
}

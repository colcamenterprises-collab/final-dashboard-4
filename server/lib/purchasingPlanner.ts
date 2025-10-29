import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface IngredientNeed {
  ingredientId: string;
  requiredQtyBase: number; // in base units (g, ml, etc)
}

export interface PurchasePlan {
  ingredientId: string;
  ingredientName: string;
  requiredQtyBase: number;
  purchaseUnit: string;
  purchaseQty: number;
  packsToBuy: number;
  lineCostTHB: number;
}

/**
 * Calculate how many packs to buy based on purchasing units (not portions)
 */
export async function calculatePurchasingPlan(
  needs: IngredientNeed[]
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

    // Calculate packs needed
    const packsToBuy = Math.ceil(need.requiredQtyBase / purchaseQtyNum);
    const lineCostTHB = packsToBuy * packageCostNum;

    plan.push({
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      requiredQtyBase: need.requiredQtyBase,
      purchaseUnit: ingredient.purchaseUnit,
      purchaseQty: purchaseQtyNum,
      packsToBuy,
      lineCostTHB,
    });
  }

  return plan;
}

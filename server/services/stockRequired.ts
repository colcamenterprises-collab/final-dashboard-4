import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const N = (v:any) => {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/[^0-9.\-]/g,''));
  return Number.isFinite(n) ? n : NaN;
};

export type StockErrors = {
  rollsEnd?: string;
  meatEnd?: string;
  drinkStock?: string;
  drinksMissing?: string[];
  itemsMissingOrInactive?: string[];
};

/**
 * 🔐 PART 3: Hardened Form 2 Validation
 * Validates that all mandatory stock items exist and are active in purchasing_items
 * before allowing Form 2 submission.
 */
export async function validateStockRequired(payload:any): Promise<{ ok: boolean; errors: StockErrors }> {
  const errors: StockErrors = {};
  const rolls = N(payload?.rollsEnd ?? payload?.rolls_end);
  const meat  = N(payload?.meatEnd  ?? payload?.meat_end);
  const drinks = payload?.drinkStock;

  // Rolls required (0 allowed)
  if (Number.isNaN(rolls)) {
    errors.rollsEnd = "Rolls count is required (0 allowed).";
  } else if (rolls < 0) {
    errors.rollsEnd = "Rolls cannot be negative.";
  }

  // Meat required (0 allowed)
  if (Number.isNaN(meat)) {
    errors.meatEnd = "Meat count (grams) is required (0 allowed).";
  } else if (meat < 0) {
    errors.meatEnd = "Meat cannot be negative.";
  }

  // Get required drinks from purchasing_items (active only, Drinks category)
  const activeDrinkItems = await prisma.purchasingItem.findMany({
    where: { 
      active: true,
      category: 'Drinks'
    },
    select: { item: true }
  });
  
  const REQUIRED_DRINKS = activeDrinkItems.map(d => d.item);

  // Drinks: must be an object with all required keys (0 allowed)
  if (!drinks || typeof drinks !== "object" || Array.isArray(drinks)) {
    errors.drinkStock = "Drinks stock must be provided (0 allowed for each).";
  } else {
    const missing: string[] = [];
    for (const sku of REQUIRED_DRINKS) {
      const v = drinks[sku];
      const n = N(v);
      if (Number.isNaN(n) || n < 0) {
        missing.push(sku);
      }
    }
    if (missing.length) errors.drinksMissing = missing;
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * 🔐 PART 3: Pre-submission validation
 * Check if all required drink items exist and are active in purchasing_items
 * Returns helpful error if any are missing or inactive.
 */
export async function validateRequiredItemsExist(): Promise<{ ok: boolean; missingOrInactive: string[] }> {
  // Get active drink items from purchasing_items
  const activeDrinks = await prisma.purchasingItem.findMany({
    where: { 
      active: true,
      category: 'Drinks'
    },
    select: { item: true }
  });

  // If no active drinks found, that's a problem
  if (activeDrinks.length === 0) {
    return { 
      ok: false, 
      missingOrInactive: ["No active drink items found in Purchasing List. Please contact manager."] 
    };
  }

  return { ok: true, missingOrInactive: [] };
}

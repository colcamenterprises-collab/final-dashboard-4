// server/lib/purchasingPlanner.ts
// Robust, pack-based purchasing math with strict unit families.
// Portions are NEVER used here.

import { db } from './prisma';
const prisma = db();

type Unit = 'kg'|'g'|'L'|'ml'|'each';
type Family = 'g'|'ml'|'each';

function toBase(unit: Unit, qty: number): { base: Family, value: number } {
  switch (unit) {
    case 'kg': return { base: 'g',  value: qty * 1000 };
    case 'g':  return { base: 'g',  value: qty };
    case 'L':  return { base: 'ml', value: qty * 1000 };
    case 'ml': return { base: 'ml', value: qty };
    case 'each': return { base: 'each', value: qty };
    default: return { base: 'each', value: qty };
  }
}

export type PurchasingNeedBase = {
  ingredientId: string;
  requiredQtyBase: number;    // already in base units (g/ml/each)
};

export type PurchasingNeedQty = {
  ingredientId: string;
  requiredQty: number;        // numeric
  requiredUnit: Unit;         // 'g','kg','ml','L','each'
};

export type PurchasingNeed = PurchasingNeedBase | PurchasingNeedQty;

export type PurchasingPlanLine = {
  ingredientId: string;
  name: string;
  supplier?: string | null;
  requiredQtyBase: number;  // normalized need in pack base family
  packBaseQty: number;      // pack size in base units (e.g., 1000 g, 3960 ml, 1 each)
  packsToBuy: number;       // ceil(required / packBaseQty)
  packageCostTHB: number;
  lineCostTHB: number;
  baseFamily: Family;
};

export async function buildPurchasingPlan(needs: PurchasingNeed[]): Promise<{
  lines: PurchasingPlanLine[];
  totalCostTHB: number;
}> {
  const ingIds = needs.map(n => n.ingredientId);
  const ingredients = await prisma.ingredientV2.findMany({
    where: { id: { in: ingIds } },
    select: { id: true, name: true, supplier: true, purchaseUnit: true, purchaseQty: true, packageCost: true }
  });

  const byId = new Map(ingredients.map(i => [i.id, i]));
  const lines: PurchasingPlanLine[] = [];

  for (const need of needs) {
    const ing = byId.get(need.ingredientId);
    if (!ing) throw new Error(`Ingredient not found: ${need.ingredientId}`);

    // Pack size in base units (family)
    const pack = toBase(ing.purchaseUnit as any, Number(ing.purchaseQty));
    if (!Number.isFinite(pack.value) || pack.value <= 0) {
      throw new Error(`Invalid pack size for ingredient: ${ing.name}`);
    }

    // Need → same base family as pack
    let requiredBase: number;
    if ('requiredQtyBase' in need) {
      requiredBase = Number(need.requiredQtyBase);
    } else if ('requiredQty' in need && 'requiredUnit' in need) {
      const conv = toBase(need.requiredUnit as any, Number(need.requiredQty));
      if (conv.base !== pack.base) {
        throw new Error(`Unit family mismatch for ${ing.name}: need ${conv.base}, pack ${pack.base}.`);
      }
      requiredBase = conv.value;
    } else {
      throw new Error('Invalid need: pass requiredQtyBase OR (requiredQty & requiredUnit).');
    }
    if (!Number.isFinite(requiredBase) || requiredBase < 0) {
      throw new Error(`Invalid required quantity for ${ing.name}.`);
    }

    const packsToBuy = Math.ceil(requiredBase / pack.value);
    const packageCostTHB = Number(ing.packageCost);
    const lineCostTHB = packsToBuy * packageCostTHB;

    lines.push({
      ingredientId: ing.id,
      name: ing.name,
      supplier: ing.supplier,
      requiredQtyBase: requiredBase,
      packBaseQty: pack.value,
      packsToBuy,
      packageCostTHB,
      lineCostTHB,
      baseFamily: pack.base,
    });
  }

  const totalCostTHB = lines.reduce((s, l) => s + l.lineCostTHB, 0);
  return { lines, totalCostTHB };
}

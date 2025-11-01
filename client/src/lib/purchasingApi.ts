export type NeedBase = { ingredientId: string; requiredQtyBase: number };
export type NeedQty = { ingredientId: string; requiredQty: number; requiredUnit: 'kg'|'g'|'L'|'ml'|'each' };
export type Need = NeedBase | NeedQty;

export type PurchasingPlanLine = {
  ingredientId: string;
  name: string;
  supplier?: string | null;
  requiredQtyBase: number;
  packBaseQty: number;
  packsToBuy: number;
  packageCostTHB: number;
  lineCostTHB: number;
  baseFamily: 'g'|'ml'|'each';
};

export async function getPurchasingPlan(needs: Need[]) {
  const res = await fetch('/api/purchasing/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ needs }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to build purchasing plan');
  }
  return res.json() as Promise<{ lines: PurchasingPlanLine[]; totalCostTHB: number }>;
}

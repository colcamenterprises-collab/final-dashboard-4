export type RecipeWorkflowIngredient = {
  name?: string;
  sourceType?: 'purchasing' | 'manual';
  purchasingItemId?: number | null;
  purchasingItemKey?: string | null;
  quantityUsed?: string | number | null;
  unitUsed?: string | null;
  purchaseCost?: string | number | null;
  packageQuantity?: string | number | null;
  purchaseUnit?: string | null;
  wastePercent?: string | number | null;
  autoUnitCost?: string | number | null;
  manualOverrideUnitCost?: string | number | null;
  costingStatus?: string | null;
  notes?: string | null;
};

export type RecipeWorkflowCalculation = {
  ingredients: RecipeWorkflowIngredient[];
  hasValidCostData: boolean;
  totalCost: string | null;
  costPerServing: string | null;
  directMarginPercent: string | null;
  deliveryPartnerMarginPercent: string | null;
  blockers: Array<{ code: string; message: string; where: string; canonical_source: string; auto_build_attempted: false }>;
};

export type RecipeLifecycleStatus = 'Draft' | 'Tested' | 'Approved' | 'Archived';

export function decimalOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function calculateRecipeWorkflow(input: { ingredients?: RecipeWorkflowIngredient[]; yieldQuantity?: unknown; sellingPrice?: unknown; suggestedPrice?: unknown }): RecipeWorkflowCalculation {
  const ingredients = Array.isArray(input.ingredients) ? input.ingredients : [];
  const blockers: RecipeWorkflowCalculation['blockers'] = [];
  const unit = (value: unknown) => String(value ?? '').trim().toLowerCase().replace('grams','g').replace('gram','g').replace('kilograms','kg').replace('kilogram','kg').replace('litres','l').replace('litre','l');
  const lineCosts = ingredients.map((ingredient, index) => {
    const used = numberOrNull(ingredient.quantityUsed);
    const waste = numberOrNull(ingredient.wastePercent) ?? 0;
    const purchaseCost = numberOrNull(ingredient.manualOverrideUnitCost) ?? numberOrNull(ingredient.purchaseCost);
    const packQuantity = numberOrNull(ingredient.packageQuantity);
    if (!ingredient.name || used === null || used <= 0 || !ingredient.unitUsed || waste < 0 || waste >= 100) {
      blockers.push({ code: 'INSUFFICIENT_INGREDIENT_DATA', message: `Ingredient row ${index + 1} requires a name, positive usage quantity, unit, and valid waste percentage.`, where: `recipeIngredients[${index}]`, canonical_source: 'recipes.ingredients', auto_build_attempted: false });
      return null;
    }
    // Backward compatible for historical recipes that stored a per-unit cost.
    if (purchaseCost === null) {
      const legacy = numberOrNull(ingredient.autoUnitCost);
      if (legacy === null || legacy < 0) { blockers.push({ code: 'MISSING_PURCHASE_COST', message: `Ingredient row ${index + 1} has no purchase cost.`, where: `recipeIngredients[${index}]`, canonical_source: 'purchasing_items', auto_build_attempted: false }); return null; }
      return (legacy * used) / (1 - waste / 100);
    }
    const from = unit(ingredient.unitUsed), to = unit(ingredient.purchaseUnit);
    const conversion = from === to || ((from === 'each' || from === 'pcs') && (to === 'each' || to === 'pcs')) ? 1 : from === 'g' && to === 'kg' ? 0.001 : from === 'kg' && to === 'g' ? 1000 : from === 'ml' && to === 'l' ? 0.001 : from === 'l' && to === 'ml' ? 1000 : null;
    if (purchaseCost < 0 || packQuantity === null || packQuantity <= 0 || conversion === null) {
      blockers.push({ code: 'INVALID_PURCHASING_PACK_DATA', message: `Ingredient row ${index + 1} needs a non-negative purchase cost, positive package quantity, and compatible units.`, where: `recipeIngredients[${index}]`, canonical_source: 'purchasing_items', auto_build_attempted: false });
      return null;
    }
    return (purchaseCost / packQuantity * (used * conversion)) / (1 - waste / 100);
  });
  const hasValidCostData = ingredients.length > 0 && blockers.length === 0;
  const total = hasValidCostData ? lineCosts.reduce<number>((sum, cost) => sum + (cost ?? 0), 0) : null;
  const yieldQty = numberOrNull(input.yieldQuantity) ?? 1;
  const costPerServing = total !== null && yieldQty > 0 ? total / yieldQty : null;
  const directPrice = numberOrNull(input.sellingPrice);
  const deliveryPrice = numberOrNull(input.suggestedPrice);
  return { ingredients, hasValidCostData, totalCost: total === null ? null : total.toFixed(2), costPerServing: costPerServing === null ? null : costPerServing.toFixed(2), directMarginPercent: directPrice !== null && directPrice > 0 && costPerServing !== null ? (((directPrice - costPerServing) / directPrice) * 100).toFixed(2) : null, deliveryPartnerMarginPercent: deliveryPrice !== null && deliveryPrice > 0 && costPerServing !== null ? (((deliveryPrice - costPerServing) / deliveryPrice) * 100).toFixed(2) : null, blockers };
}

export function recipeStatusFromBody(body: any): RecipeLifecycleStatus {
  const status = String(body?.status ?? '').trim();
  if (status === 'Tested' || status === 'Approved' || status === 'Archived') return status;
  if (status === 'Live') return 'Approved';
  return 'Draft';
}

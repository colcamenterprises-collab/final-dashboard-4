export type RecipeWorkflowIngredient = {
  name?: string;
  sourceType?: 'purchasing' | 'manual';
  purchasingItemId?: number | null;
  purchasingItemKey?: string | null;
  quantityUsed?: string | number | null;
  unitUsed?: string | null;
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
  const lineCosts = ingredients.map((ingredient, index) => {
    const qty = numberOrNull(ingredient.quantityUsed);
    const manualCost = numberOrNull(ingredient.manualOverrideUnitCost);
    const autoCost = numberOrNull(ingredient.autoUnitCost);
    const unitCost = manualCost ?? autoCost;
    const isMapped = ingredient.sourceType === 'purchasing' && numberOrNull(ingredient.purchasingItemId) !== null;
    if (!ingredient.name || qty === null || unitCost === null || !isMapped) {
      blockers.push({ code: 'INSUFFICIENT_INGREDIENT_DATA', message: `Ingredient row ${index + 1} is missing mapped purchasing item, quantity, or unit cost.`, where: `recipeIngredients[${index}]`, canonical_source: 'purchasing_items', auto_build_attempted: false });
      return null;
    }
    return qty * unitCost;
  });
  const hasValidCostData = ingredients.length > 0 && blockers.length === 0;
  const total = hasValidCostData ? lineCosts.reduce<number>((sum, cost) => sum + (cost ?? 0), 0) : null;
  const yieldQty = numberOrNull(input.yieldQuantity) ?? 1;
  const costPerServing = total !== null && yieldQty > 0 ? total / yieldQty : null;
  const directPrice = numberOrNull(input.sellingPrice);
  const deliveryPrice = numberOrNull(input.suggestedPrice);
  return {
    ingredients,
    hasValidCostData,
    totalCost: total === null ? null : total.toFixed(2),
    costPerServing: costPerServing === null ? null : costPerServing.toFixed(2),
    directMarginPercent: directPrice !== null && costPerServing !== null ? (((directPrice - costPerServing) / directPrice) * 100).toFixed(2) : null,
    deliveryPartnerMarginPercent: deliveryPrice !== null && costPerServing !== null ? (((deliveryPrice - costPerServing) / deliveryPrice) * 100).toFixed(2) : null,
    blockers,
  };
}

export function recipeStatusFromBody(body: any): 'Draft' | 'Live' | 'Archived' {
  if (body?.status === 'Live' || body?.status === 'Archived') return body.status;
  if (body?.isActive === true) return 'Live';
  return 'Draft';
}

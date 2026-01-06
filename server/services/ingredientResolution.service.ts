/**
 * Ingredient Resolution Service
 * 
 * Handles applying modifier deltas to base recipe ingredients.
 * Modifiers only ADD to ingredients - they never edit recipes directly.
 */

export type BaseIngredient = {
  purchasingItemId: string;
  qty: number;
  unit: string;
};

export type ModifierDelta = {
  purchasingItemId: string;
  deltaQty: number;
  deltaUnit: string;
};

/**
 * Applies modifier deltas to base ingredients from a recipe.
 * 
 * Rules:
 * - If ingredient exists, add to its quantity (units must match)
 * - If ingredient doesn't exist, add as new item
 * - Throws if units mismatch
 * 
 * @param baseIngredients - Base recipe ingredients
 * @param modifierDeltas - Modifier ingredient deltas to apply
 * @returns Combined ingredient list with deltas applied
 */
export function applyModifierDeltas(
  baseIngredients: BaseIngredient[],
  modifierDeltas: ModifierDelta[]
): BaseIngredient[] {
  const result = [...baseIngredients.map(i => ({ ...i }))];

  for (const delta of modifierDeltas) {
    const existing = result.find(
      (r) => r.purchasingItemId === delta.purchasingItemId
    );

    if (!existing) {
      result.push({
        purchasingItemId: delta.purchasingItemId,
        qty: Number(delta.deltaQty),
        unit: delta.deltaUnit,
      });
    } else {
      if (existing.unit !== delta.deltaUnit) {
        throw new Error(
          `Modifier unit mismatch: expected ${existing.unit}, got ${delta.deltaUnit} for item ${delta.purchasingItemId}`
        );
      }
      existing.qty += Number(delta.deltaQty);
    }
  }

  return result;
}

/**
 * Calculate total ingredient usage for an order item with modifiers.
 * 
 * @param recipeIngredients - Ingredients from the base recipe
 * @param selectedModifiers - Array of selected modifier deltas
 * @returns Final ingredient list with all modifiers applied
 */
export function resolveOrderIngredients(
  recipeIngredients: BaseIngredient[],
  selectedModifiers: { modifierId: string; deltas: ModifierDelta[] }[]
): BaseIngredient[] {
  let result = [...recipeIngredients.map(i => ({ ...i }))];

  for (const mod of selectedModifiers) {
    result = applyModifierDeltas(result, mod.deltas);
  }

  return result;
}

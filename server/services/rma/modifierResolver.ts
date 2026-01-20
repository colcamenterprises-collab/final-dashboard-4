export type ModifierOptionType = 'ADD' | 'REMOVE' | 'MULTIPLY' | 'SWAP' | 'ZERO';

export type BaseIngredient = {
  ingredientId: number;
  qty: number;
  unit: string;
};

export type ModifierEffect = {
  ingredientId: number;
  qtyDelta: number;
  unit: string;
  type: ModifierOptionType;
};

export type ModifierResolution = {
  ingredients: BaseIngredient[];
  missingBaseIngredients: number[];
};

export class ModifierResolver {
  resolve(baseIngredients: BaseIngredient[], effects: ModifierEffect[]): ModifierResolution {
    const baseMap = new Map<number, BaseIngredient>();
    const missingBaseIngredients = new Set<number>();

    for (const ingredient of baseIngredients) {
      baseMap.set(ingredient.ingredientId, { ...ingredient });
    }

    for (const effect of effects) {
      const existing = baseMap.get(effect.ingredientId);

      if (!existing && effect.type === 'REMOVE') {
        missingBaseIngredients.add(effect.ingredientId);
        continue;
      }

      if (!existing && effect.type === 'MULTIPLY') {
        missingBaseIngredients.add(effect.ingredientId);
        continue;
      }

      if (!existing && effect.type === 'ZERO') {
        missingBaseIngredients.add(effect.ingredientId);
        continue;
      }

      if (!existing) {
        baseMap.set(effect.ingredientId, {
          ingredientId: effect.ingredientId,
          qty: 0,
          unit: effect.unit,
        });
      }

      const target = baseMap.get(effect.ingredientId)!;

      if (effect.type === 'ZERO') {
        target.qty = 0;
        continue;
      }

      if (effect.type === 'MULTIPLY') {
        target.qty *= effect.qtyDelta;
        continue;
      }

      const delta = effect.type === 'REMOVE' ? -effect.qtyDelta : effect.qtyDelta;
      target.qty += delta;
    }

    return {
      ingredients: Array.from(baseMap.values()),
      missingBaseIngredients: Array.from(missingBaseIngredients.values()),
    };
  }
}

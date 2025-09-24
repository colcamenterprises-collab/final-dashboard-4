export type Recipe = { key: string; ingredients: Record<string, number> }; // grams or units
export type ModDelta = { name: string; delta: Record<string, number> };

// Smash Brothers Burgers menu recipes based on actual Loyverse data
export const RECIPES: Recipe[] = [
  { key: 'SINGLE_SMASH', ingredients: { bun: 1, patty_grams: 95, cheese_grams: 20, sauce_grams: 20 } },
  { key: 'DOUBLE_SMASH', ingredients: { bun: 1, patty_grams: 190, cheese_grams: 40, sauce_grams: 25 } },
  { key: 'TRIPLE_SMASH', ingredients: { bun: 1, patty_grams: 285, cheese_grams: 60, sauce_grams: 30 } },
  { key: 'CRISPY_CHICKEN', ingredients: { bun: 1, chicken_grams: 120, sauce_grams: 20 } },
  { key: 'SUPER_DOUBLE_BACON', ingredients: { bun: 1, patty_grams: 190, cheese_grams: 40, bacon_grams: 30, sauce_grams: 25 } },
  { key: 'ULTIMATE_DOUBLE', ingredients: { bun: 1, patty_grams: 190, cheese_grams: 40, sauce_grams: 30 } },
];

export const MODIFIERS: ModDelta[] = [
  { name: 'Extra Patty',  delta: { patty_grams: +95 } },
  { name: 'No Cheese',    delta: { cheese_grams: -20 } },
  { name: 'Large Fries',  delta: { fries_grams: +75 } },
  { name: 'Extra Cheese', delta: { cheese_grams: +20 } },
  { name: 'Extra Bacon',  delta: { bacon_grams: +15 } },
];

// map sku/name to a recipe key based on actual Loyverse data
export function mapItemKey(name: string, sku?: string) {
  const k = (sku || name).toUpperCase();
  
  // Match exact SKUs first
  if (sku) {
    switch (sku) {
      case '10019': return 'SUPER_DOUBLE_BACON'; // Super Double Bacon and Cheese
      case '10066': return 'CRISPY_CHICKEN'; // Crispy Chicken Fillet Burger
      case '10006': return 'ULTIMATE_DOUBLE'; // Ultimate Double
      case '10004': return 'SINGLE_SMASH'; // Single Smash Burger
      case '10009': return 'TRIPLE_SMASH'; // Triple Smash Burger
      case '10036': return 'SUPER_DOUBLE_BACON'; // Super Double Bacon & Cheese Set
      case '10032': return 'ULTIMATE_DOUBLE'; // Double Set (Meal Deal)
      case '10033': return 'SINGLE_SMASH'; // Single Meal Set (Meal Deal)
      case '10069': return 'SINGLE_SMASH'; // Mix and Match Meal Deal (default to single)
      case '10003': return 'SINGLE_SMASH'; // Kids Single Meal Set
    }
  }
  
  // Fallback to name matching
  if (k.includes('SUPER') && k.includes('DOUBLE') && k.includes('BACON')) return 'SUPER_DOUBLE_BACON';
  if (k.includes('CRISPY') && k.includes('CHICKEN')) return 'CRISPY_CHICKEN';
  if (k.includes('ULTIMATE') && k.includes('DOUBLE')) return 'ULTIMATE_DOUBLE';
  if (k.includes('TRIPLE')) return 'TRIPLE_SMASH';
  if (k.includes('SINGLE')) return 'SINGLE_SMASH';
  if (k.includes('DOUBLE')) return 'DOUBLE_SMASH';
  
  return 'UNKNOWN';
}
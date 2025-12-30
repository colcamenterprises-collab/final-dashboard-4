export const INGREDIENT_CATEGORIES = [
  'Fresh Food',
  'Frozen Food',
  'Shelf Stock',
  'Drinks',
  'Kitchen Supplies',
  'Packaging',
  'Stock Items',
  'Shelf Items',
  'Kitchen Items',
  'Packaging Items',
  'Other'
] as const;

export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

export const COMMON_UNITS = [
  'grams', 'kilograms', 'pieces', 'each', 'units', 'liters', 'milliliters',
  'oz', 'lb', 'cups', 'tablespoons', 'teaspoons', 'slices', 'portions'
] as const;

export type CommonUnit = typeof COMMON_UNITS[number];

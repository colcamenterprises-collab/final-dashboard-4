export const CANONICAL_PURCHASING_CATEGORIES = [
  'Fresh Food',
  'Frozen Food',
  'Shelf Items',
  'Drinks',
  'Meat',
  'Packaging',
  'Kitchen Supplies',
] as const;

export type CanonicalPurchasingCategory = (typeof CANONICAL_PURCHASING_CATEGORIES)[number];

const NORMALIZED_CATEGORY_MAP: Record<string, CanonicalPurchasingCategory> = {
  freshfood: 'Fresh Food',
  freshfoods: 'Fresh Food',
  freshitems: 'Fresh Food',
  freshitem: 'Fresh Food',
  fresh: 'Fresh Food',
  vegetables: 'Fresh Food',
  dairy: 'Fresh Food',
  bread: 'Fresh Food',
  frozenfood: 'Frozen Food',
  frozenfoods: 'Frozen Food',
  frozenitems: 'Frozen Food',
  frozenitem: 'Frozen Food',
  frozen: 'Frozen Food',
  chicken: 'Frozen Food',
  shelfitems: 'Shelf Items',
  shelfitem: 'Shelf Items',
  shelf: 'Shelf Items',
  sauces: 'Shelf Items',
  sauce: 'Shelf Items',
  seasonings: 'Shelf Items',
  seasoning: 'Shelf Items',
  drinks: 'Drinks',
  drink: 'Drinks',
  beverage: 'Drinks',
  beverages: 'Drinks',
  meat: 'Meat',
  meats: 'Meat',
  packaging: 'Packaging',
  kitchensupplies: 'Kitchen Supplies',
  kitchensupply: 'Kitchen Supplies',
  kitchenitems: 'Kitchen Supplies',
  kitchenitem: 'Kitchen Supplies',
  kitchen: 'Kitchen Supplies',
};

const canonicalSet = new Set<string>(CANONICAL_PURCHASING_CATEGORIES);

export function normalizePurchasingCategory(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (canonicalSet.has(trimmed)) return trimmed;

  const normalizedKey = trimmed.toLowerCase().replace(/[^a-z]/g, '');
  return NORMALIZED_CATEGORY_MAP[normalizedKey] ?? trimmed;
}

export function isCanonicalPurchasingCategory(input: string | null | undefined): input is CanonicalPurchasingCategory {
  if (!input) return false;
  return canonicalSet.has(input);
}

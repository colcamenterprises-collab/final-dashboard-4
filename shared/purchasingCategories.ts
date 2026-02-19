export const CANONICAL_PURCHASING_CATEGORIES = [
  'Drinks',
  'Fresh Food',
  'Shelf Items',
  'Frozen Items',
  'Packaging',
  'Kitchen Items',
] as const;

export type CanonicalPurchasingCategory = (typeof CANONICAL_PURCHASING_CATEGORIES)[number];

const NORMALIZED_CATEGORY_MAP: Record<string, CanonicalPurchasingCategory> = {
  drinks: 'Drinks',
  drink: 'Drinks',
  freshfood: 'Fresh Food',
  freshfoods: 'Fresh Food',
  fresh: 'Fresh Food',
  shelfitems: 'Shelf Items',
  shelfitem: 'Shelf Items',
  shelf: 'Shelf Items',
  frozenitems: 'Frozen Items',
  frozenitem: 'Frozen Items',
  frozenfood: 'Frozen Items',
  frozenfoods: 'Frozen Items',
  frozen: 'Frozen Items',
  packaging: 'Packaging',
  kitchenitems: 'Kitchen Items',
  kitchenitem: 'Kitchen Items',
  kitchensupplies: 'Kitchen Items',
  kitchen: 'Kitchen Items',
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

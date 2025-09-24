export interface BurgerDef {
  handle: string;          // Loyverse handle
  sku: string;             // optional, may use for quick matching
  meatQty: number;         // how many beef patties (0 for chicken)
}

// NOTE: bunQty is always 1, we don't store it.
export const BURGER_DEFS: BurgerDef[] = [
  { handle: "mix-and-match-meal-deal", sku: "10069", meatQty: 3 },
  { handle: "promo-burger\"-triple-decker-super-bacon-and-cheese.", sku: "10008", meatQty: 3 },
  { handle: "kids-double-cheeseburger", sku: "10017", meatQty: 2 },
  { handle: "kids-single-cheeseburger", sku: "10015", meatQty: 1 },
  { handle: "kids-meal-set-(burger-fries-drink)", sku: "10003", meatQty: 1 },
  { handle: "double-set-(meal-deal)", sku: "10032", meatQty: 2 },
  { handle: "single-meal-set-(meal-deal)", sku: "10033", meatQty: 1 },
  { handle: "super-double-bacon-&-cheese-set-(meal-deal)", sku: "10036", meatQty: 2 },
  { handle: "triple-smash-set-(meal-deal)", sku: "10034", meatQty: 3 },
  { handle: "single-smash-burger", sku: "10004", meatQty: 1 },
  { handle: "super-double-bacon-and-cheese", sku: "10019", meatQty: 2 },
  { handle: "super-single-bacon-&-cheese", sku: "10038", meatQty: 1 },
  { handle: "triple-smash-burger", sku: "10009", meatQty: 3 },
  { handle: "ultimate-double", sku: "10006", meatQty: 2 },

  // CHICKEN section – meatQty = 0 (exclude from beef count)
  { handle: "chicken-fillet-burger-(เบอร์เกอร์ไก่ชิ้น)", sku: "10066", meatQty: 0 },
  { handle: "big-rooster-sriracha-chicken-ไก่ศรีราชาตัวใหญ่", sku: "10068", meatQty: 0 },
  { handle: "chipotle-chicken-burger", sku: "10037", meatQty: 0 },
];
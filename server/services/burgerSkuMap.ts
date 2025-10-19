export type BurgerRule =
  | { kind: "beef"; pattiesPer: number; rollsPer: number }
  | { kind: "chicken"; gramsPer: number; rollsPer: number };

export const BURGER_SKU_MAP: Record<string, BurgerRule> = {
  // Beef — base
  "10004": { kind: "beef", pattiesPer: 1, rollsPer: 1 }, // Single Smash Burger (ซิงเกิ้ล)
  "10019": { kind: "beef", pattiesPer: 2, rollsPer: 1 }, // Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)
  "10009": { kind: "beef", pattiesPer: 3, rollsPer: 1 }, // Triple Smash Burger (สาม)
  "10006": { kind: "beef", pattiesPer: 2, rollsPer: 1 }, // Ultimate Double (คู่)

  // Beef — meal sets
  "10033": { kind: "beef", pattiesPer: 1, rollsPer: 1 }, // Single Meal Set (Meal Deal)
  "10032": { kind: "beef", pattiesPer: 2, rollsPer: 1 }, // Double Set (Meal Deal)
  "10036": { kind: "beef", pattiesPer: 2, rollsPer: 1 }, // Super Double Bacon & Cheese Set (Meal Deal)
  "10034": { kind: "beef", pattiesPer: 3, rollsPer: 1 }, // Triple Smash Set (Meal Deal)

  // Chicken — base (100 g each)
  "10066": { kind: "chicken", gramsPer: 100, rollsPer: 1 }, // Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)
  "10070": { kind: "chicken", gramsPer: 100, rollsPer: 1 }, // Karaage Chicken Burger
  "10068": { kind: "chicken", gramsPer: 100, rollsPer: 1 }, // Big Rooster Sriracha Chicken
  "10037": { kind: "chicken", gramsPer: 100, rollsPer: 1 }, // El Smasho Grande Chicken Burger

  // Chicken — meal deal
  "10071": { kind: "chicken", gramsPer: 100, rollsPer: 1 }, // Karaage Chicken Meal Deal

  // EXCLUDED composite:
  // "10069": Mix and Match Meal Deal  ← do NOT count (composite bundle)
};

export const NAME_BY_SKU: Record<string, string> = {
  "10004": "Single Smash Burger (ซิงเกิ้ล)",
  "10019": "Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)",
  "10009": "Triple Smash Burger (สาม)",
  "10006": "Ultimate Double (คู่)",
  "10033": "Single Meal Set (Meal Deal)",
  "10032": "Double Set (Meal Deal)",
  "10036": "Super Double Bacon & Cheese Set (Meal Deal)",
  "10034": "Triple Smash Set (Meal Deal)",
  "10066": "Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)",
  "10070": "Karaage Chicken Burger",
  "10068": "Big Rooster Sriracha Chicken",
  "10037": "El Smasho Grande Chicken Burger",
  "10071": "Karaage Chicken Meal Deal",
};

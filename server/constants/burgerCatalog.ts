// server/constants/burgerCatalog.ts
// Unified catalog for burger-line items (beef + chicken).
// Match EXACT POS names (case-insensitive compare done in service).

export type CatalogItem = {
  normalizedName: string;
  itemNames: string[];        // all raw POS names that should map here
  countsRoll: boolean;        // consumes one bun
  pattiesPerItem: number;     // beef patties (0 if chicken)
  gramsPerPatty: number;      // 95 for beef
  chickenGramsPerItem: number;// 100 for chicken burgers (0 if beef)
};

const BEEF_G_PER_PATTY = 95;
const CHICKEN_PER_BURGER = 100;

// ---- BEEF BURGERS (red meat grams counted) ----
const BEEF: CatalogItem[] = [
  {
    normalizedName: "Single Smash Burger",
    itemNames: [
      "Single Smash Burger (ซิงเกิ้ล)",
      "Single Smash Burger",
      "ซิงเกิ้ล",
      "Single Meal Set (Meal Deal)",           // set prints as burger line; still counts beef+roll
      "Kids Single Cheeseburger",
      "Kids Single Meal Set (Burger Fries Drink)",
      "Super Single Bacon & Cheese",
    ],
    countsRoll: true,
    pattiesPerItem: 1,
    gramsPerPatty: BEEF_G_PER_PATTY,
    chickenGramsPerItem: 0,
  },
  {
    normalizedName: "Ultimate Double",
    itemNames: [
      "Ultimate Double (คู่)",
      "คู่",
      "Double Set (Meal Deal)",                // meal deal variant
      "Kids Double Cheeseburger",
    ],
    countsRoll: true,
    pattiesPerItem: 2,
    gramsPerPatty: BEEF_G_PER_PATTY,
    chickenGramsPerItem: 0,
  },
  {
    normalizedName: "Super Double Bacon & Cheese",
    itemNames: [
      "Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)",
      "Super Double Bacon & Cheese",
      "Super Double Bacon & Cheese Set (Meal Deal)",
    ],
    countsRoll: true,
    pattiesPerItem: 2,
    gramsPerPatty: BEEF_G_PER_PATTY,
    chickenGramsPerItem: 0,
  },
  {
    normalizedName: "Triple Smash Burger",
    itemNames: [
      "Triple Smash Burger (สาม)",
      "Triple Smash Burger",
      "สาม",
      "Triple Smash Set (Meal Deal)",
    ],
    countsRoll: true,
    pattiesPerItem: 3,
    gramsPerPatty: BEEF_G_PER_PATTY,
    chickenGramsPerItem: 0,
  },
];

// ---- CHICKEN BURGERS (red meat grams = 0; chicken grams counted) ----
const CHICKEN: CatalogItem[] = [
  {
    normalizedName: "Crispy Chicken Fillet Burger",
    itemNames: [
      "Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)",
      "Crispy Chicken Fillet Burger",
      "เบอร์เกอร์ไก่ชิ้น",
    ],
    countsRoll: true,
    pattiesPerItem: 0,
    gramsPerPatty: 0,
    chickenGramsPerItem: CHICKEN_PER_BURGER,
  },
  {
    normalizedName: "Karaage Chicken Burger",
    itemNames: [
      "Karaage Chicken Burger",
      "Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ",
      "เบอร์เกอร์ไก่คาราอาเกะ",
    ],
    countsRoll: true,
    pattiesPerItem: 0,
    gramsPerPatty: 0,
    chickenGramsPerItem: CHICKEN_PER_BURGER,
  },
  {
    normalizedName: "Big Rooster Sriracha Chicken",
    itemNames: [
      "🐔 Big Rooster Sriracha Chicken ไก่ศรีราชาตัวใหญ่",
      "Big Rooster Sriracha Chicken",
      "ไก่ศรีราชาตัวใหญ่",
    ],
    countsRoll: true,
    pattiesPerItem: 0,
    gramsPerPatty: 0,
    chickenGramsPerItem: CHICKEN_PER_BURGER,
  },
  {
    normalizedName: "El Smasho Grande Chicken Burger",
    itemNames: [
      "🐔 El Smasho Grande Chicken Burger (แกรนด์ชิกเก้น)",
      "El Smasho Grande Chicken Burger",
      "แกรนด์ชิกเก้น",
    ],
    countsRoll: true,
    pattiesPerItem: 0,
    gramsPerPatty: 0,
    chickenGramsPerItem: CHICKEN_PER_BURGER,
  },
];

export const CATALOG: CatalogItem[] = [...BEEF, ...CHICKEN];

// For quick case-insensitive lookups:
export const ALL_ITEM_NAME_VARIANTS = CATALOG.flatMap(c =>
  c.itemNames.map(n => n.toLowerCase().trim())
);

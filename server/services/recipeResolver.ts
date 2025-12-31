/**
 * 🔒 CANONICAL RECIPE RESOLVER
 * ---------------------------
 * Single source of truth for POS → Recipe mapping
 * 
 * RULES:
 * - DO NOT auto-fuzzy-match
 * - DO NOT infer quantities here
 * - POS naming mismatches are surfaced, not hidden
 */

export const RECIPE_MAP: Record<string, string> = {
  // Burgers
  "Single Smash Burger": "Single Smash Burger",
  "Double Smash Burger": "Double Smash Burger",
  "Triple Smash Burger": "Triple Smash Burger",
  "Chicken Fillet Burger": "Chicken Fillet Burger",
  "El-Smasho Chicken Burger": "El-Smasho Chicken Burger",
  "Karaage Chicken Burger": "Karaage Chicken Burger",
  "Crispy Chicken Fillet Burger": "Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)",
  "Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)": "Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)",
  
  // Sides
  "Loaded Fries": "Loaded Fries",
  "Dirty Fries": "Dirty Fries (เดอร์ตี้ เฟรนช์ฟรายส์)",
  "Dirty Fries (เดอร์ตี้ เฟรนช์ฟรายส์)": "Dirty Fries (เดอร์ตี้ เฟรนช์ฟรายส์)",
  "Cheesy Bacon Fries": "Cheesy Bacon Fries",
  "Cajun Fries": "Cajun Fries",
  "Chicken Nuggets": "Chicken Nuggets",
  "Coleslaw with Bacon": "Coleslaw with Bacon",
  
  // Drinks
  "Coke Can": "Coke Can",
  "Coke Zero": "Coke Zero",
  "Bottle Water": "Bottle Water",
  "Sprite Can": "Sprite Can",
  "Schweppes Manao Soda": "Schweppes Manao Soda",
  "Singha Soda Water": "Singha Soda Water",
  "Singha Water": "Singha Water",
  
  // Meal Deals
  "Double Set (Meal Deal)": "Double Set (Meal Deal)",
  "Set Meal (แถมน้ำ+เฟรนช์ฟราย)": "Set Meal (แถมน้ำ+เฟรนช์ฟราย)",
  "Single Set (แถมน้ำ+เฟรนช์ฟราย)": "Single Set (แถมน้ำ+เฟรนช์ฟราย)",
  "Triple Set (แถมน้ำ+เฟรนช์ฟราย)": "Triple Set (แถมน้ำ+เฟรนช์ฟราย)",
};

/**
 * Resolves a POS item name to its canonical recipe name.
 * Returns null if no mapping exists.
 */
export function resolveRecipeName(posItemName: string): string | null {
  return RECIPE_MAP[posItemName] || null;
}

/**
 * Returns list of unmapped POS item names (for debugging/reporting)
 */
export function getUnmappedItems(posItemNames: string[]): string[] {
  return posItemNames.filter(name => !RECIPE_MAP[name]);
}

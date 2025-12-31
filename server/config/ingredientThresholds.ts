/**
 * 🔒 VARIANCE THRESHOLDS — SINGLE SOURCE
 * 
 * Explicit thresholds for ingredient variance detection.
 * Add more as needed — do not infer automatically.
 */

export type ThresholdConfig = {
  unit: string;
  warning: number;
  critical: number;
};

export const INGREDIENT_THRESHOLDS: Record<string, ThresholdConfig> = {
  // Bread & Buns
  "Burger Bun": { unit: "unit", warning: 5, critical: 10 },
  "Brioche Bun": { unit: "unit", warning: 5, critical: 10 },
  
  // Proteins
  "Beef Patty": { unit: "g", warning: 500, critical: 1000 },
  "Chicken Fillet": { unit: "g", warning: 300, critical: 600 },
  "Bacon": { unit: "g", warning: 200, critical: 400 },
  
  // Dairy
  "Cheese": { unit: "slice", warning: 5, critical: 10 },
  "American Cheese": { unit: "slice", warning: 5, critical: 10 },
  "Cheddar": { unit: "g", warning: 100, critical: 200 },
  
  // Sauces
  "Mayonnaise": { unit: "g", warning: 300, critical: 600 },
  "Tomato Sauce": { unit: "g", warning: 300, critical: 600 },
  "BBQ Sauce": { unit: "g", warning: 200, critical: 400 },
  "Smash Sauce": { unit: "g", warning: 200, critical: 400 },
  
  // Vegetables
  "Lettuce": { unit: "g", warning: 200, critical: 400 },
  "Tomato": { unit: "g", warning: 200, critical: 400 },
  "Onion": { unit: "g", warning: 150, critical: 300 },
  "Pickles": { unit: "g", warning: 100, critical: 200 },
  
  // Fries & Sides
  "Frozen Fries": { unit: "kg", warning: 2, critical: 5 },
  "Cajun Seasoning": { unit: "g", warning: 50, critical: 100 },
};

/**
 * Get threshold config for an ingredient.
 * Returns null if no threshold is configured.
 */
export function getThreshold(ingredient: string): ThresholdConfig | null {
  return INGREDIENT_THRESHOLDS[ingredient] || null;
}

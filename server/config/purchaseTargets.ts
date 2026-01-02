// PATCH 15 — Rule-Based Purchase Targets
// These are the TARGET quantities needed at the START of each shift
// System calculates: target - current_stock = purchase_needed

export const PURCHASE_TARGETS = {
  MEAT_KG_PER_SHIFT: 16,      // 16kg of topside beef needed per shift
  ROLLS_PER_SHIFT: 140,       // 140 burger rolls needed per shift
};

// Purchasing item IDs (from purchasing_items table)
export const SYSTEM_PURCHASE_ITEM_IDS = {
  TOPSIDE_BEEF: 6,            // id=6, Topside Beef, Makro, 319 THB/kg
  BURGER_ROLLS: 25,           // id=25, Burger Bun, Bakery, 8 THB each
};


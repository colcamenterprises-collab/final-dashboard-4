import fs from "node:fs";
import path from "node:path";

const cfgPath = path.resolve("server/config/drinks.json");
let REQUIRED_DRINKS: string[] = [];
try {
  REQUIRED_DRINKS = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
} catch {
  REQUIRED_DRINKS = ["Coke (330ml)", "Sprite"]; // fallback
}

const N = (v:any) => {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/[^0-9.\-]/g,''));
  return Number.isFinite(n) ? n : NaN;
};

export type StockErrors = {
  rollsEnd?: string;
  meatEnd?: string;
  drinkStock?: string;
  drinksMissing?: string[];
};

export function validateStockRequired(payload:any): { ok: boolean; errors: StockErrors } {
  const errors: StockErrors = {};
  const rolls = N(payload?.rollsEnd ?? payload?.rolls_end);
  const meat  = N(payload?.meatEnd  ?? payload?.meat_end);
  const drinks = payload?.drinkStock;

  // Rolls required (0 allowed)
  if (Number.isNaN(rolls)) {
    errors.rollsEnd = "Rolls count is required (0 allowed).";
  } else if (rolls < 0) {
    errors.rollsEnd = "Rolls cannot be negative.";
  }

  // Meat required (0 allowed)
  if (Number.isNaN(meat)) {
    errors.meatEnd = "Meat count (grams) is required (0 allowed).";
  } else if (meat < 0) {
    errors.meatEnd = "Meat cannot be negative.";
  }

  // Drinks: must be an object with all required keys (0 allowed)
  if (!drinks || typeof drinks !== "object" || Array.isArray(drinks)) {
    errors.drinkStock = "Drinks stock must be provided (0 allowed for each).";
  } else {
    const missing: string[] = [];
    for (const sku of REQUIRED_DRINKS) {
      const v = drinks[sku];
      const n = N(v);
      if (Number.isNaN(n) || n < 0) {
        missing.push(sku);
      }
    }
    if (missing.length) errors.drinksMissing = missing;
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

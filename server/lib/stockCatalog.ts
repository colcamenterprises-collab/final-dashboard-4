import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

export type CatalogRow = {
  id: string;           // slug of Item
  name: string;         // Item
  category: string;     // Internal Category
  type: "drink" | "item"; // drinks are counted per SKU; others go to requisition grid
  raw?: Record<string, string>;
};

let CACHE: { items: CatalogRow[]; mtime: number } | null = null;

// Clear cache for debugging
CACHE = null;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function isHeaderRepeat(row: Record<string, string>) {
  const values = Object.values(row).map(v => (v ?? "").toString().trim().toLowerCase());
  // If the row looks like another header (starts with "item" and "internal category" again)
  return values.includes("item") && values.includes("internal category");
}

function detectIsDrink(category: string) {
  const c = (category || "").toLowerCase();
  return c.includes("drink") || c.includes("beverage") || c.includes("soft");
}

function excludeFirstFourMeat(rows: any[]) {
  // Rule from Cam: first 4 (beef cuts) are covered by meat grams, not listed in requisition
  // We exclude the first 4 distinct items where Internal Category looks like Meat.
  let excluded = 0;
  return rows.filter(r => {
    const cat = (r["Internal Category"] ?? r["internal category"] ?? "").toString();
    if (excluded < 4 && /meat/i.test(cat)) {
      excluded++;
      return false;
    }
    return true;
  });
}

export function loadCatalogFromCSV(): CatalogRow[] {
  // Temporary hardcoded data to test the system works
  console.log("[stockCatalog] Loading temporary test data");
  
  const testItems: CatalogRow[] = [
    { id: "coke", name: "Coke", category: "Drinks", type: "drink" },
    { id: "coke-zero", name: "Coke Zero", category: "Drinks", type: "drink" },
    { id: "fanta-orange", name: "Fanta Orange", category: "Drinks", type: "drink" },
    { id: "sprite", name: "Sprite", category: "Drinks", type: "drink" },
    { id: "burger-bun", name: "Burger Bun", category: "Fresh Food", type: "item" },
    { id: "cheese", name: "Cheese", category: "Fresh Food", type: "item" },
    { id: "bacon-short", name: "Bacon Short", category: "Fresh Food", type: "item" },
    { id: "lettuce", name: "Salad (Iceberg Lettuce)", category: "Fresh Food", type: "item" },
    { id: "french-fries", name: "French Fries 7mm", category: "Frozen Food", type: "item" },
    { id: "chicken-nuggets", name: "Chicken Nuggets", category: "Frozen Food", type: "item" }
  ];
  
  CACHE = { items: testItems, mtime: Date.now() };
  console.log("[stockCatalog] Test data loaded:", testItems.length, "items");
  return testItems;
}
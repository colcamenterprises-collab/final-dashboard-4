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
  try {
    const csvPath = path.join(process.cwd(), "attached_assets", "Food Costings - Supplier - Portions - Prices v2.1 20.08.25_1755715627430.csv");
    
    if (!fs.existsSync(csvPath)) {
      console.warn("[stockCatalog] CSV file not found, using fallback test data");
      return getFallbackData();
    }

    const stat = fs.statSync(csvPath);
    
    // Use cache if file hasn't changed
    if (CACHE && CACHE.mtime >= stat.mtimeMs) {
      console.log("[stockCatalog] Using cached data");
      return CACHE.items;
    }

    console.log("[stockCatalog] Loading from CSV:", csvPath);
    const csvContent = fs.readFileSync(csvPath, "utf8");
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    // Filter out rows with missing Item names and header repeats
    const cleanRows = records.filter((row: any) => {
      const item = (row["Item"] || "").toString().trim();
      if (!item || item.toLowerCase() === "item") return false;
      if (isHeaderRepeat(row)) return false;
      return true;
    });

    // Apply business rule: exclude first 4 meat items
    const filteredRows = excludeFirstFourMeat(cleanRows);

    const items: CatalogRow[] = filteredRows.map((row: any) => {
      const item = (row["Item"] || "").toString().trim();
      const category = (row["Internal Category"] || "").toString().trim();
      
      return {
        id: slugify(item),
        name: item,
        category: category,
        type: detectIsDrink(category) ? "drink" : "item",
        raw: row
      };
    });

    CACHE = { items, mtime: stat.mtimeMs };
    console.log(`[stockCatalog] Loaded ${items.length} items from CSV`);
    
    // Log category summary
    const categoryCount = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log("[stockCatalog] Categories:", Object.entries(categoryCount).map(([cat, count]) => `${cat}: ${count}`).join(", "));
    
    return items;
  } catch (error) {
    console.error("[stockCatalog] Error loading CSV:", error);
    return getFallbackData();
  }
}

function getFallbackData(): CatalogRow[] {
  console.log("[stockCatalog] Using fallback test data");
  
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
  
  return testItems;
}
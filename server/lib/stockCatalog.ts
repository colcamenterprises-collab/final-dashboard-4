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

export function loadCatalogFromCSV() {
  const csvPath = process.env.STOCK_CSV_PATH || path.resolve(process.cwd(), "attached_assets/Food Costings - Supplier List - Portions - Final Prices Makro FINAL 06.08.25_1755534140900.csv");
  const stat = fs.statSync(csvPath);
  if (CACHE && CACHE.mtime === stat.mtimeMs) return CACHE.items;

  const raw = fs.readFileSync(csvPath, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  // Clean & normalize headers/rows
  const clean = rows
    .filter((r: any) => Object.values(r).some((v: any) => (v ?? "").toString().trim() !== ""))
    .filter((r: any) => !isHeaderRepeat(r))
    .map((r: any) => {
      const obj: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) obj[(k as string).trim()] = (v as string ?? "").trim();
      return obj;
    });

  const pruned = excludeFirstFourMeat(clean);

  const items: CatalogRow[] = pruned.map((r: any) => {
    const name = r["Item"] || r["item"] || r["Name"] || r["name"] || "";
    const category = r["Internal Category"] || r["internal category"] || r["Category"] || r["category"] || "General";
    const id = slugify(name || category + Math.random());
    const type: "drink" | "item" = detectIsDrink(category) ? "drink" : "item";
    return { id, name, category, type, raw: r };
  }).filter(r => r.name);

  CACHE = { items, mtime: stat.mtimeMs };
  return items;
}
// PATCH 5 — MENU CANONICAL INJECTION (READ-ONLY)
// Loads Loyverse CSV as canonical menu reference for drift detection

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { db } from "../lib/prisma";

interface CanonicalMenuItem {
  name: string;
  sku: string;
  category: string;
  description: string;
  price: number;
}

interface MenuDriftReport {
  generatedAt: string;
  canonical: {
    source: string;
    itemCount: number;
  };
  online: {
    source: string;
    itemCount: number;
  };
  drift: {
    missingOnline: CanonicalMenuItem[];
    extraOnline: { name: string; sku?: string; category?: string }[];
    categoryMismatches: { name: string; canonicalCategory: string; onlineCategory: string }[];
    duplicateNames: string[];
    duplicateSkus: string[];
  };
  summary: {
    missingCount: number;
    extraCount: number;
    mismatchCount: number;
    duplicateNameCount: number;
    duplicateSkuCount: number;
    syncScore: number;
  };
}

// In-memory cache for canonical menu
let canonicalMenuCache: CanonicalMenuItem[] = [];
let cacheLoadedAt: Date | null = null;

const CSV_PATH = path.join(
  process.cwd(),
  "attached_assets/All Menu Items- SKU and Categories - Loyverse_1762489025094.csv"
);

export function loadCanonicalMenu(): CanonicalMenuItem[] {
  try {
    if (!fs.existsSync(CSV_PATH)) {
      console.error("[CANONICAL] CSV file not found:", CSV_PATH);
      return [];
    }

    const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    canonicalMenuCache = records.map((row: any) => ({
      name: (row["Item Name"] || "").trim(),
      sku: (row["SKU"] || "").trim(),
      category: (row["Category"] || "").trim(),
      description: (row["Description"] || "").trim(),
      price: parseFloat(row["Price"]) || 0,
    }));

    cacheLoadedAt = new Date();
    console.log(`[CANONICAL] Loaded ${canonicalMenuCache.length} items from Loyverse CSV`);
    return canonicalMenuCache;
  } catch (err) {
    console.error("[CANONICAL] Error loading CSV:", err);
    return [];
  }
}

export function getCanonicalMenu(): CanonicalMenuItem[] {
  if (canonicalMenuCache.length === 0) {
    loadCanonicalMenu();
  }
  return canonicalMenuCache;
}

export function getCacheStatus(): { loaded: boolean; itemCount: number; loadedAt: string | null } {
  return {
    loaded: canonicalMenuCache.length > 0,
    itemCount: canonicalMenuCache.length,
    loadedAt: cacheLoadedAt?.toISOString() || null,
  };
}

async function getOnlineMenuItems(): Promise<{ name: string; sku?: string; category?: string }[]> {
  try {
    const prisma = db();
    const categories = await prisma.menuCategory.findMany({
      include: {
        items: true,
      },
    });

    const items: { name: string; sku?: string; category?: string }[] = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        items.push({
          name: item.name,
          sku: item.sku || undefined,
          category: cat.name,
        });
      }
    }
    return items;
  } catch (err) {
    console.error("[CANONICAL] Error fetching online menu:", err);
    return [];
  }
}

function normalise(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function generateDriftReport(): Promise<MenuDriftReport> {
  const canonical = getCanonicalMenu();
  const online = await getOnlineMenuItems();

  const canonicalByName = new Map<string, CanonicalMenuItem>();
  const canonicalBySku = new Map<string, CanonicalMenuItem>();

  for (const item of canonical) {
    canonicalByName.set(normalise(item.name), item);
    if (item.sku) {
      canonicalBySku.set(item.sku, item);
    }
  }

  const onlineByName = new Map<string, { name: string; sku?: string; category?: string }>();
  for (const item of online) {
    onlineByName.set(normalise(item.name), item);
  }

  // Find items in CSV but missing from online
  const missingOnline: CanonicalMenuItem[] = [];
  for (const item of canonical) {
    const normName = normalise(item.name);
    if (!onlineByName.has(normName)) {
      missingOnline.push(item);
    }
  }

  // Find items online but not in CSV
  const extraOnline: { name: string; sku?: string; category?: string }[] = [];
  for (const item of online) {
    const normName = normalise(item.name);
    if (!canonicalByName.has(normName)) {
      extraOnline.push(item);
    }
  }

  // Find category mismatches
  const categoryMismatches: { name: string; canonicalCategory: string; onlineCategory: string }[] = [];
  for (const item of online) {
    const normName = normalise(item.name);
    const canonicalItem = canonicalByName.get(normName);
    if (canonicalItem && item.category) {
      if (normalise(canonicalItem.category) !== normalise(item.category)) {
        categoryMismatches.push({
          name: item.name,
          canonicalCategory: canonicalItem.category,
          onlineCategory: item.category,
        });
      }
    }
  }

  // Find duplicate names in CSV
  const nameCount = new Map<string, number>();
  for (const item of canonical) {
    const normName = normalise(item.name);
    nameCount.set(normName, (nameCount.get(normName) || 0) + 1);
  }
  const duplicateNames = Array.from(nameCount.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => canonical.find((i) => normalise(i.name) === name)?.name || name);

  // Find duplicate SKUs in CSV
  const skuCount = new Map<string, number>();
  for (const item of canonical) {
    if (item.sku) {
      skuCount.set(item.sku, (skuCount.get(item.sku) || 0) + 1);
    }
  }
  const duplicateSkus = Array.from(skuCount.entries())
    .filter(([, count]) => count > 1)
    .map(([sku]) => sku);

  // Calculate sync score (percentage of canonical items found online)
  const matchedCount = canonical.length - missingOnline.length;
  const syncScore = canonical.length > 0 ? Math.round((matchedCount / canonical.length) * 100) : 0;

  const report: MenuDriftReport = {
    generatedAt: new Date().toISOString(),
    canonical: {
      source: "Loyverse CSV",
      itemCount: canonical.length,
    },
    online: {
      source: "/api/menu-ordering/full",
      itemCount: online.length,
    },
    drift: {
      missingOnline,
      extraOnline,
      categoryMismatches,
      duplicateNames,
      duplicateSkus,
    },
    summary: {
      missingCount: missingOnline.length,
      extraCount: extraOnline.length,
      mismatchCount: categoryMismatches.length,
      duplicateNameCount: duplicateNames.length,
      duplicateSkuCount: duplicateSkus.length,
      syncScore,
    },
  };

  console.log("\n========================================");
  console.log("MENU DRIFT REPORT — LOYVERSE vs ONLINE");
  console.log("========================================");
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Canonical items: ${canonical.length}`);
  console.log(`Online items: ${online.length}`);
  console.log(`Missing online: ${missingOnline.length}`);
  console.log(`Extra online: ${extraOnline.length}`);
  console.log(`Category mismatches: ${categoryMismatches.length}`);
  console.log(`Sync score: ${syncScore}%`);
  console.log("========================================\n");

  return report;
}

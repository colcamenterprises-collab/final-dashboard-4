// server/services/burgerMetrics.ts
import { PrismaClient } from "@prisma/client";
import { CATALOG, ALL_ITEM_NAME_VARIANTS, CatalogItem } from "../constants/burgerCatalog";

const prisma = new PrismaClient();

export type ProductRow = {
  normalizedName: string;
  rawHits: string[];      // which raw strings matched
  qty: number;
  patties: number;        // beef patties
  redMeatGrams: number;   // beef grams only
  chickenGrams: number;   // chicken grams
  rolls: number;          // buns
};

export type BurgerMetrics = {
  shiftDate: string;
  fromISO: string;
  toISO: string;
  products: ProductRow[];
  totals: {
    burgers: number;
    patties: number;        // beef patties
    redMeatGrams: number;
    chickenGrams: number;
    rolls: number;
  };
  unmapped: Record<string, number>; // raw item names that looked like burgers but not mapped
};

function matchCatalog(rawName: string): CatalogItem | undefined {
  const l = rawName.toLowerCase().trim();
  return CATALOG.find(c => c.itemNames.map(x => x.toLowerCase().trim()).includes(l));
}

// Query receipt_items joined with receipts for burger counts
async function fetchCounts(fromISO: string, toISO: string) {
  try {
    const items = await prisma.$queryRaw<{ name: string; qty: number }[]>`
      SELECT ri.name, SUM(ri.quantity)::int AS qty
      FROM receipt_items ri
      JOIN receipts r ON r.id = ri.receipt_id
      WHERE r.timestamp >= ${fromISO}::timestamptz
        AND r.timestamp < ${toISO}::timestamptz
        AND LOWER(ri.name) = ANY(${ALL_ITEM_NAME_VARIANTS})
      GROUP BY ri.name
    `;
    return items.map(r => ({ itemName: r.name, qty: Number(r.qty) || 0 }));
  } catch (error) {
    console.error('[burgerMetrics] Error fetching counts:', error);
    return [];
  }
}

export async function computeMetrics(fromISO: string, toISO: string, shiftDateLabel: string): Promise<BurgerMetrics> {
  const hits = await fetchCounts(fromISO, toISO);

  // Build per-product aggregations
  const map = new Map<string, ProductRow>();
  for (const cat of CATALOG) {
    map.set(cat.normalizedName, {
      normalizedName: cat.normalizedName,
      rawHits: [],
      qty: 0,
      patties: 0,
      redMeatGrams: 0,
      chickenGrams: 0,
      rolls: 0,
    });
  }

  const unmapped: Record<string, number> = {};
  for (const { itemName, qty } of hits) {
    const cat = matchCatalog(itemName);
    if (!cat) {
      unmapped[itemName] = (unmapped[itemName] ?? 0) + qty;
      continue;
    }
    const row = map.get(cat.normalizedName)!;
    row.qty += qty;
    row.rawHits.push(itemName);

    // buns
    if (cat.countsRoll) row.rolls += qty;

    // beef pats & grams
    if (cat.pattiesPerItem > 0) {
      const pats = qty * cat.pattiesPerItem;
      row.patties += pats;
      row.redMeatGrams += pats * cat.gramsPerPatty;
    }

    // chicken grams
    if (cat.chickenGramsPerItem > 0) {
      row.chickenGrams += qty * cat.chickenGramsPerItem;
    }
  }

  const products = Array.from(map.values());

  const totals = products.reduce((acc, r) => {
    acc.burgers += r.qty;
    acc.patties += r.patties;
    acc.redMeatGrams += r.redMeatGrams;
    acc.chickenGrams += r.chickenGrams;
    acc.rolls += r.rolls;
    return acc;
  }, { burgers: 0, patties: 0, redMeatGrams: 0, chickenGrams: 0, rolls: 0 });

  return {
    shiftDate: shiftDateLabel,
    fromISO,
    toISO,
    products,
    totals,
    unmapped,
  };
}

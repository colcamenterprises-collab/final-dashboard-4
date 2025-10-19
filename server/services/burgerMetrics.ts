import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import { BURGER_SKU_MAP, NAME_BY_SKU } from "./burgerSkuMap";

const prisma = new PrismaClient();
const TZ = "Asia/Bangkok";
const BEEF_G = 95;

export function shiftWindow(dateISO: string) {
  const base = DateTime.fromISO(dateISO, { zone: TZ }).startOf("day");
  return {
    shiftDateLabel: base.toISODate()!,
    fromISO: base.plus({ hours: 18 }).toISO(),
    toISO: base.plus({ days: 1, hours: 3 }).toISO(),
  };
}

export async function computeMetrics(fromISO: string, toISO: string, shiftDateLabel: string) {
  // Check if pos_receipt has data (preferred SKU-based source)
  const posCount = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM pos_receipt pr
    WHERE pr.datetime >= ${fromISO}::timestamptz
      AND pr.datetime < ${toISO}::timestamptz
  `;
  
  const hasPosData = Number(posCount[0]?.count || 0) > 0;

  if (hasPosData) {
    return computeFromPosReceipt(fromISO, toISO, shiftDateLabel);
  } else {
    return computeFromReceiptItems(fromISO, toISO, shiftDateLabel);
  }
}

// SKU-based counting (preferred, accurate)
async function computeFromPosReceipt(fromISO: string, toISO: string, shiftDateLabel: string) {
  const rows = await prisma.$queryRaw<{ sku: string | null; item_name: string; qty: number }[]>`
    SELECT (item->>'sku') AS sku,
           (item->>'name') AS item_name,
           SUM((item->>'quantity')::int) AS qty
    FROM pos_receipt pr,
         LATERAL jsonb_array_elements(pr.items_json) AS item
    WHERE pr.datetime >= ${fromISO}::timestamptz
      AND pr.datetime < ${toISO}::timestamptz
      AND COALESCE(pr.batch_id, '') NOT LIKE 'TEST_%'
    GROUP BY sku, item_name
  `;

  const productsMap = new Map<string, {
    qty: number; patties: number; redMeatGrams: number; chickenGrams: number; rolls: number; skus: Set<string>
  }>();
  const unmapped: Record<string, number> = {};

  for (const row of rows) {
    const qty = Number(row.qty || 0);
    const sku = row.sku?.trim() || null;
    const rule = sku ? BURGER_SKU_MAP[sku] : null;

    if (!rule) {
      unmapped[row.item_name] = (unmapped[row.item_name] ?? 0) + qty;
      continue;
    }

    const productName = NAME_BY_SKU[sku!] || row.item_name;
    if (!productsMap.has(productName)) {
      productsMap.set(productName, { qty: 0, patties: 0, redMeatGrams: 0, chickenGrams: 0, rolls: 0, skus: new Set() });
    }

    const p = productsMap.get(productName)!;
    p.qty += qty;
    p.rolls += rule.rollsPer * qty;
    p.skus.add(sku!);

    if (rule.kind === "beef") {
      p.patties += rule.pattiesPer * qty;
      p.redMeatGrams += rule.pattiesPer * BEEF_G * qty;
    } else {
      p.chickenGrams += rule.gramsPer * qty;
    }
  }

  const products = Array.from(productsMap.entries()).map(([normalizedName, v]) => ({
    normalizedName,
    qty: v.qty,
    patties: v.patties,
    redMeatGrams: v.redMeatGrams,
    chickenGrams: v.chickenGrams,
    rolls: v.rolls,
    rawHits: Array.from(v.skus),
  })).sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));

  const totals = products.reduce((t, r) => ({
    burgers: t.burgers + r.qty,
    patties: t.patties + r.patties,
    redMeatGrams: t.redMeatGrams + r.redMeatGrams,
    chickenGrams: t.chickenGrams + r.chickenGrams,
    rolls: t.rolls + r.rolls,
  }), { burgers: 0, patties: 0, redMeatGrams: 0, chickenGrams: 0, rolls: 0 });

  return { shiftDate: shiftDateLabel, fromISO, toISO, products, totals, unmapped };
}

// Legacy name-based fuzzy matching (fallback for receipt_items)
const CATALOG = [
  { normalized: "Single Smash Burger", pattiesPer: 1, kind: "beef",
    aliases: ["single smash", "single meal set", "kids single", "ซิงเกิ้ล"] },
  { normalized: "Super Double Bacon & Cheese", pattiesPer: 2, kind: "beef",
    aliases: ["super double bacon", "super double bacon & cheese", "ซูเปอร์ดับเบิ้ลเบคอน", "super double bacon & cheese set"] },
  { normalized: "Triple Smash Burger", pattiesPer: 3, kind: "beef",
    aliases: ["triple smash", "triple smash set", "สาม"] },
  { normalized: "Ultimate Double", pattiesPer: 2, kind: "beef",
    aliases: ["ultimate double", "double smash burger", "double set", "คู่"] },
  { normalized: "Crispy Chicken Fillet Burger", pattiesPer: 0, kind: "chicken",
    aliases: ["crispy chicken", "เบอร์เกอร์ไก่ชิ้น"] },
  { normalized: "Karaage Chicken Burger", pattiesPer: 0, kind: "chicken",
    aliases: ["karaage chicken", "คาราอาเกะ"] },
  { normalized: "Big Rooster Sriracha Chicken", pattiesPer: 0, kind: "chicken",
    aliases: ["rooster", "sriracha", "ศรีราชา"] },
  { normalized: "El Smasho Grande Chicken Burger", pattiesPer: 0, kind: "chicken",
    aliases: ["smasho", "grande chicken", "แกรนด์ชิกเก้น"] },
];

function simplify(s: string) {
  return s.toLowerCase()
    .replace(/[(){}\[\]•★☆🐔™®©.,\-–—_]/g, " ")
    .replace(/\b(meal|deal|set|combo|คอมโบ|เซ็ต|ชุด)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_INDEX: Array<{ key: string; norm: string; pattiesPer: number; kind: "beef"|"chicken" }> = [];
for (const c of CATALOG) {
  for (const a of c.aliases) ALIAS_INDEX.push({ key: simplify(a), norm: c.normalized, pattiesPer: c.pattiesPer, kind: c.kind as any });
}

function matchBurger(raw: string) {
  const k = simplify(raw);
  const e = ALIAS_INDEX.find(x => x.key === k);
  if (e) return e;
  const c = ALIAS_INDEX.find(x => k.includes(x.key));
  return c || null;
}

async function computeFromReceiptItems(fromISO: string, toISO: string, shiftDateLabel: string) {
  const fromBkk = DateTime.fromISO(fromISO).toFormat('yyyy-MM-dd HH:mm:ss');
  const toBkk = DateTime.fromISO(toISO).toFormat('yyyy-MM-dd HH:mm:ss');
  
  const rows = await prisma.$queryRaw<{ item_name: string; qty: number }[]>`
    SELECT ri.name AS item_name,
           SUM(ri.qty)::int AS qty
    FROM receipt_items ri
    JOIN receipts r ON r.id = ri."receiptId"
    WHERE COALESCE(r."closedAtUTC", r."createdAtUTC") >= ${fromBkk}::timestamp
      AND COALESCE(r."closedAtUTC", r."createdAtUTC") < ${toBkk}::timestamp
    GROUP BY ri.name
  `;

  const productsMap = new Map<string, {
    qty: number; patties: number; redMeatG: number; chickenG: number; rolls: number; rawHits: Set<string>
  }>();
  const unmapped: Record<string, number> = {};

  for (const { item_name, qty } of rows) {
    const m = matchBurger(item_name);
    if (!m) { unmapped[item_name] = (unmapped[item_name] ?? 0) + qty; continue; }
    if (!productsMap.has(m.norm)) productsMap.set(m.norm, { qty: 0, patties: 0, redMeatG: 0, chickenG: 0, rolls: 0, rawHits: new Set() });
    const p = productsMap.get(m.norm)!;
    p.qty += qty;
    p.rolls += qty;
    p.rawHits.add(item_name);
    if (m.kind === "beef") {
      p.patties += qty * m.pattiesPer;
      p.redMeatG += qty * m.pattiesPer * BEEF_G;
    } else {
      p.chickenG += 100 * qty; // 100g per chicken burger
    }
  }

  const products = Array.from(productsMap.entries()).map(([normalizedName, v]) => ({
    normalizedName,
    qty: v.qty,
    patties: v.patties,
    redMeatGrams: v.redMeatG,
    chickenGrams: v.chickenG,
    rolls: v.rolls,
    rawHits: Array.from(v.rawHits),
  })).sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));

  const totals = products.reduce((t, r) => ({
    burgers: t.burgers + r.qty,
    patties: t.patties + r.patties,
    redMeatGrams: t.redMeatGrams + r.redMeatGrams,
    chickenGrams: t.chickenGrams + r.chickenGrams,
    rolls: t.rolls + r.rolls,
  }), { burgers: 0, patties: 0, redMeatGrams: 0, chickenGrams: 0, rolls: 0 });

  return { shiftDate: shiftDateLabel, fromISO, toISO, products, totals, unmapped };
}

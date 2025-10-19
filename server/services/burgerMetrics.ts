import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";

const prisma = new PrismaClient();
const TZ = "Asia/Bangkok";
const BEEF_G = 95;
const CHICKEN_G = 100;

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

export function shiftWindow(dateISO: string) {
  const base = DateTime.fromISO(dateISO, { zone: TZ }).startOf("day");
  return {
    shiftDateLabel: base.toISODate()!,
    fromISO: base.plus({ hours: 18 }).toISO(),
    toISO: base.plus({ days: 1, hours: 3 }).toISO(),
  };
}

export async function computeMetrics(fromISO: string, toISO: string, shiftDateLabel: string) {
  const fromBkk = DateTime.fromISO(fromISO).toFormat('yyyy-MM-dd HH:mm:ss');
  const toBkk = DateTime.fromISO(toISO).toFormat('yyyy-MM-dd HH:mm:ss');
  
  const rows = await prisma.$queryRaw<{ item_name: string; qty: number }[]>`
    SELECT ri.name AS item_name,
           SUM(ri.qty)::int AS qty
    FROM receipt_items ri
    JOIN receipts r ON r.id = ri."receiptId"
    WHERE COALESCE(r."closedAtUTC", r."createdAtUTC") >= ${fromBkk}::timestamp
      AND COALESCE(r."closedAtUTC", r."createdAtUTC") <  ${toBkk}::timestamp
    GROUP BY ri.name
  `;

  const productsMap = new Map<string, {
    qty:number; patties:number; redMeatG:number; chickenG:number; rolls:number; rawHits:Set<string>
  }>();
  const unmapped: Record<string, number> = {};

  for (const { item_name, qty } of rows) {
    const m = matchBurger(item_name);
    if (!m) { unmapped[item_name] = (unmapped[item_name] ?? 0) + qty; continue; }
    if (!productsMap.has(m.norm)) productsMap.set(m.norm, { qty:0, patties:0, redMeatG:0, chickenG:0, rolls:0, rawHits:new Set() });
    const p = productsMap.get(m.norm)!;
    p.qty += qty;
    p.rolls += qty;
    p.rawHits.add(item_name);
    if (m.kind === "beef") {
      p.patties += qty * m.pattiesPer;
      p.redMeatG += qty * m.pattiesPer * BEEF_G;
    } else {
      p.chickenG += qty * CHICKEN_G;
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
  })).sort((a,b)=>a.normalizedName.localeCompare(b.normalizedName));

  const totals = products.reduce((t, r) => ({
    burgers: t.burgers + r.qty,
    patties: t.patties + r.patties,
    redMeatGrams: t.redMeatGrams + r.redMeatGrams,
    chickenGrams: t.chickenGrams + r.chickenGrams,
    rolls: t.rolls + r.rolls,
  }), { burgers:0, patties:0, redMeatGrams:0, chickenGrams:0, rolls:0 });

  return { shiftDate: shiftDateLabel, fromISO, toISO, products, totals, unmapped };
}

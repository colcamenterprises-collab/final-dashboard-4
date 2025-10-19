import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";

const prisma = new PrismaClient();
const TZ = "Asia/Bangkok";
const BEEF_G = 95;
const BURGER_SOURCE = process.env.BURGER_SOURCE || "auto";

export function shiftWindow(dateISO: string) {
  const base = DateTime.fromISO(dateISO, { zone: TZ }).startOf("day");
  return {
    shiftDateLabel: base.toISODate()!,
    fromISO: base.plus({ hours: 18 }).toISO(),
    toISO: base.plus({ days: 1, hours: 3 }).toISO(),
  };
}

async function hasPosData(fromISO: string, toISO: string): Promise<boolean> {
  const r = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::int AS n FROM pos_receipt
    WHERE datetime >= ${fromISO}::timestamptz AND datetime < ${toISO}::timestamptz
      AND COALESCE(batch_id,'') NOT LIKE 'TEST_%'`;
  return Number(r?.[0]?.n ?? 0) > 0;
}

async function loadShiftItems(fromISO: string, toISO: string) {
  const preferPos = BURGER_SOURCE === "pos" || (BURGER_SOURCE === "auto" && await hasPosData(fromISO, toISO));
  
  if (preferPos) {
    const rows = await prisma.$queryRaw<{ sku: string|null; item_name: string; qty: number }[]>`
      SELECT (item->>'sku') AS sku, (item->>'name') AS item_name,
             SUM((item->>'quantity')::int) AS qty
      FROM pos_receipt pr, LATERAL jsonb_array_elements(pr.items_json) AS item
      WHERE pr.datetime >= ${fromISO}::timestamptz AND pr.datetime < ${toISO}::timestamptz
        AND COALESCE(pr.batch_id,'') NOT LIKE 'TEST_%'
      GROUP BY sku, item_name`;
    return { sourceUsed: "pos" as const, rows };
  }
  
  const fromBkk = DateTime.fromISO(fromISO).toFormat('yyyy-MM-dd HH:mm:ss');
  const toBkk = DateTime.fromISO(toISO).toFormat('yyyy-MM-dd HH:mm:ss');
  const rows = await prisma.$queryRaw<{ sku: null; item_name: string; qty: number }[]>`
    SELECT NULL::text AS sku, ri.name AS item_name, SUM(ri.qty)::int AS qty
    FROM receipt_items ri JOIN receipts r ON r.id = ri."receiptId"
    WHERE COALESCE(r."closedAtUTC", r."createdAtUTC") >= ${fromBkk}::timestamp
      AND COALESCE(r."closedAtUTC", r."createdAtUTC") < ${toBkk}::timestamp
    GROUP BY ri.name`;
  return { sourceUsed: "legacy" as const, rows };
}

async function loadBurgerRulesFromCatalog() {
  const rows = await prisma.$queryRaw<{
    sku:string; name:string; kind: 'beef'|'chicken'|null; patties_per:number|null; grams_per:number|null; rolls_per:number;
  }[]>`SELECT sku, name, kind, patties_per, grams_per, rolls_per FROM item_catalog WHERE category='burger'`;
  
  const rules = new Map<string, { name:string; kind:'beef'|'chicken'; patties?:number; grams?:number; rolls:number }>();
  for (const r of rows) {
    if (!r.kind) continue;
    rules.set(r.sku, {
      name: r.name,
      kind: r.kind,
      patties: r.kind === 'beef' ? (r.patties_per ?? 1) : undefined,
      grams:   r.kind === 'chicken' ? (r.grams_per ?? 100) : undefined,
      rolls: r.rolls_per ?? 1,
    });
  }
  return rules;
}

export async function computeMetrics(fromISO: string, toISO: string, shiftDateLabel: string) {
  const { sourceUsed, rows } = await loadShiftItems(fromISO, toISO);
  const rules = await loadBurgerRulesFromCatalog();

  const perSku = new Map<string, { 
    name:string; qty:number; patties:number; red:number; chick:number; rolls:number; hits:Set<string> 
  }>();
  const unmapped: Record<string, number> = {};

  for (const r of rows) {
    const qty = Number(r.qty || 0);
    const sku = r.sku?.trim() || null;
    
    if (sku && rules.has(sku)) {
      const rule = rules.get(sku)!;
      if (!perSku.has(sku)) {
        perSku.set(sku, { name: rule.name, qty:0, patties:0, red:0, chick:0, rolls:0, hits:new Set() });
      }
      const p = perSku.get(sku)!;
      p.qty += qty;
      p.rolls += rule.rolls * qty;
      p.hits.add(`${sku} :: ${r.item_name}`);
      
      if (rule.kind === 'beef') { 
        p.patties += (rule.patties ?? 1) * qty; 
        p.red += (rule.patties ?? 1) * BEEF_G * qty; 
      } else { 
        p.chick += (rule.grams ?? 100) * qty; 
      }
    } else {
      if (/burger|meal|set/i.test(r.item_name || "")) {
        unmapped[r.item_name] = (unmapped[r.item_name] ?? 0) + qty;
      }
    }
  }

  const products = Array.from(perSku.entries()).map(([sku, v]) => ({
    sku,
    normalizedName: v.name,
    qty: v.qty,
    patties: v.patties,
    redMeatGrams: v.red,
    chickenGrams: v.chick,
    rolls: v.rolls,
    rawHits: Array.from(v.hits),
  })).sort((a,b)=>a.normalizedName.localeCompare(b.normalizedName));

  const totals = products.reduce((t, r) => ({
    burgers: t.burgers + r.qty,
    patties: t.patties + r.patties,
    redMeatGrams: t.redMeatGrams + r.redMeatGrams,
    chickenGrams: t.chickenGrams + r.chickenGrams,
    rolls: t.rolls + r.rolls,
  }), { burgers:0, patties:0, redMeatGrams:0, chickenGrams:0, rolls:0 });

  return { shiftDate: shiftDateLabel, fromISO, toISO, sourceUsed, products, totals, unmapped };
}

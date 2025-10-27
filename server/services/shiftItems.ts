import { PrismaClient } from '@prisma/client';
import { shiftWindow } from './time/shiftWindow.js';
const db = new PrismaClient();
const BEEF_G = 95;

export async function computeShiftAll(dateISO: string) {
  const { shiftDate, fromISO, toISO } = shiftWindow(dateISO);

  // 1) Find receipts that have meal-sets in the window
  const mealSetReceipts = await db.$queryRaw<{receipt_id:string}[]>`
    WITH win AS (SELECT ${fromISO}::timestamptz AS from_ts, ${toISO}::timestamptz AS to_ts)
    SELECT DISTINCT li.receipt_id
    FROM lv_line_item li
    JOIN lv_receipt r ON r.receipt_id = li.receipt_id, win
    JOIN item_catalog c ON c.sku = li.sku
    WHERE r.datetime_bkk >= win.from_ts AND r.datetime_bkk < win.to_ts
      AND c.is_meal_set = true
  `;
  const setReceiptIds = new Set(mealSetReceipts.map(r=>r.receipt_id));

  // 2) Base exclusions: base burger zero-price components when paired with a set on SAME receipt
  const exclusions = await db.$queryRaw<{receipt_id:string; line_no:number}[]>`
    WITH win AS (SELECT ${fromISO}::timestamptz AS from_ts, ${toISO}::timestamptz AS to_ts)
    SELECT li.receipt_id, li.line_no
    FROM lv_line_item li
    JOIN lv_receipt r ON r.receipt_id = li.receipt_id, win
    JOIN item_catalog b ON b.sku = li.sku
    WHERE r.datetime_bkk >= win.from_ts AND r.datetime_bkk < win.to_ts
      AND b.category='burger'
      AND COALESCE(li.unit_price,0)=0
      AND EXISTS (
        SELECT 1
        FROM lv_line_item si
        JOIN item_catalog mc ON mc.sku = si.sku
        WHERE si.receipt_id = li.receipt_id
          AND mc.is_meal_set = true
          AND mc.base_sku = li.sku
      )
  `;
  const excludeKey = new Set(exclusions.map(e=>`${e.receipt_id}#${e.line_no}`));

  // 3) Line items (all categories), SKU-first with alias fallback ONLY when sku is NULL
  const lineItems = await db.$queryRaw<{ sku:string|null; name:string; qty:number; receipt_id:string; line_no:number }[]>`
    WITH win AS (SELECT ${fromISO}::timestamptz AS from_ts, ${toISO}::timestamptz AS to_ts)
    SELECT COALESCE(li.sku, ia.sku) AS sku,
           li.name,
           SUM(li.qty)::int AS qty,
           li.receipt_id,
           MIN(li.line_no)::int AS line_no
    FROM lv_line_item li
    JOIN lv_receipt r ON r.receipt_id = li.receipt_id, win
    LEFT JOIN item_alias ia ON li.sku IS NULL AND ia.alias_name = li.name
    WHERE r.datetime_bkk >= win.from_ts AND r.datetime_bkk < win.to_ts
    GROUP BY COALESCE(li.sku, ia.sku), li.name, li.receipt_id
  `;

  // 4) Modifiers (group by resolved sku/name), keep them separate in analytics_shift_modifier
  const modifiers = await db.$queryRaw<{ sku:string|null; name:string; qty:number; receipt_id:string }[]>`
    WITH win AS (SELECT ${fromISO}::timestamptz AS from_ts, ${toISO}::timestamptz AS to_ts)
    SELECT COALESCE(m.sku, ia.sku) AS sku,
           m.name,
           SUM(m.qty)::int AS qty,
           m.receipt_id
    FROM lv_modifier m
    JOIN lv_receipt r ON r.receipt_id = m.receipt_id, win
    LEFT JOIN item_alias ia ON m.sku IS NULL AND ia.alias_name = m.name
    WHERE r.datetime_bkk >= win.from_ts AND r.datetime_bkk < win.to_ts
    GROUP BY COALESCE(m.sku, ia.sku), m.name, m.receipt_id
  `;

  // 5) Load active catalog
  const catalog = await db.$queryRaw<{
    sku:string; name:string; category:string; kind:string|null; patties_per:number|null; grams_per:number|null; rolls_per:number|null; is_meal_set:boolean; base_sku:string|null;
  }[]>`SELECT sku, name, category, kind, patties_per, grams_per, rolls_per, is_meal_set, base_sku
       FROM item_catalog WHERE active=true`;

  const bySku = new Map(catalog.map(c => [c.sku, c]));

  // 6) Aggregate ITEMS with exclusions
  const accItems = new Map<string, {
    sku:string|null; name:string; category:string; qty:number; patties:number; red:number; chick:number; rolls:number; hits:Set<string>;
  }>();

  for (const r of lineItems) {
    // Skip base burger component lines when excluded
    if (excludeKey.has(`${r.receipt_id}#${r.line_no}`)) continue;

    const rule = r.sku ? bySku.get(r.sku) ?? null : null;
    const name = rule?.name ?? r.name;
    const category = rule?.category ?? 'other';

    const key = r.sku ?? name;
    if (!accItems.has(key)) accItems.set(key, { sku:r.sku, name, category, qty:0, patties:0, red:0, chick:0, rolls:0, hits:new Set() });
    const p = accItems.get(key)!;
    p.qty += r.qty;
    p.hits.add(`${r.sku ?? 'no-sku'} :: ${name}`);

    if (category === 'burger' && rule) {
      if (rule.kind === 'beef') {
        const patties = (rule.patties_per ?? 1) * r.qty;
        p.patties += patties;
        p.red += patties * BEEF_G;
      } else if (rule.kind === 'chicken') {
        p.chick += (rule.grams_per ?? 100) * r.qty;
      }
      p.rolls += (rule.rolls_per ?? 1) * r.qty;
    }
  }

  // 7) Aggregate MODIFIERS separately
  const accMods = new Map<string, { sku:string|null; name:string; category:string; qty:number; hits:Set<string> }>();
  for (const m of modifiers) {
    const rule = m.sku ? bySku.get(m.sku) ?? null : null;
    const name = rule?.name ?? m.name;
    const key = m.sku ?? name;
    if (!accMods.has(key)) accMods.set(key, { sku:m.sku, name, category:'modifier', qty:0, hits:new Set() });
    const p = accMods.get(key)!;
    p.qty += m.qty;
    p.hits.add(`${m.sku ?? 'no-sku'} :: ${name}`);
  }

  // 8) Write cache transactionally (items + modifiers + category rollups)
  await db.$transaction(async tx => {
    await tx.$executeRaw`DELETE FROM analytics_shift_item WHERE shift_date=${shiftDate}::date`;
    await tx.$executeRaw`DELETE FROM analytics_shift_modifier WHERE shift_date=${shiftDate}::date`;
    await tx.$executeRaw`DELETE FROM analytics_shift_category_summary WHERE shift_date=${shiftDate}::date`;

    const byCat:any = {};

    for (const v of accItems.values()) {
      byCat[v.category] = (byCat[v.category] ?? 0) + v.qty;
      await tx.$executeRaw`
        INSERT INTO analytics_shift_item
          (shift_date, from_ts, to_ts, sku, name, category, qty, patties, red_meat_g, chicken_g, rolls, raw_hits, updated_at)
        VALUES
          (${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz,
           ${v.sku}, ${v.name}, ${v.category}, ${v.qty}, ${v.patties}, ${v.red}, ${v.chick}, ${v.rolls},
           ${JSON.stringify(Array.from(v.hits))}::jsonb, now())
        ON CONFLICT (shift_date, COALESCE(sku, name)) DO UPDATE
          SET qty=EXCLUDED.qty, patties=EXCLUDED.patties, red_meat_g=EXCLUDED.red_meat_g,
              chicken_g=EXCLUDED.chicken_g, rolls=EXCLUDED.rolls, raw_hits=EXCLUDED.raw_hits,
              from_ts=EXCLUDED.from_ts, to_ts=EXCLUDED.to_ts, updated_at=now()
      `;
    }

    // modifiers table
    for (const v of accMods.values()) {
      byCat['modifier'] = (byCat['modifier'] ?? 0) + v.qty;
      await tx.$executeRaw`
        INSERT INTO analytics_shift_modifier
          (shift_date, from_ts, to_ts, sku, name, category, qty, raw_hits, updated_at)
        VALUES
          (${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz,
           ${v.sku}, ${v.name}, 'modifier', ${v.qty}, ${JSON.stringify(Array.from(v.hits))}::jsonb, now())
        ON CONFLICT (shift_date, COALESCE(sku, name)) DO UPDATE
          SET qty=EXCLUDED.qty, raw_hits=EXCLUDED.raw_hits,
              from_ts=EXCLUDED.from_ts, to_ts=EXCLUDED.to_ts, updated_at=now()
      `;
    }

    // category summaries
    for (const [cat,total] of Object.entries(byCat)) {
      await tx.$executeRaw`
        INSERT INTO analytics_shift_category_summary
          (shift_date, from_ts, to_ts, category, items_total, updated_at)
        VALUES
          (${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz, ${cat}, ${total}, now())
        ON CONFLICT (shift_date, category) DO UPDATE
          SET items_total=EXCLUDED.items_total, from_ts=EXCLUDED.from_ts, to_ts=EXCLUDED.to_ts, updated_at=now()
      `;
    }
  });

  // 9) Response (items only; modifiers can be separate endpoint if preferred)
  const items = Array.from(accItems.values()).sort((a,b)=>
    a.category===b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)
  ).map(v=>({
    sku:v.sku, name:v.name, category:v.category, qty:v.qty,
    patties:v.patties, redMeatGrams:v.red, chickenGrams:v.chick, rolls:v.rolls
  }));

  return { shiftDate, fromISO, toISO, items, sourceUsed:'live' as const };
}

// Keep old computeShift function for backwards compatibility (can be deprecated later)
export async function computeShift(dateISO: string) {
  return computeShiftAll(dateISO);
}

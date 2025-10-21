import { PrismaClient } from '@prisma/client';
import { shiftWindow } from './time/shiftWindow';

const db = new PrismaClient();
const BEEF_G = 95;

export async function computeShift(dateISO: string) {
  const { shiftDate, fromISO, toISO } = shiftWindow(dateISO);

  // 1) Pull rows: use SKU directly; if missing, try alias map to resolve a SKU.
  //    The alias join ensures name-only lines can still map to a SKU.
  const rows = await db.$queryRaw<{
    sku: string | null;
    name: string;
    qty: number;
  }[]>`
    WITH base AS (
      SELECT li.sku, li.name, SUM(li.qty)::int AS qty
      FROM lv_line_item li
      JOIN lv_receipt r ON r.receipt_id = li.receipt_id
      WHERE r.datetime_bkk >= ${fromISO}::timestamptz
        AND r.datetime_bkk <  ${toISO}::timestamptz
      GROUP BY li.sku, li.name
    )
    SELECT COALESCE(base.sku, ia.sku) AS sku,
           base.name,
           base.qty
    FROM base
    LEFT JOIN item_alias ia ON base.sku IS NULL AND ia.alias_name = base.name
  `;

  // 2) Load catalog once (active items only)
  const catalog = await db.$queryRaw<{
    sku: string;
    name: string;
    category: string;
    kind: string | null;
    patties_per: number | null;
    grams_per: number | null;
    rolls_per: number;
  }[]>`
    SELECT sku, name, category, kind, patties_per, grams_per, rolls_per
    FROM item_catalog
    WHERE active = true
  `;

  const bySku = new Map(catalog.map(c => [c.sku, c]));

  // 3) Aggregate strictly by SKU (if SKU still null, keep as 'other' with original name)
  const acc = new Map<string, {
    sku: string | null;
    name: string;
    category: string;
    qty: number;
    patties: number;
    red: number;
    chick: number;
    rolls: number;
    hits: Set<string>;
  }>();

  for (const r of rows) {
    const sku = r.sku ?? null;
    const rule = sku ? bySku.get(sku) ?? null : null;
    const name = rule?.name ?? r.name;
    const category = rule?.category ?? 'other';

    // KEY: use SKU if present, else fallback to the name (so uniqueness holds)
    const key = sku ?? name;
    if (!acc.has(key)) {
      acc.set(key, {
        sku,
        name,
        category,
        qty: 0,
        patties: 0,
        red: 0,
        chick: 0,
        rolls: 0,
        hits: new Set()
      });
    }
    const p = acc.get(key)!;
    p.qty += r.qty;
    p.hits.add(`${sku ?? 'no-sku'} :: ${name}`);

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

  // 4) Write cache atomically
  await db.$transaction(async tx => {
    await tx.$executeRaw`DELETE FROM analytics_shift_item WHERE shift_date = ${shiftDate}::date`;
    await tx.$executeRaw`DELETE FROM analytics_shift_category_summary WHERE shift_date = ${shiftDate}::date`;

    const byCat: Record<string, number> = {};
    for (const v of acc.values()) {
      byCat[v.category] = (byCat[v.category] ?? 0) + v.qty;
      await tx.$executeRaw`
        INSERT INTO analytics_shift_item
          (shift_date, from_ts, to_ts, sku, name, category, qty, patties, red_meat_g, chicken_g, rolls, raw_hits, updated_at)
        VALUES
          (${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz,
           ${v.sku}, ${v.name}, ${v.category}, ${v.qty}, ${v.patties}, ${v.red}, ${v.chick}, ${v.rolls},
           ${JSON.stringify(Array.from(v.hits))}::jsonb, now())
        ON CONFLICT (shift_date, COALESCE(sku, name))
        DO UPDATE SET
          qty=EXCLUDED.qty, patties=EXCLUDED.patties, red_meat_g=EXCLUDED.red_meat_g,
          chicken_g=EXCLUDED.chicken_g, rolls=EXCLUDED.rolls, raw_hits=EXCLUDED.raw_hits,
          from_ts=EXCLUDED.from_ts, to_ts=EXCLUDED.to_ts, updated_at=now()`;
    }

    for (const [category, items_total] of Object.entries(byCat)) {
      await tx.$executeRaw`
        INSERT INTO analytics_shift_category_summary
          (shift_date, from_ts, to_ts, category, items_total, updated_at)
        VALUES
          (${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz, ${category}, ${items_total}, now())
        ON CONFLICT (shift_date, category)
        DO UPDATE SET items_total=EXCLUDED.items_total, from_ts=EXCLUDED.from_ts, to_ts=EXCLUDED.to_ts, updated_at=now()`;
    }
  });

  // 5) Response
  const items = Array.from(acc.values())
    .sort((a, b) =>
      a.category === b.category
        ? a.name.localeCompare(b.name)
        : a.category.localeCompare(b.category)
    )
    .map(v => ({
      sku: v.sku,
      name: v.name,
      category: v.category,
      qty: v.qty,
      patties: v.patties,
      redMeatGrams: v.red,
      chickenGrams: v.chick,
      rolls: v.rolls
    }));

  const totalsByCategory = items.reduce((m: any, it) => {
    m[it.category] = (m[it.category] ?? 0) + it.qty;
    return m;
  }, {});

  return {
    shiftDate,
    fromISO,
    toISO,
    items,
    totalsByCategory,
    sourceUsed: 'live' as const
  };
}

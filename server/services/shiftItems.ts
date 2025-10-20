import { PrismaClient } from "@prisma/client";
import { shiftWindow } from "./time/shiftWindow";

const db = new PrismaClient();
const BEEF_G = 95;

export async function computeShift(dateISO: string) {
  const { shiftDate, fromISO, toISO } = shiftWindow(dateISO);

  const rows = await db.$queryRaw<{
    sku: string | null;
    name: string;
    qty: number;
  }[]>`
    SELECT ri.sku, COALESCE(c.name, ri.name) AS name, SUM(ri.quantity)::int AS qty
    FROM receipt_items ri
    JOIN receipts r ON r.id = ri."receiptId"
    LEFT JOIN item_catalog c ON c.sku = ri.sku
    WHERE r."createdAtUTC" >= ${fromISO}::timestamptz AND r."createdAtUTC" < ${toISO}::timestamptz
    GROUP BY ri.sku, COALESCE(c.name, ri.name)
    ORDER BY name`;

  const catalog = await db.$queryRaw<{
    sku: string;
    name: string;
    category: string;
    kind: string | null;
    patties_per: number | null;
    grams_per: number | null;
    rolls_per: number;
  }[]>`SELECT sku, name, category, kind, patties_per, grams_per, rolls_per FROM item_catalog WHERE active = true`;

  const catBySku = new Map(catalog.map((x) => [x.sku, x]));

  const per = new Map<
    string,
    {
      sku: string | null;
      name: string;
      category: string;
      qty: number;
      patties: number;
      red: number;
      chick: number;
      rolls: number;
      hits: Set<string>;
    }
  >();

  for (const r of rows) {
    const sku = r.sku?.trim() || null;
    const cat = (sku && catBySku.get(sku)?.category) || "other";
    const rule = sku ? catBySku.get(sku) || null : null;

    const name = rule?.name || r.name || sku || "UNKNOWN";
    const key = sku ?? name;
    if (!per.has(key))
      per.set(key, {
        sku,
        name,
        category: cat,
        qty: 0,
        patties: 0,
        red: 0,
        chick: 0,
        rolls: 0,
        hits: new Set(),
      });
    const p = per.get(key)!;
    p.qty += r.qty;
    p.hits.add(`${sku ?? "no-sku"} :: ${name}`);

    if (cat === "burger" && rule) {
      if (rule.kind === "beef") {
        const patties = (rule.patties_per ?? 1) * r.qty;
        p.patties += patties;
        p.red += patties * BEEF_G;
      } else if (rule.kind === "chicken") {
        p.chick += (rule.grams_per ?? 100) * r.qty;
      }
      p.rolls += (rule.rolls_per ?? 1) * r.qty;
    }
  }

  const perArray2 = [...per.values()];
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM analytics_shift_item WHERE shift_date = ${shiftDate}::date`;
    await tx.$executeRaw`DELETE FROM analytics_shift_category_summary WHERE shift_date = ${shiftDate}::date`;

    const byCat: Record<string, number> = {};
    for (const v of perArray2) {
      byCat[v.category] = (byCat[v.category] ?? 0) + v.qty;
      await tx.$executeRaw`
        INSERT INTO analytics_shift_item (shift_date, from_ts, to_ts, sku, name, category, qty, patties, red_meat_g, chicken_g, rolls, raw_hits, updated_at)
        VALUES (${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz,
                ${v.sku}, ${v.name}, ${v.category}, ${v.qty}, ${v.patties}, ${v.red}, ${v.chick}, ${v.rolls},
                ${JSON.stringify(Array.from(v.hits))}::jsonb, now())
        ON CONFLICT (shift_date, COALESCE(sku, name))
        DO UPDATE SET qty=EXCLUDED.qty, patties=EXCLUDED.patties, red_meat_g=EXCLUDED.red_meat_g,
                      chicken_g=EXCLUDED.chicken_g, rolls=EXCLUDED.rolls, raw_hits=EXCLUDED.raw_hits,
                      from_ts=EXCLUDED.from_ts, to_ts=EXCLUDED.to_ts, updated_at=now()`;
    }
    for (const [category, items_total] of Object.entries(byCat)) {
      await tx.$executeRaw`
        INSERT INTO analytics_shift_category_summary (shift_date, from_ts, to_ts, category, items_total, updated_at)
        VALUES (${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz, ${category}, ${items_total}, now())
        ON CONFLICT (shift_date, category)
        DO UPDATE SET items_total=EXCLUDED.items_total, from_ts=EXCLUDED.from_ts, to_ts=EXCLUDED.to_ts, updated_at=now()`;
    }
  });

  const perArray = [...per.values()];
  const items = perArray
    .sort((a, b) =>
      a.category === b.category
        ? a.name.localeCompare(b.name)
        : a.category.localeCompare(b.category)
    )
    .map((v) => ({
      sku: v.sku,
      name: v.name,
      category: v.category,
      qty: v.qty,
      patties: v.patties,
      redMeatGrams: v.red,
      chickenGrams: v.chick,
      rolls: v.rolls,
    }));
  const totalsByCategory = items.reduce((acc: any, it) => {
    acc[it.category] = (acc[it.category] ?? 0) + it.qty;
    return acc;
  }, {});
  return { shiftDate, fromISO, toISO, items, totalsByCategory };
}

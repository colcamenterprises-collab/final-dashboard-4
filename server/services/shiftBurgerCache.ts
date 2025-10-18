import { PrismaClient } from "@prisma/client";
import { computeMetrics } from "./burgerMetrics";

const prisma = new PrismaClient();

export async function buildAndSaveBurgerShiftCache(opts: {
  fromISO: string;
  toISO: string;
  shiftDateLabel: string;
  restaurantId?: string | null;
}) {
  const { fromISO, toISO, shiftDateLabel, restaurantId = null } = opts;

  const metrics = await computeMetrics(fromISO, toISO, shiftDateLabel);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM analytics_shift_burger_item
      WHERE shift_date = ${shiftDateLabel}::date
        AND (restaurant_id IS NOT DISTINCT FROM ${restaurantId})`;

    for (const p of metrics.products) {
      await tx.$executeRaw`
        INSERT INTO analytics_shift_burger_item
          (restaurant_id, shift_date, from_ts, to_ts, normalized_name,
           qty, patties, red_meat_g, chicken_g, rolls, raw_hits, created_at, updated_at)
        VALUES
          (${restaurantId}, ${shiftDateLabel}::date, ${metrics.fromISO}::timestamptz, ${metrics.toISO}::timestamptz,
           ${p.normalizedName}, ${p.qty}, ${p.patties}, ${p.redMeatGrams}, ${p.chickenGrams}, ${p.rolls},
           ${JSON.stringify(p.rawHits || [])}::jsonb, now(), now())
        ON CONFLICT (restaurant_id, shift_date, normalized_name)
        DO UPDATE SET
          qty = EXCLUDED.qty,
          patties = EXCLUDED.patties,
          red_meat_g = EXCLUDED.red_meat_g,
          chicken_g = EXCLUDED.chicken_g,
          rolls = EXCLUDED.rolls,
          raw_hits = EXCLUDED.raw_hits,
          from_ts = EXCLUDED.from_ts,
          to_ts = EXCLUDED.to_ts,
          updated_at = now()`;
    }

    await tx.$executeRaw`
      INSERT INTO analytics_shift_burger_summary
        (restaurant_id, shift_date, from_ts, to_ts,
         burgers_total, patties_total, red_meat_g_total, chicken_g_total, rolls_total,
         created_at, updated_at)
      VALUES
        (${restaurantId}, ${shiftDateLabel}::date, ${metrics.fromISO}::timestamptz, ${metrics.toISO}::timestamptz,
         ${metrics.totals.burgers}, ${metrics.totals.patties}, ${metrics.totals.redMeatGrams},
         ${metrics.totals.chickenGrams}, ${metrics.totals.rolls}, now(), now())
      ON CONFLICT (shift_date)
      DO UPDATE SET
        from_ts = EXCLUDED.from_ts,
        to_ts = EXCLUDED.to_ts,
        burgers_total = EXCLUDED.burgers_total,
        patties_total = EXCLUDED.patties_total,
        red_meat_g_total = EXCLUDED.red_meat_g_total,
        chicken_g_total = EXCLUDED.chicken_g_total,
        rolls_total = EXCLUDED.rolls_total,
        updated_at = now()`;
  });

  return metrics;
}

export async function readBurgerShiftCache(shiftDateLabel: string, restaurantId?: string | null) {
  const [summary, items] = await Promise.all([
    prisma.$queryRaw<
      { shift_date: string; from_ts: string; to_ts: string; burgers_total: number; patties_total: number; red_meat_g_total: number; chicken_g_total: number; rolls_total: number }[]
    >`
      SELECT shift_date::text, from_ts::text, to_ts::text,
             burgers_total, patties_total, red_meat_g_total, chicken_g_total, rolls_total
      FROM analytics_shift_burger_summary
      WHERE shift_date = ${shiftDateLabel}::date
        AND (restaurant_id IS NOT DISTINCT FROM ${restaurantId})
      LIMIT 1`,
    prisma.$queryRaw<
      { normalized_name: string; qty: number; patties: number; red_meat_g: number; chicken_g: number; rolls: number; raw_hits: any }[]
    >`
      SELECT normalized_name, qty, patties, red_meat_g, chicken_g, rolls, raw_hits
      FROM analytics_shift_burger_item
      WHERE shift_date = ${shiftDateLabel}::date
        AND (restaurant_id IS NOT DISTINCT FROM ${restaurantId})
      ORDER BY normalized_name ASC`
  ]);

  if (!summary.length) return null;

  return {
    shiftDate: shiftDateLabel,
    fromISO: summary[0].from_ts,
    toISO: summary[0].to_ts,
    totals: {
      burgers: summary[0].burgers_total,
      patties: summary[0].patties_total,
      redMeatGrams: summary[0].red_meat_g_total,
      chickenGrams: summary[0].chicken_g_total,
      rolls: summary[0].rolls_total,
    },
    products: items.map(r => ({
      normalizedName: r.normalized_name,
      qty: r.qty,
      patties: r.patties,
      redMeatGrams: r.red_meat_g,
      chickenGrams: r.chicken_g,
      rolls: r.rolls,
      rawHits: r.raw_hits ?? [],
    })),
  };
}

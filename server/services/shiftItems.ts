import { PrismaClient } from '@prisma/client';
import { shiftWindow } from './time/shiftWindow.js';

const db = new PrismaClient();
const BEEF_G = 95;

function normalizeCategory(category: string | null | undefined, name: string): string {
  const raw = `${category || ''} ${name || ''}`.toLowerCase();
  if (raw.includes('chicken') || raw.includes('nugget') || raw.includes('karaage')) return 'chicken';
  if (raw.includes('fries') || raw.includes('cajun') || raw.includes('sweet potato')) return 'fries';
  if (raw.includes('drink') || raw.includes('coke') || raw.includes('fanta') || raw.includes('water') || raw.includes('schweppes') || raw.includes('soda')) return 'drinks';
  if (raw.includes('burger') || raw.includes('smash')) return 'burger';
  if (raw.includes('side') || raw.includes('coleslaw')) return 'side';
  return 'other';
}

export async function computeShiftAll(dateISO: string) {
  const { shiftDate, fromISO, toISO } = shiftWindow(dateISO);

  // Internal POS is the only live sales source. Paid, non-cancelled POS/Grab
  // orders are counted once, including explicit set components stored by checkout.
  const lineItems = await db.$queryRaw<{
    sku: string | null;
    name: string;
    menu_category: string | null;
    qty: number;
  }[]>`
    SELECT i.source_sku AS sku,
           i.item_name_en AS name,
           c.name_en AS menu_category,
           SUM(i.quantity)::int AS qty
      FROM ordering_order_items i
      JOIN ordering_orders o ON o.id = i.order_id
      LEFT JOIN ordering_menu_items mi ON mi.id = i.menu_item_id
      LEFT JOIN ordering_menu_categories c ON c.id = mi.category_id
     WHERE o.created_at >= ${fromISO}::timestamptz
       AND o.created_at <  ${toISO}::timestamptz
       AND o.channel IN ('pos_direct','grab')
       AND o.payment_status = 'paid'
       AND o.status <> 'cancelled'
     GROUP BY i.source_sku, i.item_name_en, c.name_en
  `;

  const rawModifiers = await db.$queryRaw<{
    name: string;
    group_name: string | null;
    qty: number;
  }[]>`
    SELECT m.modifier_name_en AS name,
           m.modifier_group_name_en AS group_name,
           SUM(m.quantity)::int AS qty
      FROM ordering_order_item_modifiers m
      JOIN ordering_order_items i ON i.id = m.order_item_id
      JOIN ordering_orders o ON o.id = i.order_id
     WHERE o.created_at >= ${fromISO}::timestamptz
       AND o.created_at <  ${toISO}::timestamptz
       AND o.channel IN ('pos_direct','grab')
       AND o.payment_status = 'paid'
       AND o.status <> 'cancelled'
     GROUP BY m.modifier_name_en, m.modifier_group_name_en
  `;

  const [catalog, aliases] = await Promise.all([
    db.$queryRaw<{
      sku: string;
      name: string;
      category: string;
      kind: string | null;
      patties_per: number | null;
      grams_per: number | null;
      rolls_per: number | null;
      is_meal_set: boolean;
      base_sku: string | null;
    }[]>`
      SELECT sku, name, category, kind, patties_per, grams_per, rolls_per, is_meal_set, base_sku
        FROM item_catalog
       WHERE active = true
    `,
    db.$queryRaw<{ alias_name: string; sku: string }[]>`
      SELECT alias_name, sku FROM item_alias
    `.catch(() => [] as { alias_name: string; sku: string }[]),
  ]);

  const bySku = new Map(catalog.map(c => [c.sku, c]));
  const aliasSku = new Map(aliases.map(a => [String(a.alias_name).toLowerCase(), a.sku]));

  const accItems = new Map<string, {
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

  for (const row of lineItems) {
    const resolvedSku = row.sku || aliasSku.get(String(row.name).toLowerCase()) || null;
    const rule = resolvedSku ? bySku.get(resolvedSku) ?? null : null;
    const name = rule?.name ?? row.name;
    const category = rule?.category ?? normalizeCategory(row.menu_category, row.name);
    const key = resolvedSku ?? `${category}::${name}`;

    if (!accItems.has(key)) {
      accItems.set(key, { sku: resolvedSku, name, category, qty: 0, patties: 0, red: 0, chick: 0, rolls: 0, hits: new Set() });
    }
    const item = accItems.get(key)!;
    item.qty += Number(row.qty || 0);
    item.hits.add(`${resolvedSku ?? 'no-sku'} :: ${row.name}`);

    if (rule?.kind === 'beef' && rule.patties_per) {
      const patties = Number(rule.patties_per) * Number(row.qty || 0);
      item.patties += patties;
      item.red += patties * BEEF_G;
    } else if (rule?.kind === 'chicken' && rule.grams_per) {
      item.chick += Number(rule.grams_per) * Number(row.qty || 0);
    }
    if (rule?.rolls_per) item.rolls += Number(rule.rolls_per) * Number(row.qty || 0);
  }

  const accMods = new Map<string, { sku: string | null; name: string; category: string; qty: number; hits: Set<string> }>();
  for (const row of rawModifiers) {
    const resolvedSku = aliasSku.get(String(row.name).toLowerCase()) || null;
    const rule = resolvedSku ? bySku.get(resolvedSku) ?? null : null;
    const name = rule?.name ?? row.name;
    const key = resolvedSku ?? `${row.group_name || 'modifier'}::${name}`;
    if (!accMods.has(key)) accMods.set(key, { sku: resolvedSku, name, category: 'modifier', qty: 0, hits: new Set() });
    const mod = accMods.get(key)!;
    mod.qty += Number(row.qty || 0);
    mod.hits.add(`${row.group_name || 'Modifier'} :: ${row.name}`);
  }

  await db.$transaction(async tx => {
    await tx.$executeRaw`DELETE FROM analytics_shift_item WHERE shift_date=${shiftDate}::date`;
    await tx.$executeRaw`DELETE FROM analytics_shift_modifier WHERE shift_date=${shiftDate}::date`;
    await tx.$executeRaw`DELETE FROM analytics_shift_category_summary WHERE shift_date=${shiftDate}::date`;

    const byCat: Record<string, number> = {};
    for (const v of Array.from(accItems.values())) {
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

    for (const v of Array.from(accMods.values())) {
      byCat.modifier = (byCat.modifier ?? 0) + v.qty;
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

    for (const [category, total] of Object.entries(byCat)) {
      await tx.$executeRaw`
        INSERT INTO analytics_shift_category_summary
          (shift_date, from_ts, to_ts, category, items_total, updated_at)
        VALUES
          (${shiftDate}::date, ${fromISO}::timestamptz, ${toISO}::timestamptz, ${category}, ${total}, now())
        ON CONFLICT (shift_date, category) DO UPDATE
          SET items_total=EXCLUDED.items_total, from_ts=EXCLUDED.from_ts, to_ts=EXCLUDED.to_ts, updated_at=now()
      `;
    }
  });

  const items = Array.from(accItems.values()).sort((a,b) =>
    a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)
  ).map(v => ({
    sku: v.sku,
    name: v.name,
    category: v.category,
    qty: v.qty,
    patties: v.patties,
    redMeatGrams: v.red,
    chickenGrams: v.chick,
    rolls: v.rolls,
  }));

  const modifiers = Array.from(accMods.values()).sort((a,b) => a.name.localeCompare(b.name)).map(v => ({
    sku: v.sku,
    name: v.name,
    category: v.category,
    qty: v.qty,
  }));

  return { shiftDate, fromISO, toISO, items, modifiers, sourceUsed: 'sbb_pos_core' as const };
}

export async function computeShift(dateISO: string) {
  return computeShiftAll(dateISO);
}

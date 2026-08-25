import { pool } from "../../db";

function db() {
  if (!pool) throw new Error("Menu database is unavailable");
  return pool;
}

const map = (row: any) => ({
  id: String(row.id),
  directPriceDelta: Number(row.direct_price_delta ?? row.price_delta ?? 0),
  grabPriceDelta: Number(row.grab_price_delta ?? row.price_delta ?? 0),
  directEnabled: row.direct_enabled !== false,
  grabEnabled: row.grab_enabled !== false,
});

export async function listModifierChannelSettings() {
  const result = await db().query(`
    SELECT id, price_delta, direct_price_delta, grab_price_delta, direct_enabled, grab_enabled
    FROM ordering_item_modifiers
    ORDER BY id
  `);
  return result.rows.map(map);
}

export async function updateModifierChannelSettings(id: string, data: any) {
  const directPriceDelta = Number(data?.directPriceDelta ?? data?.priceDelta ?? 0);
  const grabPriceDelta = Number(data?.grabPriceDelta ?? data?.directPriceDelta ?? data?.priceDelta ?? 0);
  if (!Number.isFinite(directPriceDelta) || !Number.isFinite(grabPriceDelta)) throw new Error("Modifier prices must be valid numbers");
  const directEnabled = data?.directEnabled !== false;
  const grabEnabled = data?.grabEnabled !== false;
  if (!directEnabled && !grabEnabled) throw new Error("A modifier must be available on at least one channel");
  const result = await db().query(`
    UPDATE ordering_item_modifiers SET
      price_delta=$2,
      direct_price_delta=$2,
      grab_price_delta=$3,
      direct_enabled=$4,
      grab_enabled=$5,
      updated_at=NOW()
    WHERE id=$1
    RETURNING id, price_delta, direct_price_delta, grab_price_delta, direct_enabled, grab_enabled
  `, [id, directPriceDelta, grabPriceDelta, directEnabled, grabEnabled]);
  if (!result.rows[0]) throw new Error("Modifier option not found");
  return map(result.rows[0]);
}

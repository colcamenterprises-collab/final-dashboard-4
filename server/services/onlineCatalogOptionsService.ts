import { pool } from "../db";

export type OnlineOptionItem = {
  id: number;
  name: string;
  priceDelta: number;
};

export type OnlineOptionGroup = {
  id: number;
  name: string;
  min: number;
  max: number;
  required: boolean;
  sortOrder: number;
  options: OnlineOptionItem[];
};

let initPromise: Promise<void> | null = null;

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export async function ensureOnlineCatalogOptionTables() {
  if (!pool) return;

  if (!initPromise) {
    initPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS option_groups (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          min INTEGER NOT NULL DEFAULT 0,
          max INTEGER NOT NULL DEFAULT 1,
          required BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS option_items (
          id BIGSERIAL PRIMARY KEY,
          option_group_id BIGINT NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          price_delta NUMERIC(10,2) NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS catalog_item_option_groups (
          id BIGSERIAL PRIMARY KEY,
          catalog_item_id BIGINT NOT NULL REFERENCES online_catalog_items(id) ON DELETE CASCADE,
          option_group_id BIGINT NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (catalog_item_id, option_group_id)
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ciog_catalog_sort
          ON catalog_item_option_groups (catalog_item_id, sort_order, id)
      `);

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS option_items_group_name_unique
          ON option_items (option_group_id, name)
      `);

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS option_groups_name_unique
          ON option_groups (name)
      `);


      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_option_items_group_sort
          ON option_items (option_group_id, sort_order, id)
      `);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

export async function listCatalogItemOptionGroups(catalogItemId: number): Promise<OnlineOptionGroup[]> {
  await ensureOnlineCatalogOptionTables();
  if (!pool) return [];

  const groupsResult = await pool.query(
    `SELECT og.id, og.name, og.min, og.max, og.required, ciog.sort_order
     FROM catalog_item_option_groups ciog
     JOIN option_groups og ON og.id = ciog.option_group_id
     WHERE ciog.catalog_item_id = $1
     ORDER BY ciog.sort_order ASC, og.id ASC`,
    [catalogItemId],
  );

  if (groupsResult.rows.length === 0) return [];

  const groupIds = groupsResult.rows.map((row) => Number(row.id));
  const optionItemsResult = await pool.query(
    `SELECT id, option_group_id, name, price_delta
     FROM option_items
     WHERE option_group_id = ANY($1::bigint[])
     ORDER BY sort_order ASC, id ASC`,
    [groupIds],
  );

  const optionsByGroup = new Map<number, OnlineOptionItem[]>();
  for (const row of optionItemsResult.rows) {
    const groupId = Number(row.option_group_id);
    const current = optionsByGroup.get(groupId) ?? [];
    current.push({
      id: Number(row.id),
      name: String(row.name || ""),
      priceDelta: toNumber(row.price_delta),
    });
    optionsByGroup.set(groupId, current);
  }

  return groupsResult.rows.map((row) => {
    const groupId = Number(row.id);
    return {
      id: groupId,
      name: String(row.name || ""),
      min: Number(row.min || 0),
      max: Number(row.max || 1),
      required: Boolean(row.required),
      sortOrder: Number(row.sort_order || 0),
      options: optionsByGroup.get(groupId) ?? [],
    };
  });
}

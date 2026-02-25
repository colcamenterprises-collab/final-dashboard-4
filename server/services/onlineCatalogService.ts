import { pool } from "../db";

export type CatalogSourceType = "recipe" | "manual";

export type OnlineCatalogItem = {
  id: number;
  sourceType: CatalogSourceType;
  sourceId: number | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  price: number;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

let initPromise: Promise<void> | null = null;

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const mapRow = (row: any): OnlineCatalogItem => ({
  id: Number(row.id),
  sourceType: row.source_type,
  sourceId: row.source_id == null ? null : Number(row.source_id),
  name: String(row.name || ""),
  description: row.description == null ? null : String(row.description),
  imageUrl: row.image_url == null ? null : String(row.image_url),
  category: row.category == null ? null : String(row.category),
  price: toNumber(row.price),
  isPublished: Boolean(row.is_published),
  sortOrder: Number(row.sort_order || 0),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export async function ensureOnlineCatalogTable() {
  if (!pool) return;

  if (!initPromise) {
    initPromise = (async () => {
      await pool.query(`
        DO $$ BEGIN
          CREATE TYPE online_catalog_source_type AS ENUM ('recipe', 'manual');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS online_catalog_items (
          id BIGSERIAL PRIMARY KEY,
          source_type online_catalog_source_type NOT NULL,
          source_id BIGINT NULL,
          name TEXT NOT NULL,
          description TEXT,
          image_url TEXT,
          category TEXT,
          price NUMERIC(10,2) NOT NULL DEFAULT 0,
          is_published BOOLEAN NOT NULL DEFAULT false,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS online_catalog_recipe_source_unique
          ON online_catalog_items (source_type, source_id)
          WHERE source_type = 'recipe' AND source_id IS NOT NULL
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS online_catalog_published_idx
          ON online_catalog_items (is_published, category, sort_order, id)
      `);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

export async function listPublishedCatalogItems() {
  await ensureOnlineCatalogTable();
  if (!pool) return [];
  const result = await pool.query(
    `SELECT *
     FROM online_catalog_items
     WHERE is_published = true
     ORDER BY category ASC NULLS LAST, sort_order ASC, id ASC`,
  );

  return result.rows.map(mapRow);
}

export async function listAllCatalogItems() {
  await ensureOnlineCatalogTable();
  if (!pool) return [];
  const result = await pool.query(
    `SELECT *
     FROM online_catalog_items
     ORDER BY sort_order ASC, id ASC`,
  );
  return result.rows.map(mapRow);
}

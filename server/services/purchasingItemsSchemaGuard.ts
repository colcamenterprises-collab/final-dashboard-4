import type { Pool } from 'pg';

export interface PurchasingItemsSchemaGuardResult {
  ok: boolean;
  checkedFields: string[];
  warning?: string;
}

const REQUIRED_PURCHASING_ITEM_FIELDS = [
  'id',
  'item',
  'category',
  'supplierName',
  'orderUnit',
  'unitCost',
  'active',
] as const;

export async function checkPurchasingItemsSchemaGuard(pool: Pool): Promise<PurchasingItemsSchemaGuardResult> {
  try {
    await pool.query(`
      SELECT
        id,
        item,
        category,
        "supplierName",
        "orderUnit",
        "unitCost",
        active
      FROM purchasing_items
      LIMIT 1
    `);

    return {
      ok: true,
      checkedFields: [...REQUIRED_PURCHASING_ITEM_FIELDS],
    };
  } catch (error: any) {
    return {
      ok: false,
      checkedFields: [...REQUIRED_PURCHASING_ITEM_FIELDS],
      warning: error?.message || 'Unknown purchasing_items schema mismatch',
    };
  }
}

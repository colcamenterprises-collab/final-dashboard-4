import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { purchasingFieldMap, purchasingItems } from '@shared/schema';

const router = Router();

/**
 * GET /api/purchasing-field-keys
 * Returns all distinct field keys from daily_stock_v2.purchasingJson
 * with their current mapping status
 */
router.get('/field-keys', async (req: Request, res: Response) => {
  try {
    // 1. Get all distinct field keys from purchasingJson
    const fieldKeysResult = await db.execute(sql`
      SELECT DISTINCT jsonb_object_keys("purchasingJson") AS "fieldKey"
      FROM daily_stock_v2
      WHERE "purchasingJson" IS NOT NULL
      ORDER BY "fieldKey"
    `);

    const fieldKeys = fieldKeysResult.rows.map((row: any) => row.fieldKey);

    // 2. Get all existing mappings
    const mappingsResult = await db.execute(sql`
      SELECT 
        pfm.id,
        pfm."fieldKey",
        pfm."purchasingItemId",
        pi.item,
        pi.brand,
        pi."supplierName",
        pi."supplierSku",
        pi."unitDescription",
        pi."unitCost"
      FROM purchasing_field_map pfm
      INNER JOIN purchasing_items pi ON pfm."purchasingItemId" = pi.id
    `);

    const mappingsMap = new Map<string, any>();
    for (const row of mappingsResult.rows as any[]) {
      mappingsMap.set(row.fieldKey, {
        id: row.id,
        fieldKey: row.fieldKey,
        purchasingItemId: row.purchasingItemId,
        item: row.item,
        brand: row.brand,
        supplierName: row.supplierName,
        supplierSku: row.supplierSku,
        unitDescription: row.unitDescription,
        unitCost: row.unitCost ? Number(row.unitCost) : null,
      });
    }

    // 3. Build result with mapping status
    const result = fieldKeys.map((fieldKey: string) => {
      const mapping = mappingsMap.get(fieldKey);
      if (mapping) {
        return mapping;
      } else {
        return {
          fieldKey,
          purchasingItemId: null,
          item: null,
          brand: null,
          supplierName: null,
          supplierSku: null,
          unitDescription: null,
          unitCost: null,
        };
      }
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Error fetching purchasing field keys:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch field keys' });
  }
});

/**
 * GET /api/purchasing-items
 * Returns all purchasing items for dropdown selection
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const itemsResult = await db.execute(sql`
      SELECT 
        id,
        item,
        category,
        "supplierName",
        brand,
        "supplierSku",
        "orderUnit",
        "unitDescription",
        "unitCost",
        "lastReviewDate"
      FROM purchasing_items
      ORDER BY item, brand
    `);

    const items = itemsResult.rows.map((row: any) => ({
      id: row.id,
      item: row.item,
      category: row.category,
      supplierName: row.supplierName,
      brand: row.brand,
      supplierSku: row.supplierSku,
      orderUnit: row.orderUnit,
      unitDescription: row.unitDescription,
      unitCost: row.unitCost ? Number(row.unitCost) : null,
      lastReviewDate: row.lastReviewDate,
    }));

    return res.json(items);
  } catch (err: any) {
    console.error('Error fetching purchasing items:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch purchasing items' });
  }
});

/**
 * POST /api/purchasing-field-map
 * Upsert a field mapping (insert or update)
 */
router.post('/map', async (req: Request, res: Response) => {
  try {
    const { fieldKey, purchasingItemId } = req.body;

    if (!fieldKey || !purchasingItemId) {
      return res.status(400).json({ error: 'fieldKey and purchasingItemId are required' });
    }

    // Upsert: insert or update if fieldKey already exists
    await db.execute(sql`
      INSERT INTO purchasing_field_map ("fieldKey", "purchasingItemId")
      VALUES (${fieldKey}, ${purchasingItemId})
      ON CONFLICT ("fieldKey") DO UPDATE
      SET "purchasingItemId" = EXCLUDED."purchasingItemId"
    `);

    return res.json({ success: true, fieldKey, purchasingItemId });
  } catch (err: any) {
    console.error('Error saving field mapping:', err);
    return res.status(500).json({ error: err.message || 'Failed to save field mapping' });
  }
});

/**
 * DELETE /api/purchasing-field-map/:fieldKey
 * Delete a field mapping
 */
router.delete('/map/:fieldKey', async (req: Request, res: Response) => {
  try {
    const { fieldKey } = req.params;

    await db.execute(sql`
      DELETE FROM purchasing_field_map
      WHERE "fieldKey" = ${fieldKey}
    `);

    return res.json({ success: true, fieldKey });
  } catch (err: any) {
    console.error('Error deleting field mapping:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete field mapping' });
  }
});

export default router;

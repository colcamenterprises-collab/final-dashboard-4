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

/**
 * GET /api/purchasing/export/csv
 * Export all purchasing items as CSV
 */
router.get('/export/csv', async (req: Request, res: Response) => {
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
      ORDER BY category, item
    `);

    const headers = ['id', 'item', 'category', 'supplierName', 'brand', 'supplierSku', 'orderUnit', 'unitDescription', 'unitCost', 'lastReviewDate'];
    const csvLines = [headers.join(',')];
    
    for (const row of itemsResult.rows as any[]) {
      const csvRow = [
        row.id,
        `"${(row.item || '').replace(/"/g, '""')}"`,
        `"${(row.category || '').replace(/"/g, '""')}"`,
        `"${(row.supplierName || '').replace(/"/g, '""')}"`,
        `"${(row.brand || '').replace(/"/g, '""')}"`,
        `"${(row.supplierSku || '').replace(/"/g, '""')}"`,
        `"${(row.orderUnit || '').replace(/"/g, '""')}"`,
        `"${(row.unitDescription || '').replace(/"/g, '""')}"`,
        row.unitCost || '',
        `"${(row.lastReviewDate || '').replace(/"/g, '""')}"`,
      ];
      csvLines.push(csvRow.join(','));
    }
    
    const csvContent = csvLines.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="purchasing-items-export.csv"');
    console.log(`[/api/purchasing/export/csv] Exported ${itemsResult.rows.length} items`);
    res.send(csvContent);
  } catch (err: any) {
    console.error('Error exporting purchasing items:', err);
    return res.status(500).json({ error: err.message || 'Failed to export purchasing items' });
  }
});

/**
 * POST /api/purchasing/import/csv
 * Import purchasing items from CSV (upsert by item, supplierName, brand)
 */
router.post('/import/csv', async (req: Request, res: Response) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ error: 'csvData array required' });
    }

    let inserted = 0;
    let updated = 0;
    
    for (const row of csvData) {
      const item = (row.item || '').trim();
      const supplierName = (row.supplierName || '').trim();
      const brand = (row.brand || '').trim();
      
      if (!item) continue;
      
      const result = await db.execute(sql`
        INSERT INTO purchasing_items (
          item, category, "supplierName", brand, "supplierSku", 
          "orderUnit", "unitDescription", "unitCost", "lastReviewDate"
        )
        VALUES (
          ${item},
          ${row.category || null},
          ${supplierName || null},
          ${brand || null},
          ${row.supplierSku || null},
          ${row.orderUnit || null},
          ${row.unitDescription || null},
          ${row.unitCost ? parseFloat(row.unitCost) : null},
          ${row.lastReviewDate || null}
        )
        ON CONFLICT (item, "supplierName", brand) 
        DO UPDATE SET
          category = EXCLUDED.category,
          "supplierSku" = EXCLUDED."supplierSku",
          "orderUnit" = EXCLUDED."orderUnit",
          "unitDescription" = EXCLUDED."unitDescription",
          "unitCost" = EXCLUDED."unitCost",
          "lastReviewDate" = EXCLUDED."lastReviewDate",
          "updatedAt" = now()
        RETURNING (xmax = 0) AS is_insert
      `);
      
      const isInsert = (result.rows[0] as any)?.is_insert;
      if (isInsert) {
        inserted++;
      } else {
        updated++;
      }
    }
    
    console.log(`[/api/purchasing/import/csv] Imported: ${inserted} inserted, ${updated} updated`);
    return res.json({ success: true, inserted, updated });
  } catch (err: any) {
    console.error('Error importing purchasing items:', err);
    return res.status(500).json({ error: err.message || 'Failed to import purchasing items' });
  }
});

/**
 * POST /api/purchasing/items
 * Add a new purchasing item
 */
router.post('/items', async (req: Request, res: Response) => {
  try {
    const { item, category, supplierName, brand, supplierSku, orderUnit, unitDescription, unitCost, lastReviewDate } = req.body;
    
    if (!item) {
      return res.status(400).json({ error: 'item name is required' });
    }

    const result = await db.execute(sql`
      INSERT INTO purchasing_items (
        item, category, "supplierName", brand, "supplierSku", 
        "orderUnit", "unitDescription", "unitCost", "lastReviewDate"
      )
      VALUES (
        ${item},
        ${category || null},
        ${supplierName || null},
        ${brand || null},
        ${supplierSku || null},
        ${orderUnit || null},
        ${unitDescription || null},
        ${unitCost ? parseFloat(unitCost) : null},
        ${lastReviewDate || null}
      )
      RETURNING *
    `);
    
    console.log(`[/api/purchasing/items] Added item: ${item}`);
    return res.json({ success: true, item: result.rows[0] });
  } catch (err: any) {
    console.error('Error adding purchasing item:', err);
    return res.status(500).json({ error: err.message || 'Failed to add purchasing item' });
  }
});

export default router;

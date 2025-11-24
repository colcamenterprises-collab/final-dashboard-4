import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

type ShoppingListLine = {
  fieldKey: string;
  quantity: number;
  item: string;
  brand: string | null;
  supplier: string | null;
  sku: string | null;
  unitDescription: string | null;
  unitCost: number;
  lineTotal: number;
};

/**
 * Helper function to build shopping list from Daily Stock V2 record
 */
async function buildShoppingList(dailyStockId: string) {
  // 1) Load the Daily Stock V2 record
  const dailyStockResult = await db.execute(sql`
    SELECT * FROM daily_stock_v2 WHERE id = ${dailyStockId}
  `);

  if (dailyStockResult.rows.length === 0) {
    throw new Error('Daily stock record not found');
  }

  const dailyStock = dailyStockResult.rows[0] as any;

  // 2) Load field mappings + purchasing items
  const fieldMapsResult = await db.execute(sql`
    SELECT 
      pfm.id as map_id,
      pfm."fieldKey",
      pfm."purchasingItemId",
      pi.id as item_id,
      pi.item,
      pi.brand,
      pi."supplierName",
      pi."supplierSku",
      pi."unitDescription",
      pi."orderUnit",
      pi."unitCost"
    FROM purchasing_field_map pfm
    INNER JOIN purchasing_items pi ON pfm."purchasingItemId" = pi.id
  `);

  const lines: ShoppingListLine[] = [];

  for (const map of fieldMapsResult.rows as any[]) {
    const fieldKey = map.fieldKey;

    // Check if field exists in purchasingJson
    let qty = 0;
    if (dailyStock.purchasingJson && typeof dailyStock.purchasingJson === 'object') {
      const purchasingData = dailyStock.purchasingJson;
      if (fieldKey in purchasingData) {
        const qtyRaw = purchasingData[fieldKey];
        qty = typeof qtyRaw === 'number' ? qtyRaw : Number(qtyRaw ?? 0);
      }
    }

    if (!qty || qty <= 0) continue;

    const unitCostRaw = map.unitCost;
    if (unitCostRaw === null || unitCostRaw === undefined) {
      // If no purchasing item price, skip or include with lineTotal = 0
      continue;
    }

    const unitCost = Number(unitCostRaw);
    const lineTotal = qty * unitCost;

    lines.push({
      fieldKey,
      quantity: qty,
      item: map.item || '',
      brand: map.brand || null,
      supplier: map.supplierName || null,
      sku: map.supplierSku || null,
      unitDescription: map.unitDescription || map.orderUnit || null,
      unitCost,
      lineTotal,
    });
  }

  const grandTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  return {
    dailyStockId,
    lines,
    grandTotal,
  };
}

/**
 * GET /api/shopping-list/:dailyStockId
 * Returns shopping list in JSON format
 */
router.get('/:dailyStockId', async (req: Request, res: Response) => {
  try {
    const { dailyStockId } = req.params;
    const result = await buildShoppingList(dailyStockId);
    return res.json(result);
  } catch (err: any) {
    console.error('Error building shopping list:', err);
    return res.status(500).json({ error: err.message || 'Failed to build shopping list' });
  }
});

/**
 * GET /api/shopping-list/:dailyStockId/csv
 * Returns shopping list as downloadable CSV
 */
router.get('/:dailyStockId/csv', async (req: Request, res: Response) => {
  try {
    const { dailyStockId } = req.params;
    const result = await buildShoppingList(dailyStockId);
    const { lines, grandTotal } = result;

    const header = [
      'Item',
      'Brand',
      'SKU',
      'Supplier',
      'Unit description',
      'Quantity',
      'Unit cost',
      'Line total',
    ];

    const rows = lines.map((l) => [
      l.item,
      l.brand ?? '',
      l.sku ?? '',
      l.supplier ?? '',
      l.unitDescription ?? '',
      l.quantity.toString(),
      l.unitCost.toFixed(2),
      l.lineTotal.toFixed(2),
    ]);

    // Add grand total row
    rows.push(['', '', '', '', '', '', 'GRAND TOTAL', grandTotal.toFixed(2)]);

    const allRows = [header, ...rows];

    const csv = allRows
      .map((row) =>
        row
          .map((field) => {
            const f = String(field ?? '');
            // basic CSV escape
            return `"${f.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shopping-list-${dailyStockId}.csv"`
    );
    return res.send(csv);
  } catch (err: any) {
    console.error('Error exporting shopping list CSV:', err);
    return res.status(500).json({ error: err.message || 'Failed to export shopping list CSV' });
  }
});

export default router;

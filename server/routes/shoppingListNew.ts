/**
 * 🔒 CANONICAL PURCHASING FLOW (AUTO-SYNC)
 * purchasing_items → Form 2 → purchasing_shift_items → Shopping List
 *
 * RULES:
 * - Shopping List reads ONLY from purchasing_shift_items + purchasing_items
 * - NO reading from purchasingJson or payload
 * - This is a read-only view of shift purchases
 */
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
  category: string | null;
};

/**
 * 🔒 CANONICAL: Build shopping list from purchasing_shift_items (NOT from JSON)
 * Reads from: purchasing_shift_items JOIN purchasing_items
 * Uses dailyStockId to find the shift's purchases
 */
async function buildShoppingListFromShiftItems(stockId: string) {
  // Get the stock record and associated sales record
  const stockResult = await db.execute(sql`
    SELECT ds.id as stock_id, dsv."shiftDate", dsv.id as sales_id
    FROM daily_stock_v2 ds
    JOIN daily_sales_v2 dsv ON ds."salesId" = dsv.id
    WHERE ds.id = ${stockId}
    LIMIT 1
  `);

  if (stockResult.rows.length === 0) {
    throw new Error('Stock record not found');
  }

  const record = stockResult.rows[0] as any;
  const shiftDate = record.shiftDate;
  const salesId = record.sales_id;

  // Get all purchasing items for this shift from purchasing_shift_items
  const itemsResult = await db.execute(sql`
    SELECT 
      psi."purchasingItemId",
      psi.quantity,
      pi.item,
      pi.category,
      pi.brand,
      pi."supplierName",
      pi."supplierSku",
      pi."unitDescription",
      pi."orderUnit",
      pi."unitCost"
    FROM purchasing_shift_items psi
    JOIN purchasing_items pi ON psi."purchasingItemId" = pi.id
    WHERE psi."dailyStockId" = ${stockId}
      AND psi.quantity > 0
    ORDER BY pi.category, pi.item
  `);

  const lines: ShoppingListLine[] = [];

  for (const row of itemsResult.rows as any[]) {
    const qty = Number(row.quantity) || 0;
    if (qty <= 0) continue;

    const unitCost = Number(row.unitCost) || 0;
    const lineTotal = qty * unitCost;

    lines.push({
      fieldKey: `item-${row.purchasingItemId}`,
      quantity: qty,
      item: row.item,
      brand: row.brand || null,
      supplier: row.supplierName || null,
      sku: row.supplierSku || null,
      unitDescription: row.unitDescription || row.orderUnit || null,
      unitCost,
      lineTotal,
      category: row.category || null,
    });
  }

  const grandTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  return {
    salesId,
    stockId,
    shiftDate,
    lines,
    grandTotal,
    itemCount: lines.length,
  };
}

/**
 * LEGACY: Build shopping list from JSON payload (for backward compatibility)
 * @deprecated Use buildShoppingListFromShiftItems for new data
 */
async function buildShoppingListFromSales(salesId: string) {
  // 1) Load the Daily Sales V2 record
  const salesResult = await db.execute(sql`
    SELECT id, "shiftDate", payload FROM daily_sales_v2 WHERE id = ${salesId}
  `);

  if (salesResult.rows.length === 0) {
    throw new Error('Daily sales record not found');
  }

  const salesRecord = salesResult.rows[0] as any;
  const payload = salesRecord.payload || {};
  const purchasingJson = payload.purchasingJson || {};

  // 2) Load field mappings + purchasing items
  const fieldMapsResult = await db.execute(sql`
    SELECT 
      pfm.id as map_id,
      pfm."fieldKey",
      pfm."purchasingItemId",
      pi.id as item_id,
      pi.item,
      pi.category,
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
    if (fieldKey in purchasingJson) {
      const qtyRaw = purchasingJson[fieldKey];
      qty = typeof qtyRaw === 'number' ? qtyRaw : Number(qtyRaw ?? 0);
    }

    if (!qty || qty <= 0) continue;

    const unitCostRaw = map.unitCost;
    const unitCost = unitCostRaw ? Number(unitCostRaw) : 0;
    const lineTotal = qty * unitCost;

    lines.push({
      fieldKey,
      quantity: qty,
      item: map.item || fieldKey,
      brand: map.brand || null,
      supplier: map.supplierName || null,
      sku: map.supplierSku || null,
      unitDescription: map.unitDescription || map.orderUnit || null,
      unitCost,
      lineTotal,
      category: map.category || null,
    });
  }

  // Sort by category then item name
  lines.sort((a, b) => {
    const catA = a.category || 'ZZZ';
    const catB = b.category || 'ZZZ';
    if (catA !== catB) return catA.localeCompare(catB);
    return a.item.localeCompare(b.item);
  });

  const grandTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  return {
    salesId,
    shiftDate: salesRecord.shiftDate,
    lines,
    grandTotal,
    itemCount: lines.length,
  };
}

/**
 * 🔒 CANONICAL: GET /api/purchasing-list/latest
 * Returns shopping list from the most recent shift that has purchasing_shift_items
 * Reads from purchasing_shift_items table (NOT from JSON)
 * 
 * Query params:
 * - date: Optional YYYY-MM-DD business date to filter by
 * 
 * PATCH 8: Fixed to use shiftDate ordering, removed fallback to legacy JSON
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const requestedDate = req.query.date as string | undefined;
    
    let latestResult;
    
    if (requestedDate) {
      // Filter by specific business date
      // Match records where shiftDate starts with the requested date
      latestResult = await db.execute(sql`
        SELECT ds.id as stock_id, dsv."shiftDate"
        FROM daily_stock_v2 ds
        JOIN daily_sales_v2 dsv ON ds."salesId" = dsv.id
        JOIN purchasing_shift_items psi ON psi."dailyStockId" = ds.id
        WHERE dsv."deletedAt" IS NULL
          AND ds."deletedAt" IS NULL
          AND dsv."shiftDate"::date = ${requestedDate}::date
          AND psi.quantity > 0
        GROUP BY ds.id, dsv."shiftDate"
        ORDER BY dsv."shiftDate" DESC
        LIMIT 1
      `);
    } else {
      // Get most recent shift by shiftDate (not createdAt)
      latestResult = await db.execute(sql`
        SELECT ds.id as stock_id, dsv."shiftDate"
        FROM daily_stock_v2 ds
        JOIN daily_sales_v2 dsv ON ds."salesId" = dsv.id
        JOIN purchasing_shift_items psi ON psi."dailyStockId" = ds.id
        WHERE dsv."deletedAt" IS NULL
          AND ds."deletedAt" IS NULL
          AND psi.quantity > 0
        GROUP BY ds.id, dsv."shiftDate"
        ORDER BY dsv."shiftDate" DESC
        LIMIT 1
      `);
    }

    if (latestResult.rows.length === 0) {
      // NO FALLBACK - return clear message
      const noDataMessage = requestedDate 
        ? `NO PURCHASING DATA FOR ${requestedDate}` 
        : 'No purchasing data found';
      
      return res.json({ 
        salesId: null, 
        stockId: null,
        shiftDate: requestedDate || null,
        lines: [], 
        grandTotal: 0, 
        itemCount: 0,
        message: noDataMessage,
        noData: true,
        source: 'purchasing_shift_items'
      });
    }

    const stockId = (latestResult.rows[0] as any).stock_id;
    const result = await buildShoppingListFromShiftItems(stockId);
    return res.json({ ...result, source: 'purchasing_shift_items' });
  } catch (err: any) {
    console.error('Error getting latest shopping list:', err);
    return res.status(500).json({ error: err.message || 'Failed to get shopping list' });
  }
});

/**
 * GET /api/purchasing-list/:salesId
 * Returns shopping list for a specific Daily Sales V2 record
 */
router.get('/:salesId', async (req: Request, res: Response) => {
  try {
    const { salesId } = req.params;
    const result = await buildShoppingListFromSales(salesId);
    return res.json(result);
  } catch (err: any) {
    console.error('Error building shopping list:', err);
    return res.status(500).json({ error: err.message || 'Failed to build shopping list' });
  }
});

/**
 * GET /api/purchasing-list/:salesId/csv
 * Returns shopping list as downloadable CSV
 */
router.get('/:salesId/csv', async (req: Request, res: Response) => {
  try {
    const { salesId } = req.params;
    const result = await buildShoppingListFromSales(salesId);
    const { lines, grandTotal } = result;

    const header = [
      'Item',
      'Brand',
      'SKU',
      'Supplier',
      'Unit',
      'Qty',
      'Unit Cost (THB)',
      'Line Total (THB)',
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
            return `"${f.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shopping-list-${salesId}.csv"`
    );
    return res.send(csv);
  } catch (err: any) {
    console.error('Error exporting shopping list CSV:', err);
    return res.status(500).json({ error: err.message || 'Failed to export shopping list CSV' });
  }
});

/**
 * GET /api/purchasing-list/latest/csv
 * Returns shopping list CSV from the most recent form
 */
router.get('/latest/csv', async (req: Request, res: Response) => {
  try {
    // Find most recent daily_sales_v2 with purchasingJson
    const latestResult = await db.execute(sql`
      SELECT id FROM daily_sales_v2 
      WHERE payload->'purchasingJson' IS NOT NULL 
        AND payload->>'purchasingJson' != '{}'
        AND payload->>'purchasingJson' != 'null'
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC 
      LIMIT 1
    `);

    if (latestResult.rows.length === 0) {
      return res.status(404).json({ error: 'No Form 2 submissions with purchasing data found' });
    }

    const salesId = (latestResult.rows[0] as any).id;
    const result = await buildShoppingListFromSales(salesId);
    const { lines, grandTotal, shiftDate } = result;

    const header = [
      'Item',
      'Brand',
      'SKU',
      'Supplier',
      'Unit',
      'Qty',
      'Unit Cost (THB)',
      'Line Total (THB)',
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
            return `"${f.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shopping-list-${shiftDate || 'latest'}.csv"`
    );
    return res.send(csv);
  } catch (err: any) {
    console.error('Error exporting latest shopping list CSV:', err);
    return res.status(500).json({ error: err.message || 'Failed to export shopping list CSV' });
  }
});

export default router;

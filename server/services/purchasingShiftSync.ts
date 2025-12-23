/**
 * 🔐 PRODUCTION LOCK — DO NOT MODIFY
 * This file is part of the live Smash Brothers Burgers operations stack.
 * Changes here can break purchasing, P&L, shift analysis, or emails.
 *
 * Allowed actions:
 * - READ
 * - LOGGING ONLY (console.log)
 *
 * Any functional changes require owner approval.
 */
import { db } from '../db';
import { purchasingShiftItems, purchasingFieldMap, purchasingItems } from '../../shared/schema';
import { assertProductionWriteAllowed } from '../utils/productionGuard';
import { eq, sql, and, inArray } from 'drizzle-orm';

interface PurchasingItem {
  name?: string;
  item?: string;
  quantity?: number | string;
  category?: string;
}

export async function syncPurchasingShiftItems(
  dailyStockId: string,
  purchasingJson: PurchasingItem[] | Record<string, any> | null
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  if (!purchasingJson || !dailyStockId) {
    return { synced: 0, errors: ['No purchasing data or stock ID provided'] };
  }

  try {
    const fieldMappings = await db.select().from(purchasingFieldMap);
    const fieldKeyToItemId = new Map<string, number>();
    fieldMappings.forEach(m => {
      fieldKeyToItemId.set(m.fieldKey, m.purchasingItemId);
    });

    const allItems = await db.select().from(purchasingItems);
    const itemNameToId = new Map<string, number>();
    allItems.forEach(item => {
      itemNameToId.set(item.item.toLowerCase().trim(), item.id);
    });

    const itemsToUpsert: { purchasingItemId: number; quantity: number }[] = [];

    if (Array.isArray(purchasingJson)) {
      for (const item of purchasingJson) {
        const itemName = item.name || item.item;
        const qty = Number(item.quantity) || 0;
        
        if (!itemName || qty <= 0) continue;

        const normalizedName = itemName.toLowerCase().trim();
        const purchasingItemId = itemNameToId.get(normalizedName);

        if (purchasingItemId) {
          itemsToUpsert.push({ purchasingItemId, quantity: qty });
        } else {
          errors.push(`Item not found in purchasing_items: ${itemName}`);
        }
      }
    } else if (typeof purchasingJson === 'object') {
      for (const [fieldKey, value] of Object.entries(purchasingJson)) {
        const qty = Number(value) || 0;
        if (qty <= 0) continue;

        const purchasingItemId = fieldKeyToItemId.get(fieldKey);
        if (purchasingItemId) {
          itemsToUpsert.push({ purchasingItemId, quantity: qty });
        }
      }
    }

    assertProductionWriteAllowed('purchasing_shift_items');
    for (const { purchasingItemId, quantity } of itemsToUpsert) {
      try {
        await db.execute(sql`
          INSERT INTO purchasing_shift_items ("dailyStockId", "purchasingItemId", quantity, "createdAt", "updatedAt")
          VALUES (${dailyStockId}, ${purchasingItemId}, ${quantity}, NOW(), NOW())
          ON CONFLICT ("dailyStockId", "purchasingItemId")
          DO UPDATE SET quantity = EXCLUDED.quantity, "updatedAt" = NOW()
        `);
        synced++;
      } catch (err: any) {
        errors.push(`Failed to upsert item ${purchasingItemId}: ${err.message}`);
      }
    }

    console.log(`[purchasingShiftSync] Synced ${synced} items for stock ${dailyStockId}`);
    return { synced, errors };
  } catch (err: any) {
    console.error('[purchasingShiftSync] Error:', err);
    return { synced: 0, errors: [err.message] };
  }
}

export async function getPurchasingShiftMatrix(fromDate?: string, toDate?: string) {
  const defaultDays = 30;
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - defaultDays);

  const from = fromDate || defaultFrom.toISOString().slice(0, 10);
  const to = toDate || now.toISOString().slice(0, 10);

  const items = await db.select().from(purchasingItems).orderBy(purchasingItems.item);

  const shiftsResult = await db.execute(sql`
    SELECT ds.id, dsv2."shiftDate", ds."createdAt"
    FROM daily_stock_v2 ds
    JOIN daily_sales_v2 dsv2 ON ds."salesId" = dsv2.id
    WHERE dsv2."shiftDate" >= ${from}
      AND dsv2."shiftDate" <= ${to}
      AND dsv2."deletedAt" IS NULL
    ORDER BY dsv2."shiftDate" DESC
  `);

  const shifts = (shiftsResult.rows || []).map((r: any) => ({
    id: r.id,
    shiftDate: r.shiftDate,
    createdAt: r.createdAt
  }));

  const stockIds = shifts.map(s => s.id);

  let entries: any[] = [];
  if (stockIds.length > 0) {
    // Use IN clause with ARRAY constructor for proper PostgreSQL handling
    const stockIdsLiteral = stockIds.map(id => `'${id}'`).join(',');
    const entriesResult = await db.execute(sql.raw(`
      SELECT "dailyStockId", "purchasingItemId", quantity
      FROM purchasing_shift_items
      WHERE "dailyStockId" IN (${stockIdsLiteral})
    `));
    entries = (entriesResult.rows || []).map((r: any) => ({
      dailyStockId: r.dailyStockId,
      purchasingItemId: r.purchasingItemId,
      quantity: Number(r.quantity) || 0
    }));
  }

  return {
    items: items.map(i => ({
      id: i.id,
      item: i.item,
      brand: i.brand,
      supplierName: i.supplierName,
      supplierSku: i.supplierSku,
      unitDescription: i.unitDescription,
      category: i.category
    })),
    shifts,
    entries
  };
}

export async function backfillPurchasingShiftItems(): Promise<{ processed: number; synced: number; errors: string[] }> {
  const allErrors: string[] = [];
  let totalProcessed = 0;
  let totalSynced = 0;

  try {
    // First: sync from purchasingJson (legacy)
    const stockRecords = await db.execute(sql`
      SELECT id, "purchasingJson"
      FROM daily_stock_v2
      WHERE "purchasingJson" IS NOT NULL
        AND "deletedAt" IS NULL
    `);

    for (const record of (stockRecords.rows || [])) {
      totalProcessed++;
      const { synced, errors } = await syncPurchasingShiftItems(
        record.id as string,
        record.purchasingJson as any
      );
      totalSynced += synced;
      allErrors.push(...errors);
    }

    // Second: sync from mapped columns (burgerBuns, meatWeightG)
    const { synced: mappedSynced, errors: mappedErrors } = await syncFromMappedColumns();
    totalSynced += mappedSynced;
    allErrors.push(...mappedErrors);

    console.log(`[backfill] Processed ${totalProcessed} records, synced ${totalSynced} items`);
    return { processed: totalProcessed, synced: totalSynced, errors: allErrors };
  } catch (err: any) {
    console.error('[backfill] Error:', err);
    return { processed: totalProcessed, synced: totalSynced, errors: [err.message, ...allErrors] };
  }
}

/**
 * Sync purchasing_shift_items from mapped stock columns (burgerBuns, meatWeightG)
 * Uses purchasing_field_map to determine which columns map to which purchasing items
 */
export async function syncFromMappedColumns(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    // Get field mappings: fieldKey -> purchasingItemId
    const fieldMappings = await db.select().from(purchasingFieldMap);
    
    // Map: fieldKey (rollsEnd, meatEndKg) -> column name in daily_stock_v2 (burgerBuns, meatWeightG)
    const fieldToColumn: Record<string, string> = {
      'rollsEnd': 'burgerBuns',
      'meatEndKg': 'meatWeightG'
    };

    // Get all daily_stock_v2 records
    const stockRecords = await db.execute(sql`
      SELECT id, "burgerBuns", "meatWeightG"
      FROM daily_stock_v2
      WHERE "deletedAt" IS NULL
    `);

    assertProductionWriteAllowed('purchasing_shift_items');
    for (const record of (stockRecords.rows || [])) {
      const stockId = record.id as string;

      for (const mapping of fieldMappings) {
        const columnName = fieldToColumn[mapping.fieldKey];
        if (!columnName) continue;

        const value = (record as any)[columnName];
        const qty = Number(value) || 0;
        if (qty <= 0) continue;

        try {
          await db.execute(sql`
            INSERT INTO purchasing_shift_items ("dailyStockId", "purchasingItemId", quantity, "createdAt", "updatedAt")
            VALUES (${stockId}, ${mapping.purchasingItemId}, ${qty}, NOW(), NOW())
            ON CONFLICT ("dailyStockId", "purchasingItemId")
            DO UPDATE SET quantity = EXCLUDED.quantity, "updatedAt" = NOW()
          `);
          synced++;
        } catch (err: any) {
          errors.push(`Failed to sync mapped column ${columnName} for stock ${stockId}: ${err.message}`);
        }
      }
    }

    console.log(`[syncFromMappedColumns] Synced ${synced} items from mapped columns`);
    return { synced, errors };
  } catch (err: any) {
    console.error('[syncFromMappedColumns] Error:', err);
    return { synced: 0, errors: [err.message] };
  }
}

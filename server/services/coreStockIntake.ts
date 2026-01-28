/**
 * 🔒 CORE STOCK LOCK
 *
 * Rolls, Meat, and Drinks are FIRST-CLASS STOCK ITEMS.
 *
 * Rules:
 * - All purchases MUST enter via coreStockIntake
 * - No string matching (e.g. "bun", "roll") allowed
 * - No alternate write paths permitted
 * - Ledgers are the ONLY reconciliation mechanism
 *
 * Any change here requires explicit approval.
 */

/**
 * PATCH 2: CORE STOCK INTAKE SERVICE
 * Single source of truth for all rolls, meat, drinks stock purchases.
 * All entries write to stock_received_log with consistent item_type tagging.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

export type StockSource = 'EXPENSES_MODAL' | 'SHOPPING_LIST' | 'STOCK_MODAL' | 'MANUAL';

interface RollsPurchaseParams {
  date: string;
  qty: number;
  source: StockSource;
}

interface MeatPurchaseParams {
  date: string;
  grams: number;
  meatType?: string;
  source: StockSource;
}

interface DrinksPurchaseParams {
  date: string;
  sku: string;
  qty: number;
  source: StockSource;
}

export async function recordRollsPurchase({ date, qty, source }: RollsPurchaseParams): Promise<{ success: boolean; id?: number }> {
  try {
    if (qty <= 0) {
      console.warn('[CORE_STOCK] Rolls purchase skipped: qty <= 0');
      return { success: false };
    }

    await db.$executeRaw`
      INSERT INTO stock_received_log (shift_date, item_type, item_name, qty, source, paid, created_at)
      VALUES (${new Date(date)}, 'rolls', 'Burger Buns', ${qty}, ${source}, false, NOW())
    `;

    console.log(`[CORE_STOCK] Rolls purchase logged: ${qty} units from ${source}`);
    return { success: true };
  } catch (error) {
    console.error('[CORE_STOCK] Failed to record rolls purchase:', error);
    return { success: false };
  }
}

export async function recordMeatPurchase({ date, grams, meatType, source }: MeatPurchaseParams): Promise<{ success: boolean; id?: number }> {
  try {
    if (grams <= 0) {
      console.warn('[CORE_STOCK] Meat purchase skipped: grams <= 0');
      return { success: false };
    }

    const itemName = meatType || 'Beef';

    await db.$executeRaw`
      INSERT INTO stock_received_log (shift_date, item_type, item_name, qty, weight_g, source, paid, created_at)
      VALUES (${new Date(date)}, 'meat', ${itemName}, 1, ${grams}, ${source}, false, NOW())
    `;

    console.log(`[CORE_STOCK] Meat purchase logged: ${grams}g ${itemName} from ${source}`);
    return { success: true };
  } catch (error) {
    console.error('[CORE_STOCK] Failed to record meat purchase:', error);
    return { success: false };
  }
}

export async function recordDrinksPurchase({ date, sku, qty, source }: DrinksPurchaseParams): Promise<{ success: boolean; id?: number }> {
  try {
    if (qty <= 0) {
      console.warn('[CORE_STOCK] Drinks purchase skipped: qty <= 0');
      return { success: false };
    }

    await db.$executeRaw`
      INSERT INTO stock_received_log (shift_date, item_type, item_name, qty, source, paid, created_at)
      VALUES (${new Date(date)}, 'drinks', ${sku}, ${qty}, ${source}, false, NOW())
    `;

    console.log(`[CORE_STOCK] Drinks purchase logged: ${qty}x ${sku} from ${source}`);
    return { success: true };
  } catch (error) {
    console.error('[CORE_STOCK] Failed to record drinks purchase:', error);
    return { success: false };
  }
}

export async function recordBulkDrinksPurchase({ date, drinks, source }: { date: string; drinks: Record<string, number>; source: StockSource }): Promise<{ success: boolean; count: number }> {
  let count = 0;
  for (const [sku, qty] of Object.entries(drinks)) {
    if (qty > 0) {
      const result = await recordDrinksPurchase({ date, sku, qty, source });
      if (result.success) count++;
    }
  }
  return { success: count > 0, count };
}

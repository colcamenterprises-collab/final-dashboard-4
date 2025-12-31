/**
 * 🔒 POST-RECEIPT DERIVATION ONLY
 * 
 * This worker processes receipts after they are ingested and triggers
 * the ingredient cascade to derive COGS data.
 * 
 * RULES:
 * - DO NOT attach this to UI
 * - Trigger only after receipts are fully ingested
 */

import { processSoldItems } from '../services/ingredientCascade';

type SoldItemInput = {
  id: string;
  name: string;
  shiftId: string;
  quantity?: number;
};

/**
 * Process sold items from a receipt batch.
 * Called after receipts are fully ingested.
 */
export async function processReceiptSoldItems(soldItems: SoldItemInput[]): Promise<void> {
  if (soldItems.length === 0) {
    console.log('[PostReceiptProcessor] No sold items to process');
    return;
  }

  console.log(`[PostReceiptProcessor] Processing ${soldItems.length} sold items`);
  
  try {
    await processSoldItems(soldItems);
    console.log('[PostReceiptProcessor] Completed ingredient cascade');
  } catch (error) {
    console.error('[PostReceiptProcessor] Error processing sold items:', error);
    throw error;
  }
}

/**
 * Convert a receipt with items JSON to sold item format.
 * Use this to transform posReceipt data for cascade processing.
 */
export function extractSoldItemsFromReceipt(
  receiptId: string,
  shiftId: string,
  itemsJson: Array<{ name: string; qty?: number; quantity?: number }>
): SoldItemInput[] {
  return itemsJson.map((item, index) => ({
    id: `${receiptId}-${index}`,
    name: item.name,
    shiftId,
    quantity: item.qty || item.quantity || 1,
  }));
}

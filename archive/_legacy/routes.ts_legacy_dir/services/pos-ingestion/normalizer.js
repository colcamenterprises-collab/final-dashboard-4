/**
 * Normalize POS data into our database format
 */

/**
 * Map Loyverse payment method to our PaymentMethod enum
 */
function mapPaymentMethod(loyverseMethod) {
  const methodMap = {
    'CASH': 'CASH',
    'CARD': 'CARD', 
    'CREDIT_CARD': 'CARD',
    'DEBIT_CARD': 'CARD',
    'QR': 'QR',
    'WALLET': 'WALLET',
    'DELIVERY_PARTNER': 'DELIVERY_PARTNER',
    'OTHER': 'OTHER'
  };
  return methodMap[loyverseMethod?.toUpperCase()] || 'OTHER';
}

/**
 * Map Loyverse channel to our SalesChannel enum
 */
function mapSalesChannel(loyverseChannel) {
  const channelMap = {
    'IN_STORE': 'IN_STORE',
    'GRAB': 'GRAB',
    'FOODPANDA': 'FOODPANDA',
    'LINE_MAN': 'LINE_MAN',
    'ONLINE': 'ONLINE'
  };
  return channelMap[loyverseChannel?.toUpperCase()] || 'OTHER';
}

/**
 * Convert currency amount to cents (assuming THB)
 */
function toCents(amount) {
  return Math.round((amount || 0) * 100);
}

/**
 * Normalize Loyverse receipt to our database format
 */
export function normalizeReceipt(loyverseReceipt, restaurantId) {
  // Make externalId truly unique across stores and time
  const externalId = 
    loyverseReceipt.id ||
    loyverseReceipt.receipt_id ||
    loyverseReceipt.receipt_uuid ||
    `${loyverseReceipt.store_id || 'store'}:${loyverseReceipt.receipt_number}`;
  
  const receiptNumber = loyverseReceipt.receipt_number;
  
  if (!externalId) {
    console.error('❌ Missing unique identifier in receipt:', Object.keys(loyverseReceipt));
    throw new Error(`Missing unique ID in Loyverse data: ${JSON.stringify(loyverseReceipt).substring(0, 200)}`);
  }
  
  const receipt = {
    restaurantId,
    provider: 'LOYVERSE',
    externalId: externalId,
    receiptNumber: receiptNumber,
    channel: mapSalesChannel(loyverseReceipt.channel),
    createdAtUTC: new Date(loyverseReceipt.created_at),
    closedAtUTC: loyverseReceipt.closed_at ? new Date(loyverseReceipt.closed_at) : null,
    subtotal: toCents(loyverseReceipt.subtotal_money ?? loyverseReceipt.subtotal ?? (loyverseReceipt.total_money - loyverseReceipt.total_tax)),
    tax: toCents(loyverseReceipt.tax_money ?? loyverseReceipt.total_tax ?? loyverseReceipt.tax ?? 0),
    discount: toCents(loyverseReceipt.discount_money ?? loyverseReceipt.total_discount ?? loyverseReceipt.discount ?? 0),
    total: toCents(loyverseReceipt.total_money ?? loyverseReceipt.total ?? 0),
    notes: loyverseReceipt.note,
    rawPayload: loyverseReceipt
  };

  // Helper to safely get string values
  const s = (val) => val ? String(val).trim() : null;
  
  const items = (loyverseReceipt.line_items || []).map(item => ({
    providerItemId: item.id,
    sku: s(item.sku) || s(item.item_id) || s(item.handle) || null,
    name: s(item.item_name) || s(item.name) || s(item.title) || 'Unknown Item',
    category: s(item.category) || 'GENERAL',
    qty: item.quantity || 1,
    unitPrice: toCents(item.price),
    total: toCents(item.total_money || item.total),
    modifiers: item.line_modifiers || item.modifiers || null
  }));

  const payments = (loyverseReceipt.payments || []).map(payment => ({
    method: mapPaymentMethod(payment.method || payment.type || payment.payment_type),
    amount: toCents(payment.money_amount || payment.amount || 0),
    meta: payment.payment_details || payment.meta || null
  }));

  return { receipt, items, payments };
}

/**
 * Normalize Loyverse menu item to our database format
 */
export function normalizeMenuItem(loyverseItem, restaurantId) {
  return {
    restaurantId,
    sku: loyverseItem.sku || loyverseItem.id,
    name: loyverseItem.name,
    category: loyverseItem.category || 'Uncategorized',
    portionGrams: loyverseItem.portion_grams || null,
    isDrink: loyverseItem.category?.toLowerCase().includes('drink') || false,
    isBurger: loyverseItem.category?.toLowerCase().includes('burger') || false,
    active: loyverseItem.active !== false,
    meta: loyverseItem
  };
}
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
  // Loyverse uses receipt_number as the unique identifier (not an 'id' field)
  const receiptNumber = loyverseReceipt.receipt_number;
  const externalId = receiptNumber; // Use receipt_number as externalId
  
  if (!externalId) {
    console.error('❌ Missing receipt_number in receipt:', Object.keys(loyverseReceipt));
    throw new Error(`Missing receipt_number in Loyverse data: ${JSON.stringify(loyverseReceipt).substring(0, 200)}`);
  }
  
  const receipt = {
    restaurantId,
    provider: 'LOYVERSE',
    externalId: externalId,
    receiptNumber: receiptNumber,
    channel: mapSalesChannel(loyverseReceipt.channel),
    createdAtUTC: new Date(loyverseReceipt.created_at),
    closedAtUTC: loyverseReceipt.closed_at ? new Date(loyverseReceipt.closed_at) : null,
    subtotal: toCents(loyverseReceipt.total_money - loyverseReceipt.total_tax),
    tax: toCents(loyverseReceipt.total_tax),
    discount: toCents(loyverseReceipt.total_discount),
    total: toCents(loyverseReceipt.total_money),
    notes: loyverseReceipt.note,
    rawPayload: loyverseReceipt
  };

  const items = (loyverseReceipt.line_items || []).map(item => ({
    providerItemId: item.id,
    sku: item.sku,
    name: item.item_name || item.name || 'Unknown Item',
    category: item.category || 'GENERAL',
    qty: item.quantity || 1,
    unitPrice: toCents(item.price),
    total: toCents(item.total_money || item.total),
    modifiers: item.line_modifiers || item.modifiers || null
  }));

  const payments = (loyverseReceipt.payments || []).map(payment => ({
    method: mapPaymentMethod(payment.type || payment.method),
    amount: toCents(payment.money_amount || payment.amount),
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
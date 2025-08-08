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
    'QR': 'QR',
    'WALLET': 'WALLET',
    'DELIVERY_PARTNER': 'DELIVERY_PARTNER'
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
  const receipt = {
    restaurantId,
    provider: 'LOYVERSE',
    externalId: loyverseReceipt.id,
    receiptNumber: loyverseReceipt.number,
    channel: mapSalesChannel(loyverseReceipt.channel),
    createdAtUTC: new Date(loyverseReceipt.created_at),
    closedAtUTC: loyverseReceipt.closed_at ? new Date(loyverseReceipt.closed_at) : null,
    subtotal: toCents(loyverseReceipt.total_money - loyverseReceipt.tax_money),
    tax: toCents(loyverseReceipt.tax_money),
    discount: toCents(loyverseReceipt.discount_money),
    total: toCents(loyverseReceipt.total_money),
    notes: loyverseReceipt.note,
    rawPayload: loyverseReceipt
  };

  const items = (loyverseReceipt.line_items || []).map(item => ({
    providerItemId: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    qty: item.quantity || 1,
    unitPrice: toCents(item.price),
    total: toCents(item.total),
    modifiers: item.modifiers || null
  }));

  const payments = (loyverseReceipt.payments || []).map(payment => ({
    method: mapPaymentMethod(payment.method),
    amount: toCents(payment.amount),
    meta: payment.meta || null
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
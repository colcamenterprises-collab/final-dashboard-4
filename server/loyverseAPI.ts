// Loyverse live API access is retired.
// This compatibility facade preserves legacy imports and historical tooling types,
// but every live API operation is disabled. Historical database records are untouched.

interface LoyverseReceipt { id: string; receipt_number: string; receipt_date: string; total_money: number; total_tax: number; receipt_type: 'SALE' | 'REFUND'; line_items: any[]; payments: any[]; customer_id?: string; source: 'POS' | 'API'; dining_option: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'; store_id: string; pos_device_id: string; employee_id?: string; created_at: string; updated_at: string; }
interface LoyverseItem { id: string; item_name: string; category_id: string; cost: number; price: number; sku?: string; barcode?: string; description?: string; is_composite: boolean; use_production: boolean; color: string; image_url?: string; variants: any[]; created_at: string; updated_at: string; deleted_at?: string; }
interface LoyverseCategory { id: string; category_name: string; color: string; created_at: string; updated_at: string; deleted_at?: string; }
interface LoyverseCustomer { id: string; name: string; email?: string; phone_number?: string; address?: string; city?: string; region?: string; postal_code?: string; country_code?: string; note?: string; created_at: string; updated_at: string; deleted_at?: string; }
interface LoyverseStore { id: string; name: string; description?: string; contact_name?: string; contact_phone?: string; contact_email?: string; address?: string; postal_code?: string; city?: string; region?: string; country_code?: string; timezone: string; created_at: string; updated_at: string; deleted_at?: string; }
interface LoyverseShift { id: string; opening_time: string; closing_time?: string; opening_note?: string; closing_note?: string; opening_amount: number; expected_amount: number; actual_amount?: number; store_id: string; pos_device_id: string; employee_id?: string; created_at: string; updated_at: string; }
interface LoyverseModifier { id: string; name: string; cost: number; price?: number; created_at: string; updated_at: string; deleted_at?: string; }
interface LoyversePaymentType { id: string; name: string; type: 'CASH' | 'CARD' | 'EXTERNAL' | 'OTHER'; mapping_id?: string; created_at: string; updated_at: string; deleted_at?: string; }

const disabled = (): never => {
  throw new Error('Loyverse live API is retired. SBB POS is the live source of truth.');
};

class LoyverseAPI {
  constructor() {
    console.log('[Loyverse] Legacy API client disabled — historical data retained');
  }

  async getReceipts(_params: { start_time?: string; end_time?: string; limit?: number; cursor?: string } = {}): Promise<{ receipts: LoyverseReceipt[]; cursor?: string }> { return disabled(); }
  async getShifts(_params: { start_time?: string; end_time?: string; limit?: number; cursor?: string } = {}): Promise<{ shifts: LoyverseShift[]; cursor?: string }> { return disabled(); }
  async getItems(_params: { limit?: number; cursor?: string; updated_at_min?: string } = {}): Promise<{ items: LoyverseItem[]; cursor?: string }> { return disabled(); }
  async getCategories(_params: { limit?: number; cursor?: string } = {}): Promise<{ categories: LoyverseCategory[]; cursor?: string }> { return disabled(); }
  async getModifiers(_params: { limit?: number; cursor?: string } = {}): Promise<{ modifiers: LoyverseModifier[]; cursor?: string }> { return disabled(); }
  async getPaymentTypes(): Promise<{ payment_types: LoyversePaymentType[] }> { return disabled(); }
  async getCustomers(_params: { limit?: number; cursor?: string; updated_at_min?: string } = {}): Promise<{ customers: LoyverseCustomer[]; cursor?: string }> { return disabled(); }
  async getStores(): Promise<{ stores: LoyverseStore[] }> { return disabled(); }
  async testConnection(): Promise<boolean> { return false; }
  async getLastCompletedShiftData(): Promise<{ receipts: LoyverseReceipt[]; shiftPeriod: { start: Date; end: Date }; totalSales: number; receiptCount: number }> { return disabled(); }
  async syncTodaysReceipts(): Promise<number> { return disabled(); }
}

export const loyverseAPI = new LoyverseAPI();

export type {
  LoyverseReceipt,
  LoyverseItem,
  LoyverseCategory,
  LoyverseCustomer,
  LoyverseStore,
  LoyverseShift,
  LoyverseModifier,
  LoyversePaymentType
};

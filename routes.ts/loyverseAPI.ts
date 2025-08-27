import { storage } from './storage';

interface LoyverseConfig {
  baseURL: string;
  accessToken: string;
}

// Receipt interface according to official Loyverse API docs
interface LoyverseReceipt {
  id: string;
  receipt_number: string;
  receipt_date: string; // UTC ISO 8601 format
  total_money: number;
  total_tax: number;
  receipt_type: 'SALE' | 'REFUND';
  line_items: Array<{
    id: string;
    item_id: string;
    variant_id: string;
    item_name: string;
    quantity: number;
    cost: number;
    price: number;
    line_total: number;
    line_tax: number;
    modifiers_cost: number;
    modifiers: Array<{
      id: string;
      name: string;
      cost: number;
    }>;
  }>;
  payments: Array<{
    id: string;
    payment_type_id: string;
    amount: number;
  }>;
  customer_id?: string;
  source: 'POS' | 'API';
  dining_option: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  store_id: string;
  pos_device_id: string;
  employee_id?: string;
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
}

// Item interface according to official Loyverse API docs
interface LoyverseItem {
  id: string;
  item_name: string;
  category_id: string;
  cost: number;
  price: number;
  sku?: string;
  barcode?: string;
  description?: string;
  is_composite: boolean;
  use_production: boolean;
  color: string;
  image_url?: string;
  option1_name?: string;
  option1_value?: string;
  option2_name?: string;
  option2_value?: string;
  option3_name?: string;
  option3_value?: string;
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
  deleted_at?: string; // UTC ISO 8601 format
  variants: Array<{
    variant_id: string;
    item_id: string;
    sku?: string;
    cost: number;
    price: number;
    default_pricing_type: 'FIXED' | 'VARIABLE';
    option1_value?: string;
    option2_value?: string;
    option3_value?: string;
    stores: Array<{
      store_id: string;
      pricing_type: 'FIXED' | 'VARIABLE';
      price: number;
      cost: number;
      inventory_tracking: boolean;
      track_quantity: boolean;
      current_stock: number;
      ideal_stock?: number;
      low_stock?: number;
    }>;
  }>;
}

// Category interface according to official Loyverse API docs
interface LoyverseCategory {
  id: string;
  category_name: string;
  color: string;
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
  deleted_at?: string; // UTC ISO 8601 format
}

// Customer interface according to official Loyverse API docs
interface LoyverseCustomer {
  id: string;
  name: string;
  email?: string;
  phone_number?: string;
  address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country_code?: string;
  note?: string;
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
  deleted_at?: string; // UTC ISO 8601 format
}

// Store interface according to official Loyverse API docs
interface LoyverseStore {
  id: string;
  name: string;
  description?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  region?: string;
  country_code?: string;
  timezone: string;
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
}

// Shift interface according to official Loyverse API docs
interface LoyverseShift {
  id: string;
  opening_time: string; // UTC ISO 8601 format
  closing_time?: string; // UTC ISO 8601 format
  opening_note?: string;
  closing_note?: string;
  opening_amount: number;
  expected_amount: number;
  actual_amount?: number;
  store_id: string;
  pos_device_id: string;
  employee_id?: string;
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
}

// Modifier interface according to official Loyverse API docs
interface LoyverseModifier {
  id: string;
  name: string;
  cost: number;
  price?: number;
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
  deleted_at?: string; // UTC ISO 8601 format
}

// Payment Type interface according to official Loyverse API docs
interface LoyversePaymentType {
  id: string;
  name: string;
  type: 'CASH' | 'CARD' | 'EXTERNAL' | 'OTHER';
  mapping_id?: string;
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
  deleted_at?: string; // UTC ISO 8601 format
}

class LoyverseAPI {
  private config: LoyverseConfig;

  constructor() {
    // Use the correct access token for Smash Bros Burgers (Rawai)
    const correctToken = 'c1ba07b4dc304101b8dbff63107a3d87';
    
    this.config = {
      baseURL: 'https://api.loyverse.com/v1.0',
      accessToken: correctToken
    };

    console.log('🔧 Loyverse API initialized with token:', this.config.accessToken ? `${this.config.accessToken.substring(0, 8)}...` : 'NOT SET');
    
    if (!this.config.accessToken) {
      console.warn('⚠️ Loyverse access token not configured');
    }
  }

  // Utility function to convert UTC dates to Bangkok timezone (UTC+7)
  private convertUTCToBangkok(utcDateString: string): Date {
    const utcDate = new Date(utcDateString);
    const bangkokOffset = 7 * 60; // 7 hours in minutes
    const bangkokTime = new Date(utcDate.getTime() + (bangkokOffset * 60 * 1000));
    return bangkokTime;
  }

  // Utility function to convert Bangkok time to UTC for API requests
  private convertBangkokToUTC(bangkokDate: Date): string {
    const bangkokOffset = 7 * 60; // 7 hours in minutes
    const utcTime = new Date(bangkokDate.getTime() - (bangkokOffset * 60 * 1000));
    return utcTime.toISOString();
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    console.log(`🔗 Loyverse API: ${options.method || 'GET'} ${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Loyverse API Error (${response.status}):`, errorText);
      throw new Error(`Loyverse API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Loyverse API Success: ${endpoint}`);
    return data;
  }

  // CRITICAL API: Get List of Receipts
  async getReceipts(params: {
    start_time?: string;
    end_time?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ receipts: LoyverseReceipt[]; cursor?: string }> {
    const queryParams = new URLSearchParams();
    
    if (params.start_time) queryParams.append('start_time', params.start_time);
    if (params.end_time) queryParams.append('end_time', params.end_time);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.cursor) queryParams.append('cursor', params.cursor);

    const endpoint = `/receipts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.makeRequest<{ receipts: LoyverseReceipt[]; cursor?: string }>(endpoint);
  }

  // CRITICAL API: Get List of Shifts
  async getShifts(params: {
    start_time?: string;
    end_time?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ shifts: LoyverseShift[]; cursor?: string }> {
    const queryParams = new URLSearchParams();
    
    if (params.start_time) queryParams.append('start_time', params.start_time);
    if (params.end_time) queryParams.append('end_time', params.end_time);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.cursor) queryParams.append('cursor', params.cursor);

    const endpoint = `/shifts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.makeRequest<{ shifts: LoyverseShift[]; cursor?: string }>(endpoint);
  }

  // API: Get List of Items
  async getItems(params: {
    limit?: number;
    cursor?: string;
    updated_at_min?: string;
  } = {}): Promise<{ items: LoyverseItem[]; cursor?: string }> {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.cursor) queryParams.append('cursor', params.cursor);
    if (params.updated_at_min) queryParams.append('updated_at_min', params.updated_at_min);

    const endpoint = `/items${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.makeRequest<{ items: LoyverseItem[]; cursor?: string }>(endpoint);
  }

  // API: Get List of Categories
  async getCategories(params: {
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ categories: LoyverseCategory[]; cursor?: string }> {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.cursor) queryParams.append('cursor', params.cursor);

    const endpoint = `/categories${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.makeRequest<{ categories: LoyverseCategory[]; cursor?: string }>(endpoint);
  }

  // API: Get List of Modifiers
  async getModifiers(params: {
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ modifiers: LoyverseModifier[]; cursor?: string }> {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.cursor) queryParams.append('cursor', params.cursor);

    const endpoint = `/modifiers${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.makeRequest<{ modifiers: LoyverseModifier[]; cursor?: string }>(endpoint);
  }

  // CRITICAL API: Get List of Payment Types
  async getPaymentTypes(): Promise<{ payment_types: LoyversePaymentType[] }> {
    return this.makeRequest<{ payment_types: LoyversePaymentType[] }>('/payment_types');
  }

  // API: Get List of Customers
  async getCustomers(params: {
    limit?: number;
    cursor?: string;
    updated_at_min?: string;
  } = {}): Promise<{ customers: LoyverseCustomer[]; cursor?: string }> {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.cursor) queryParams.append('cursor', params.cursor);
    if (params.updated_at_min) queryParams.append('updated_at_min', params.updated_at_min);

    const endpoint = `/customers${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.makeRequest<{ customers: LoyverseCustomer[]; cursor?: string }>(endpoint);
  }

  // API: Get List of Stores
  async getStores(): Promise<{ stores: LoyverseStore[] }> {
    return this.makeRequest<{ stores: LoyverseStore[] }>('/stores');
  }

  // Test API connection
  async testConnection(): Promise<boolean> {
    try {
      await this.getStores();
      return true;
    } catch (error) {
      console.error('❌ Loyverse connection test failed:', error);
      return false;
    }
  }

  // Get last completed shift data for historical reporting (not live)
  async getLastCompletedShiftData(): Promise<{
    receipts: LoyverseReceipt[];
    shiftPeriod: { start: Date; end: Date };
    totalSales: number;
    receiptCount: number;
  }> {
    try {
      const now = new Date();
      const bangkokTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      
      let shiftStartTime: Date;
      let shiftEndTime: Date;
      
      // Always get the LAST COMPLETED shift (not current/ongoing)
      if (bangkokTime.getHours() >= 3) {
        // After 3am - show the shift that just ended (6pm yesterday to 3am today)
        shiftStartTime = new Date(bangkokTime);
        shiftStartTime.setDate(shiftStartTime.getDate() - 1);
        shiftStartTime.setHours(18, 0, 0, 0);
        shiftEndTime = new Date(bangkokTime);
        shiftEndTime.setHours(3, 0, 0, 0);
      } else {
        // Before 3am - show the previous completed shift (6pm two days ago to 3am yesterday)
        shiftStartTime = new Date(bangkokTime);
        shiftStartTime.setDate(shiftStartTime.getDate() - 2);
        shiftStartTime.setHours(18, 0, 0, 0);
        shiftEndTime = new Date(bangkokTime);
        shiftEndTime.setDate(shiftEndTime.getDate() - 1);
        shiftEndTime.setHours(3, 0, 0, 0);
      }
      
      // Convert Bangkok times to UTC for API call
      const utcShiftStart = this.convertBangkokToUTC(shiftStartTime);
      const utcShiftEnd = this.convertBangkokToUTC(shiftEndTime);
      
      console.log(`📊 Getting LAST COMPLETED shift data (Bangkok): ${shiftStartTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} to ${shiftEndTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}`);

      // Fetch first page of receipts only for KPI calculation (faster response)
      const response = await this.getReceipts({
        start_time: utcShiftStart,
        end_time: utcShiftEnd,
        limit: 100 // Reduced limit for faster response
      });
      
      const allReceipts = response.receipts;

      // Calculate total sales
      const totalSales = allReceipts.reduce((sum, receipt) => {
        return sum + (receipt.receipt_type === 'SALE' ? receipt.total_money : -receipt.total_money);
      }, 0);

      return {
        receipts: allReceipts,
        shiftPeriod: { start: shiftStartTime, end: shiftEndTime },
        totalSales,
        receiptCount: allReceipts.length
      };
    } catch (error) {
      console.error('Failed to get last completed shift data:', error);
      return {
        receipts: [],
        shiftPeriod: { start: new Date(), end: new Date() },
        totalSales: 0,
        receiptCount: 0
      };
    }
  }

  // Sync last completed shift receipts (historical data)
  async syncTodaysReceipts(): Promise<number> {
    try {
      const shiftData = await this.getLastCompletedShiftData();
      
      // Store receipts in database
      for (const receipt of shiftData.receipts) {
        await this.storeReceiptData(receipt);
      }

      console.log(`✅ Synced ${shiftData.receiptCount} receipts for last completed shift (${shiftData.totalSales} baht)`);
      return shiftData.receiptCount;
    } catch (error) {
      console.error('❌ Error syncing receipts:', error);
      throw error;
    }
  }

  // Store receipt data in database with complete item and modifier details
  private async storeReceiptData(receipt: LoyverseReceipt): Promise<void> {
    try {
      // Import database modules
      const { db } = await import('./db');
      const { loyverseReceipts } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      // Check if receipt already exists to avoid duplicates
      const existingReceipt = await db.select()
        .from(loyverseReceipts)
        .where(eq(loyverseReceipts.receipt_id, receipt.id))
        .limit(1);

      if (existingReceipt.length > 0) {
        return; // Receipt already stored
      }

      // Enhanced item details with modifiers
      const enhancedItems = receipt.line_items.map(item => ({
        id: item.id,
        item_id: item.item_id,
        variant_id: item.variant_id,
        item_name: item.item_name,
        quantity: item.quantity,
        cost: item.cost,
        price: item.price,
        line_total: item.line_total,
        line_tax: item.line_tax,
        modifiers_cost: item.modifiers_cost,
        modifiers: item.modifiers.map(modifier => ({
          id: modifier.id,
          name: modifier.name,
          cost: modifier.cost
        }))
      }));

      // Enhanced payment details
      const paymentDetails = receipt.payments.map(payment => ({
        id: payment.id,
        payment_type_id: payment.payment_type_id,
        amount: payment.amount
      }));

      // Store enhanced receipt data
      const receiptData = {
        receipt_id: receipt.id,
        receipt_number: receipt.receipt_number,
        receipt_date: new Date(receipt.receipt_date),
        total_amount: receipt.total_money,
        payment_method: receipt.payments[0]?.payment_type_id || 'Unknown',
        customer_info: receipt.customer_id ? { customer_id: receipt.customer_id } : null,
        items: enhancedItems,
        tax_amount: receipt.total_tax,
        discount_amount: 0, // Will be calculated from line items if needed
        staff_member: receipt.employee_id || 'System',
        table_number: null,
        shift_date: new Date(receipt.receipt_date),
        raw_data: {
          receipt_type: receipt.receipt_type,
          source: receipt.source,
          dining_option: receipt.dining_option,
          store_id: receipt.store_id,
          pos_device_id: receipt.pos_device_id,
          payments: paymentDetails,
          line_items: enhancedItems,
          created_at: receipt.created_at,
          updated_at: receipt.updated_at
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      // Insert into loyverse_receipts table for detailed storage
      await db.insert(loyverseReceipts).values(receiptData);

      // Also store in transactions table for compatibility
      const transaction = {
        orderId: receipt.receipt_number,
        amount: receipt.total_money.toString(),
        paymentMethod: receipt.payments[0]?.payment_type_id || 'Unknown',
        timestamp: new Date(receipt.receipt_date),
        items: receipt.line_items.map(item => ({
          itemId: parseInt(item.item_id) || 0,
          quantity: item.quantity,
          price: item.price,
          name: item.item_name,
          modifiers: item.modifiers
        })),
        staffMember: receipt.employee_id || 'System',
        tableNumber: null
      };

      await storage.createTransaction(transaction);
      console.log(`📝 Enhanced receipt ${receipt.receipt_number}: ฿${receipt.total_money} with ${receipt.line_items.length} items and ${receipt.line_items.reduce((sum, item) => sum + item.modifiers.length, 0)} modifiers`);
    } catch (error) {
      console.error('❌ Error storing enhanced receipt data:', error);
    }
  }
}

// Export singleton instance
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
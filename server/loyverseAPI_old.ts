import { storage } from './storage';

interface LoyverseConfig {
  baseURL: string;
  accessToken: string;
}

// Standard UTC date/time format as per Loyverse API docs
interface LoyverseDateTimeResponse {
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
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

interface LoyverseCategory {
  id: string;
  category_name: string;
  color: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

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
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

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
  created_at: string;
  updated_at: string;
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

// Category interface according to official Loyverse API docs
interface LoyverseCategory {
  id: string;
  category_name: string;
  color: string;
  created_at: string; // UTC ISO 8601 format
  updated_at: string; // UTC ISO 8601 format
  deleted_at?: string; // UTC ISO 8601 format
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
    // Temporary fix for Replit environment variable caching issue
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
    // Bangkok is UTC+7
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

  // Receipts API
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

  async getReceiptById(receiptId: string): Promise<LoyverseReceipt> {
    return this.makeRequest<LoyverseReceipt>(`/receipts/${receiptId}`);
  }

  // Items API
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

  async getItemById(itemId: string): Promise<LoyverseItem> {
    return this.makeRequest<LoyverseItem>(`/items/${itemId}`);
  }

  async updateItem(itemId: string, itemData: Partial<LoyverseItem>): Promise<LoyverseItem> {
    return this.makeRequest<LoyverseItem>(`/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    });
  }

  // Customers API
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

  async createCustomer(customerData: {
    name: string;
    email?: string;
    phone_number?: string;
    address?: string;
    city?: string;
    region?: string;
    postal_code?: string;
    country_code?: string;
    note?: string;
  }): Promise<LoyverseCustomer> {
    return this.makeRequest<LoyverseCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  }

  // Stores API
  async getStores(): Promise<{ stores: LoyverseStore[] }> {
    return this.makeRequest<{ stores: LoyverseStore[] }>('/stores');
  }

  // Categories API - Critical for proper item organization
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

  // Modifiers API - Critical for accurate sales analysis
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

  // Payment Types API - Critical for payment analysis
  async getPaymentTypes(): Promise<{ payment_types: LoyversePaymentType[] }> {
    return this.makeRequest<{ payment_types: LoyversePaymentType[] }>('/payment_types');
  }

  // Shifts API
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

  // Sync Methods with Bangkok timezone support (6pm-3am shift cycle)
  async syncTodaysReceipts(): Promise<number> {
    try {
      // Get current shift time range in Bangkok timezone
      const now = new Date();
      const bangkokTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      
      let shiftStartTime: Date;
      let shiftEndTime: Date;
      
      // If current Bangkok time is between 6pm and 11:59pm, we're in today's shift
      if (bangkokTime.getHours() >= 18) {
        // Current shift: 6pm today to 3am tomorrow (Bangkok time)
        shiftStartTime = new Date(bangkokTime);
        shiftStartTime.setHours(18, 0, 0, 0);
        shiftEndTime = new Date(bangkokTime);
        shiftEndTime.setDate(shiftEndTime.getDate() + 1);
        shiftEndTime.setHours(3, 0, 0, 0);
      } else if (bangkokTime.getHours() < 6) {
        // We're in the early morning of ongoing shift from yesterday
        shiftStartTime = new Date(bangkokTime);
        shiftStartTime.setDate(shiftStartTime.getDate() - 1);
        shiftStartTime.setHours(18, 0, 0, 0);
        shiftEndTime = new Date(bangkokTime);
        shiftEndTime.setHours(3, 0, 0, 0);
      } else {
        // Between 6am and 6pm - no active shift, get yesterday's shift
        shiftStartTime = new Date(bangkokTime);
        shiftStartTime.setDate(shiftStartTime.getDate() - 1);
        shiftStartTime.setHours(18, 0, 0, 0);
        shiftEndTime = new Date(bangkokTime);
        shiftEndTime.setHours(3, 0, 0, 0);
      }
      
      // Convert Bangkok times back to UTC for API call
      const utcShiftStart = new Date(shiftStartTime.getTime() - (7 * 60 * 60 * 1000));
      const utcShiftEnd = new Date(shiftEndTime.getTime() - (7 * 60 * 60 * 1000));
      
      console.log(`📅 Bangkok Time: ${bangkokTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}`);
      console.log(`🕰️ Shift Period (Bangkok): ${shiftStartTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} to ${shiftEndTime.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })}`);
      console.log(`📊 Syncing receipts from ${utcShiftStart.toISOString()} to ${utcShiftEnd.toISOString()}`);

      let allReceipts: LoyverseReceipt[] = [];
      let cursor: string | undefined;
      
      do {
        const response = await this.getReceipts({
          start_time: utcShiftStart.toISOString(),
          end_time: utcShiftEnd.toISOString(),
          limit: 250,
          cursor
        });
        
        allReceipts.push(...response.receipts);
        cursor = response.cursor;
      } while (cursor);

      // Convert and store receipts
      for (const receipt of allReceipts) {
        await this.storeReceiptData(receipt);
      }

      console.log(`✅ Synced ${allReceipts.length} receipts for current shift`);
      return allReceipts.length;
    } catch (error) {
      console.error('❌ Error syncing receipts:', error);
      throw error;
    }
  }

  async syncAllItems(): Promise<number> {
    try {
      console.log('📦 Syncing all menu items from Loyverse...');

      let allItems: LoyverseItem[] = [];
      let cursor: string | undefined;
      
      do {
        const response = await this.getItems({
          limit: 250,
          cursor
        });
        
        allItems.push(...response.items);
        cursor = response.cursor;
      } while (cursor);

      // Convert and store items
      for (const item of allItems) {
        await this.storeItemData(item);
      }

      console.log(`✅ Synced ${allItems.length} menu items`);
      return allItems.length;
    } catch (error) {
      console.error('❌ Error syncing items:', error);
      throw error;
    }
  }

  async syncCustomers(): Promise<number> {
    try {
      console.log('👥 Syncing customers from Loyverse...');

      let allCustomers: LoyverseCustomer[] = [];
      let cursor: string | undefined;
      
      do {
        const response = await this.getCustomers({
          limit: 250,
          cursor
        });
        
        allCustomers.push(...response.customers);
        cursor = response.cursor;
      } while (cursor);

      console.log(`✅ Synced ${allCustomers.length} customers`);
      return allCustomers.length;
    } catch (error) {
      console.error('❌ Error syncing customers:', error);
      throw error;
    }
  }

  private async storeReceiptData(receipt: LoyverseReceipt): Promise<void> {
    try {
      // Convert Loyverse receipt to our transaction format
      const transaction = {
        orderId: receipt.receipt_number,
        amount: receipt.total_money.toString(),
        paymentMethod: receipt.payments[0]?.payment_type_id || 'Unknown',
        timestamp: new Date(receipt.receipt_date),
        items: receipt.line_items.map(item => ({
          itemId: parseInt(item.item_id) || 0,
          quantity: item.quantity,
          price: item.price
        })),
        staffMember: receipt.employee_id || 'Unknown',
        tableNumber: null
      };

      await storage.createTransaction(transaction);
    } catch (error) {
      console.error('Error storing receipt data:', error);
    }
  }

  private async storeItemData(item: LoyverseItem): Promise<void> {
    try {
      // Convert Loyverse item to our menu item format
      const menuItem = {
        name: item.item_name,
        price: item.price.toString(),
        cost: item.cost.toString(),
        category: item.category_id || 'Uncategorized',
        ingredients: [] as string[] // Will need to be populated separately or from description
      };

      await storage.createMenuItem(menuItem);

      // Also update inventory if tracking
      const variant = item.variants?.[0];
      if (variant?.stores?.[0]) {
        const store = variant.stores[0];
        const inventory = {
          name: item.item_name,
          currentStock: store.current_stock,
          minStock: store.low_stock || 0,
          maxStock: store.ideal_stock || 100,
          unit: 'units',
          supplier: 'Loyverse POS',
          costPerUnit: store.cost.toString()
        };

        // Note: You may want to add createInventory method or update existing
      }
    } catch (error) {
      console.error('Error storing item data:', error);
    }
  }

  // Real-time polling method
  async startRealtimeSync(intervalMinutes: number = 5): Promise<void> {
    console.log(`🔄 Starting real-time Loyverse sync every ${intervalMinutes} minutes`);
    
    const sync = async () => {
      try {
        await this.syncTodaysReceipts();
      } catch (error) {
        console.error('Real-time sync error:', error);
      }
    };

    // Initial sync
    await sync();
    
    // Set up interval
    setInterval(sync, intervalMinutes * 60 * 1000);
  }

  // Health check
  async testConnection(): Promise<boolean> {
    try {
      await this.getStores();
      console.log('✅ Loyverse API connection successful');
      return true;
    } catch (error) {
      console.error('❌ Loyverse API connection failed:', error);
      return false;
    }
  }
}

export const loyverseAPI = new LoyverseAPI();
export type { LoyverseReceipt, LoyverseItem, LoyverseCustomer, LoyverseStore, LoyverseShift };
/**
 * Loyverse API adapter - ONLY file allowed to call Loyverse directly
 */
import axios from 'axios';

const BASE = process.env.LOYVERSE_BASE_URL || 'https://api.loyverse.com/v1.0';
const TOKEN = process.env.LOYVERSE_API_TOKEN;
const USE_MOCK = (process.env.USE_MOCK_LOYVERSE || 'false') === 'true';

// Helper: HTTP client with auth
function client() {
  if (!BASE) throw new Error('LOYVERSE_BASE_URL missing');
  if (!TOKEN && !USE_MOCK) throw new Error('LOYVERSE_API_TOKEN missing');
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${TOKEN}` },
    timeout: 30000
  });
}

/**
 * Fetch receipts in a time window with pagination.
 * @param {Date} startUTC
 * @param {Date} endUTC
 * @param {string|null} cursor
 * @returns {Promise<{receipts:any[], nextCursor:string|null}>}
 */
export async function fetchReceiptsWindow(startUTC, endUTC, cursor = null) {
  if (USE_MOCK) {
    return {
      receipts: [{
        id: 'mock-receipt-1',
        number: 'R-1001',
        created_at: new Date().toISOString(),
        line_items: [{
          id: 'mock-item-1',
          sku: 'BURGER_SINGLE',
          name: 'Single Burger',
          category: 'Burgers',
          quantity: 2,
          price: 15000,
          total: 30000,
          modifiers: [{ name: 'Bacon', price: 3000 }]
        }],
        payments: [{ method: 'CASH', amount: 30000 }],
        total_money: 30000,
        discount_money: 0,
        tax_money: 0,
        channel: 'IN_STORE'
      }],
      nextCursor: null
    };
  }

  try {
    const httpClient = client();
    const params = {
      created_at_min: startUTC.toISOString(),
      created_at_max: endUTC.toISOString(),
      limit: 250
    };
    
    if (cursor) {
      params.cursor = cursor;
    }

    const response = await httpClient.get('/receipts', { params });
    
    return {
      receipts: response.data.receipts || [],
      nextCursor: response.data.cursor || null
    };
  } catch (error) {
    console.error('Loyverse API error:', error.message);
    throw new Error(`Loyverse API failed: ${error.message}`);
  }
}

/**
 * Fetch menu items from Loyverse
 */
export async function fetchMenuItems() {
  if (USE_MOCK) {
    return [
      {
        id: 'mock-item-1',
        sku: 'BURGER_SINGLE',
        name: 'Single Burger',
        category: 'Burgers',
        price: 15000,
        active: true
      }
    ];
  }

  try {
    const httpClient = client();
    const response = await httpClient.get('/items');
    return response.data.items || [];
  } catch (error) {
    console.error('Loyverse menu items error:', error.message);
    throw new Error(`Loyverse menu items failed: ${error.message}`);
  }
}
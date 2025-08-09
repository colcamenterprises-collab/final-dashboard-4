/**
 * Loyverse API adapter - ONLY file allowed to call Loyverse directly
 */
import axios from 'axios';
// Import not needed in adapter - timezone conversion happens in ingester

const BASE = process.env.LOYVERSE_BASE_URL || 'https://api.loyverse.com/v1.0';
const TOKEN = process.env.LOYVERSE_API_TOKEN || process.env.LOYVERSE_ACCESS_TOKEN;
const STORE_ID = process.env.LOYVERSE_STORE_ID;

// Bulletproof token resolution - no more mock surprises
if (!TOKEN) throw new Error('Missing Loyverse access token (LOYVERSE_API_TOKEN or LOYVERSE_ACCESS_TOKEN)');

// Helper: HTTP client with auth
function client() {
  if (!BASE) throw new Error('LOYVERSE_BASE_URL missing');
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${TOKEN}` },
    timeout: 30000
  });
}

/**
 * Fetch receipts in a time window with pagination.
 * @param {string} startISO - UTC ISO string
 * @param {string} endISO - UTC ISO string  
 * @param {string|null} cursor
 * @returns {Promise<{receipts:any[], nextCursor:string|null}>}
 */
export async function fetchReceiptsWindow(startISO, endISO, cursor = null) {
  const httpClient = client();
  const params = { 
    created_at_min: startISO, 
    created_at_max: endISO, 
    limit: 250 
  };
  
  // Store filter for multi-outlet support
  if (STORE_ID) {
    params.store_id = STORE_ID;
  }
  
  // Pagination cursor
  if (cursor) {
    params.page_token = cursor; // Use correct Loyverse pagination parameter
  }

  console.log('Fetching receipts page...', {
    start: startISO,
    end: endISO,
    cursor,
    store_id: STORE_ID || 'all_stores'
  });

  const response = await httpClient.get('/receipts', { params });
  const receipts = Array.isArray(response.data?.receipts) ? response.data.receipts : [];
  const nextCursor = response.data?.next_page_token || response.data?.nextCursor || null;

  console.log(`Fetched ${receipts.length} receipts`, { nextCursor });
  
  // Sample timestamp logging for timezone debugging
  if (receipts[0]) {
    console.log('Sample created_at:', receipts[0].created_at);
  }
  
  return {
    receipts,
    nextCursor
  };
}

/**
 * Fetch menu items from Loyverse
 */
export async function fetchMenuItems() {
  const httpClient = client();
  const params = {};
  
  // Store filter for menu items
  if (STORE_ID) {
    params.store_id = STORE_ID;
  }
  
  const response = await httpClient.get('/items', { params });
  return response.data.items || [];
}
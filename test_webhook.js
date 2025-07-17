#!/usr/bin/env node

/**
 * Test Webhook Functionality
 * This script simulates a webhook call to test the signature validation
 */

import crypto from 'crypto';

// Test configuration
const TEST_SECRET = process.env.LOYVERSE_WEBHOOK_SECRET || 'wh_secret_3f9a2b1c8d7e6f5g4h3i2j1k0l9m8n7o';
const TEST_ENDPOINT = 'http://localhost:5000/api/loyverse-webhook';

// Sample webhook payload with proper structure
const testPayload = {
  event: 'receipts.created',
  data: {
    id: 'test_receipt_123',
    receipt_number: 'R001',
    receipt_date: new Date().toISOString(),
    total_money: 100.00,
    total_tax: 5.00,
    total_discount: 0.00,
    payments: [
      {
        payment_type_id: 'cash',
        amount: 100.00
      }
    ],
    line_items: [
      {
        id: 'item_1',
        name: 'Test Item',
        quantity: 1,
        price: 100.00
      }
    ],
    employee_id: 'test_employee',
    customer_id: null,
    created_at: new Date().toISOString()
  }
};

// Generate signature using SHA-1 with base64 (matching our implementation)
function generateSignature(payload, secret) {
  const payloadString = JSON.stringify(payload);
  return crypto.createHmac('sha1', secret).update(payloadString).digest('base64');
}

// Test webhook call
async function testWebhook() {
  console.log('🧪 Testing webhook functionality...');
  
  const signature = generateSignature(testPayload, TEST_SECRET);
  console.log('📝 Generated signature:', signature);
  
  try {
    const response = await fetch(TEST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-loyverse-signature': signature
      },
      body: JSON.stringify(testPayload)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
      console.log('📊 Response:', result);
    } else {
      console.log('❌ Webhook test failed!');
      console.log('📊 Error:', result);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Run test
testWebhook();
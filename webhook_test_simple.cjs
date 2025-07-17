#!/usr/bin/env node

/**
 * Simple Webhook Test
 * This test verifies the webhook signature validation is working correctly
 */

const crypto = require('crypto');
const http = require('http');

// Test configuration
const TEST_SECRET = process.env.LOYVERSE_WEBHOOK_SECRET || 'wh_secret_3f9a2b1c8d7e6f5g4h3i2j1k0l9m8n7o';

// Simple test payload
const testPayload = {
  event: 'receipts.created',
  data: {
    id: 'test_receipt_456',
    receipt_number: 'R002',
    receipt_date: '2025-07-17T12:00:00Z',
    total_money: 50.00,
    payments: [{ payment_type_id: 'cash', amount: 50.00 }],
    line_items: []
  }
};

// Generate signature
const payloadString = JSON.stringify(testPayload);
const signature = crypto.createHmac('sha1', TEST_SECRET).update(payloadString).digest('base64');

console.log('Testing webhook with payload:', JSON.stringify(testPayload, null, 2));
console.log('Generated signature:', signature);

// Make HTTP request
const postData = payloadString;
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/loyverse-webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-loyverse-signature': signature,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', body);
    if (res.statusCode === 200) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed!');
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(postData);
req.end();
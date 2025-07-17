#!/usr/bin/env node

/**
 * Loyverse Webhook Setup Script
 * This script helps you create a webhook in Loyverse POS for real-time data synchronization.
 */

import https from 'https';

// Configuration
const LOYVERSE_API_BASE = 'https://api.loyverse.com/v1.0';
const WEBHOOK_URL = 'https://your-replit-app-domain.replit.app/api/loyverse-webhook';
const WEBHOOK_EVENTS = [
  'receipts.created',
  'shift.closed'
];

// Get token from environment variable
const LOYVERSE_TOKEN = process.env.LOYVERSE_API_TOKEN;

if (!LOYVERSE_TOKEN) {
  console.error('❌ LOYVERSE_API_TOKEN environment variable is required');
  console.error('Please set it with: export LOYVERSE_API_TOKEN=your_token_here');
  process.exit(1);
}

// Function to make API requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.loyverse.com',
      port: 443,
      path: `/v1.0${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${LOYVERSE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Main function
async function setupWebhook() {
  console.log('🔧 Setting up Loyverse webhook...');
  
  try {
    // First, list existing webhooks
    console.log('📋 Checking existing webhooks...');
    const listResponse = await makeRequest('GET', '/webhooks');
    
    if (listResponse.status !== 200) {
      console.error('❌ Failed to list webhooks:', listResponse.data);
      return;
    }
    
    console.log(`📊 Found ${listResponse.data.length} existing webhooks`);
    
    // Check if webhook already exists
    const existingWebhook = listResponse.data.find(webhook => 
      webhook.url === WEBHOOK_URL
    );
    
    if (existingWebhook) {
      console.log('✅ Webhook already exists:', existingWebhook.id);
      console.log('📍 URL:', existingWebhook.url);
      console.log('📝 Events:', existingWebhook.events.join(', '));
      console.log('🔒 Secret configured:', existingWebhook.secret ? 'Yes' : 'No');
      return;
    }
    
    // Create new webhook
    console.log('🚀 Creating new webhook...');
    const webhookData = {
      url: WEBHOOK_URL,
      events: WEBHOOK_EVENTS,
      // Optional: Add secret for enhanced security
      // secret: 'your-webhook-secret-here'
    };
    
    const createResponse = await makeRequest('POST', '/webhooks', webhookData);
    
    if (createResponse.status === 201) {
      console.log('✅ Webhook created successfully!');
      console.log('🆔 Webhook ID:', createResponse.data.id);
      console.log('📍 URL:', createResponse.data.url);
      console.log('📝 Events:', createResponse.data.events.join(', '));
      console.log('🔒 Secret:', createResponse.data.secret ? 'Configured' : 'Not configured');
      
      console.log('\n📊 Your webhook is now active and will receive:');
      console.log('  • Real-time receipt notifications');
      console.log('  • Shift opening/closing events');
      console.log('  • Automatic data synchronization');
      
    } else {
      console.error('❌ Failed to create webhook:', createResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Error setting up webhook:', error.message);
  }
}

// Run the setup
setupWebhook();
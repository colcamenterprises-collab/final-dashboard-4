# Loyverse Webhook Setup Guide

## Overview
This guide explains how to set up webhooks in Loyverse POS to enable real-time data synchronization with your restaurant management dashboard.

## Webhook URL
Your webhook endpoint URL is:
```
https://your-replit-app-domain.replit.app/api/webhooks/loyverse
```

## Setup Methods

### Method 1: Via Loyverse Dashboard
1. Log in to your Loyverse account
2. Navigate to **Settings** → **Integrations** → **Webhooks**
3. Click **Create New Webhook**
4. Configure the webhook:
   - **URL**: `https://your-replit-app-domain.replit.app/api/webhooks/loyverse`
   - **Events**: Select the following events:
     - `receipt.created` - When a new receipt is created
     - `receipt.updated` - When a receipt is modified
     - `shift.opened` - When a shift starts
     - `shift.closed` - When a shift ends
   - **Secret**: (Optional) Leave blank for now, or set a custom secret
5. Click **Save**

### Method 2: Via API (Using your existing token)
```bash
curl -X POST https://api.loyverse.com/v1.0/webhooks \
  -H "Authorization: Bearer YOUR_LOYVERSE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-replit-app-domain.replit.app/api/webhooks/loyverse",
    "events": ["receipt.created", "receipt.updated", "shift.opened", "shift.closed"],
    "secret": "optional-webhook-secret"
  }'
```

## Supported Events

### Receipt Events
- **receipt.created**: Triggered when a new receipt is created
- **receipt.updated**: Triggered when a receipt is modified

### Shift Events
- **shift.opened**: Triggered when a new shift starts
- **shift.closed**: Triggered when a shift ends

## Security

**Important**: Webhooks are secured using **SHA-1 HMAC with base64 encoding** (not SHA-256). The signature is provided in the `x-loyverse-signature` header and validated against your webhook secret.

### Signature Generation

The webhook signature is generated using:
1. SHA-1 HMAC algorithm
2. Base64 encoding of the digest
3. JSON payload as the message

Example signature generation:
```javascript
const crypto = require('crypto');
const signature = crypto.createHmac('sha1', secret).update(payload).digest('base64');
```

## Webhook Payload Structure

### Receipt Event Example
```json
{
  "id": "webhook-event-123",
  "event": "receipt.created",
  "created_at": "2025-07-17T15:37:00.000Z",
  "data": {
    "id": "receipt-123",
    "receipt_number": "R001",
    "receipt_date": "2025-07-17T15:37:00.000Z",
    "total_money": 150.50,
    "total_tax": 13.68,
    "total_discount": 0,
    "payments": [
      {
        "payment_type": "cash",
        "amount": 150.50
      }
    ],
    "line_items": [
      {
        "item_name": "Smash Burger",
        "quantity": 1,
        "line_total": 150.50
      }
    ],
    "customer_id": "customer-123",
    "employee_id": "employee-456",
    "table_number": "5"
  }
}
```

## Security

### Webhook Signature Validation
If you configure a webhook secret in Loyverse, the system will automatically validate incoming webhooks using HMAC SHA-256 signature verification.

The signature is sent in the `x-loyverse-signature` header as:
```
sha256=<signature>
```

### Without Secret (Current Setup)
The webhook endpoint currently accepts all incoming webhooks without signature validation. This is suitable for development and testing.

## Testing the Webhook

### Manual Test
You can test the webhook endpoint manually:
```bash
curl -X POST https://your-replit-app-domain.replit.app/api/webhooks/loyverse \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "event": "receipt.created",
    "created_at": "2025-07-17T15:37:00.000Z",
    "data": {
      "id": "receipt-123",
      "receipt_number": "R001",
      "receipt_date": "2025-07-17T15:37:00.000Z",
      "total_money": 150.50,
      "payments": [{"payment_type": "cash"}],
      "line_items": [{"item_name": "Test Burger", "quantity": 1}]
    }
  }'
```

### Expected Response
```json
{"status": "received"}
```

## Data Processing

### Receipt Processing
When a receipt webhook is received, the system:
1. Validates the webhook signature (if secret is configured)
2. Extracts receipt data
3. Converts timestamps to Bangkok timezone
4. Determines the appropriate shift date (5:00 PM - 3:00 AM cycle)
5. Stores the receipt in the database
6. Updates existing receipts if they already exist

### Shift Processing
When a shift webhook is received, the system:
1. Logs the shift event
2. Can trigger automated reports (shift.closed events)
3. Updates shift tracking data

## Monitoring

### Webhook Logs
Monitor webhook activity in the application logs:
- `🔔 Webhook received: [event] (ID: [id])`
- `📄 Processing receipt webhook: [receipt_number] - ฿[amount]`
- `✅ Receipt [receipt_number] processed via webhook`

### Error Handling
The system includes comprehensive error handling:
- Invalid signatures are rejected with 401 status
- Processing errors are logged and return 500 status
- Successful processing returns 200 status

## Benefits of Webhook Integration

1. **Real-time Data**: Immediate receipt processing as orders are completed
2. **Automated Sync**: No need for manual data imports
3. **Accurate Reporting**: Real-time dashboard updates
4. **Inventory Tracking**: Instant stock level updates
5. **Shift Management**: Automated shift tracking and reporting

## Troubleshooting

### Common Issues
1. **Webhook not receiving data**: Check the URL is correct and accessible
2. **Signature validation failures**: Verify the webhook secret matches
3. **Processing errors**: Check application logs for detailed error messages

### Verification Steps
1. Test the webhook endpoint manually
2. Check Loyverse webhook configuration
3. Monitor application logs for webhook events
4. Verify data is being stored in the database

## Next Steps

After webhook setup:
1. Configure webhook secret for enhanced security
2. Monitor webhook events in the dashboard
3. Set up automated reporting based on webhook events
4. Configure alerts for webhook failures
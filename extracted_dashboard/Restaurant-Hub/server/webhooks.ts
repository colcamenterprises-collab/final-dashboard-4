import type { Express, Request, Response } from "express";
import { db } from "./db";
import { loyverseReceipts, loyverseShiftReports } from "@shared/schema";
import crypto from "crypto";

// Loyverse webhook event types
interface WebhookEvent {
  id: string;
  event: 'receipt.created' | 'receipt.updated' | 'shift.opened' | 'shift.closed';
  data: any;
  created_at: string;
}

// Webhook signature validation
function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  const headerSignature = signature.replace('sha256=', '');
  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(headerSignature));
}

// Convert Bangkok time to UTC for database storage
function bangkokToUTC(bangkokTime: string): Date {
  const date = new Date(bangkokTime);
  // Bangkok is UTC+7
  return new Date(date.getTime() - (7 * 60 * 60 * 1000));
}

export function setupWebhooks(app: Express) {
  // Webhook endpoint for Loyverse notifications
  app.post('/api/webhooks/loyverse', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-loyverse-signature'] as string;
      const payload = JSON.stringify(req.body);
      
      // Validate webhook signature (if secret is configured)
      const webhookSecret = process.env.LOYVERSE_WEBHOOK_SECRET;
      if (webhookSecret && signature) {
        if (!validateWebhookSignature(payload, signature, webhookSecret)) {
          console.error('🚫 Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      const event: WebhookEvent = req.body;
      console.log(`🔔 Webhook received: ${event.event} (ID: ${event.id})`);

      switch (event.event) {
        case 'receipt.created':
        case 'receipt.updated':
          await handleReceiptWebhook(event);
          break;
          
        case 'shift.closed':
          await handleShiftClosedWebhook(event);
          break;
          
        case 'shift.opened':
          console.log(`📈 Shift opened: ${event.data.id}`);
          break;
          
        default:
          console.log(`ℹ️ Unhandled webhook event: ${event.event}`);
      }

      res.status(200).json({ status: 'received' });
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
}

async function handleReceiptWebhook(event: WebhookEvent) {
  try {
    const receiptData = event.data;
    console.log(`📄 Processing receipt webhook: ${receiptData.receipt_number} - ฿${receiptData.total_money}`);
    
    // Convert UTC receipt date to Bangkok time for consistency
    const receiptDate = new Date(receiptData.receipt_date);
    const bangkokTime = new Date(receiptDate.getTime() + (7 * 60 * 60 * 1000));
    
    // Determine shift date (6pm-3am cycle)
    const shiftDate = bangkokTime.getHours() >= 18 
      ? new Date(bangkokTime.getFullYear(), bangkokTime.getMonth(), bangkokTime.getDate(), 18, 0, 0)
      : new Date(bangkokTime.getFullYear(), bangkokTime.getMonth(), bangkokTime.getDate() - 1, 18, 0, 0);

    // Insert or update receipt in database
    await db.insert(loyverseReceipts).values({
      receiptId: receiptData.id,
      receiptNumber: receiptData.receipt_number,
      receiptDate: receiptDate,
      totalAmount: receiptData.total_money.toString(),
      paymentMethod: receiptData.payments?.[0]?.payment_type || 'UNKNOWN',
      customerInfo: receiptData.customer_id ? { customer_id: receiptData.customer_id } : null,
      items: receiptData.line_items || [],
      taxAmount: receiptData.total_tax?.toString() || '0',
      discountAmount: receiptData.total_discount?.toString() || '0',
      staffMember: receiptData.employee_id || null,
      tableNumber: receiptData.table_number || null,
      shiftDate: shiftDate,
      rawData: receiptData,
    }).onConflictDoUpdate({
      target: [loyverseReceipts.receiptId],
      set: {
        totalAmount: receiptData.total_money.toString(),
        paymentMethod: receiptData.payments?.[0]?.payment_type || 'UNKNOWN',
        items: receiptData.line_items || [],
        rawData: receiptData,
        updatedAt: new Date(),
      }
    });
    
    console.log(`✅ Receipt ${receiptData.receipt_number} processed via webhook`);
  } catch (error) {
    console.error('❌ Error processing receipt webhook:', error);
  }
}

async function handleShiftClosedWebhook(event: WebhookEvent) {
  try {
    const shiftData = event.data;
    console.log(`🏁 Processing shift closed webhook: ${shiftData.id} - ฿${shiftData.total_sales}`);
    
    // Convert UTC times to Bangkok timezone
    const shiftStart = new Date(shiftData.start_time);
    const shiftEnd = new Date(shiftData.end_time);
    const bangkokShiftDate = new Date(shiftStart.getTime() + (7 * 60 * 60 * 1000));
    
    // Determine shift date based on Bangkok time
    const shiftDate = bangkokShiftDate.getHours() >= 18 
      ? new Date(bangkokShiftDate.getFullYear(), bangkokShiftDate.getMonth(), bangkokShiftDate.getDate(), 18, 0, 0)
      : new Date(bangkokShiftDate.getFullYear(), bangkokShiftDate.getMonth(), bangkokShiftDate.getDate() - 1, 18, 0, 0);

    // Insert shift report into database
    await db.insert(loyverseShiftReports).values({
      reportId: shiftData.id,
      shiftDate: shiftDate,
      shiftStart: shiftStart,
      shiftEnd: shiftEnd,
      totalSales: shiftData.total_sales || 0,
      totalTransactions: shiftData.total_transactions || 0,
      totalCustomers: shiftData.total_customers || 0,
      cashSales: shiftData.cash_sales || 0,
      cardSales: shiftData.card_sales || 0,
      discounts: shiftData.discounts || 0,
      taxes: shiftData.taxes || 0,
      staffMembers: shiftData.staff_members || [],
      topItems: shiftData.top_items || [],
      reportData: shiftData,
      completedBy: shiftData.employee_name || 'System',
      completedAt: shiftEnd,
    }).onConflictDoUpdate({
      target: [loyverseShiftReports.reportId],
      set: {
        totalSales: shiftData.total_sales || 0,
        totalTransactions: shiftData.total_transactions || 0,
        reportData: shiftData,
        updatedAt: new Date(),
      }
    });
    
    console.log(`✅ Shift ${shiftData.id} closed and processed via webhook`);
  } catch (error) {
    console.error('❌ Error processing shift closed webhook:', error);
  }
}

// Webhook management functions
export async function registerWebhooks() {
  try {
    const accessToken = process.env.LOYVERSE_API_TOKEN;
    if (!accessToken) {
      console.error('❌ LOYVERSE_API_TOKEN not configured');
      return;
    }

    const webhookUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/webhooks/loyverse`
      : 'https://your-domain.replit.app/api/webhooks/loyverse';

    const webhooksToRegister = [
      {
        url: webhookUrl,
        events: ['receipt.created', 'receipt.updated'],
        active: true
      },
      {
        url: webhookUrl,
        events: ['shift.closed'],
        active: true
      }
    ];

    for (const webhook of webhooksToRegister) {
      const response = await fetch('https://api.loyverse.com/v1.0/webhooks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhook)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Webhook registered: ${webhook.events.join(', ')} -> ${webhook.url}`);
        console.log(`📝 Webhook ID: ${result.id}`);
      } else {
        const error = await response.text();
        console.error(`❌ Failed to register webhook: ${error}`);
      }
    }
  } catch (error) {
    console.error('❌ Error registering webhooks:', error);
  }
}

export async function listWebhooks() {
  try {
    const accessToken = process.env.LOYVERSE_API_TOKEN;
    if (!accessToken) {
      console.error('❌ LOYVERSE_API_TOKEN not configured');
      return [];
    }

    const response = await fetch('https://api.loyverse.com/v1.0/webhooks', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      return result.webhooks || [];
    } else {
      const error = await response.text();
      console.error(`❌ Failed to list webhooks: ${error}`);
      return [];
    }
  } catch (error) {
    console.error('❌ Error listing webhooks:', error);
    return [];
  }
}


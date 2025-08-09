/**
 * POS data ingestion service - handles upserts to database
 */
import { PrismaClient } from '@prisma/client';
import { fetchReceiptsWindow, fetchMenuItems } from './loyverse.js';
import { normalizeReceipt, normalizeMenuItem } from './normalizer.js';
import * as dateFnsTz from 'date-fns-tz';

const prisma = new PrismaClient();

/**
 * Get or create restaurant record
 */
async function ensureRestaurant() {
  let restaurant = await prisma.restaurant.findFirst({
    where: { slug: 'smash-brothers-burgers' }
  });

  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: 'Smash Brothers Burgers',
        slug: 'smash-brothers-burgers',
        email: 'smashbrothersburgersth@gmail.com',
        timezone: 'Asia/Bangkok'
      }
    });
  }

  return restaurant;
}

/**
 * Ensure POS connection record exists
 */
async function ensurePosConnection(restaurantId) {
  let connection = await prisma.posConnection.findFirst({
    where: { 
      restaurantId,
      provider: 'LOYVERSE',
      isActive: true
    }
  });

  if (!connection) {
    connection = await prisma.posConnection.create({
      data: {
        restaurantId,
        provider: 'LOYVERSE',
        apiKey: process.env.LOYVERSE_API_TOKEN?.substring(0, 8) + '...',
        isActive: true
      }
    });
  }

  return connection;
}

/**
 * Upsert receipt and related data
 */
async function upsertReceipt(normalizedData, restaurantId) {
  const { receipt, items, payments } = normalizedData;

  // Check if receipt already exists
  const existing = await prisma.receipt.findUnique({
    where: {
      restaurantId_provider_externalId: {
        restaurantId,
        provider: 'LOYVERSE',
        externalId: receipt.externalId
      }
    }
  });

  if (existing) {
    return { receipt: existing, isNew: false };
  }

  // Create new receipt with items and payments
  const created = await prisma.receipt.create({
    data: {
      ...receipt,
      items: {
        create: items
      },
      payments: {
        create: payments
      }
    },
    include: {
      items: true,
      payments: true
    }
  });

  return { receipt: created, isNew: true };
}

/**
 * Sync receipts for a time window - bulletproof timezone and pagination
 */
export async function syncReceiptsWindow(startLocal, endLocal, mode = 'incremental') {
  const restaurant = await ensureRestaurant();
  const connection = await ensurePosConnection(restaurant.id);

  // Convert Bangkok time to UTC precisely using manual offset calculation
  const BANGKOK_OFFSET = 7; // UTC+7
  const startUTC = new Date(startLocal.getTime() - (BANGKOK_OFFSET * 60 * 60 * 1000));
  const endUTC = new Date(endLocal.getTime() - (BANGKOK_OFFSET * 60 * 60 * 1000));
  
  console.log('Window UTC:', { 
    start: startUTC.toISOString(), 
    end: endUTC.toISOString() 
  });

  const syncLog = await prisma.posSyncLog.create({
    data: {
      restaurantId: restaurant.id,
      provider: 'LOYVERSE',
      mode,
      startedAt: new Date()
    }
  });

  let receiptsFetched = 0;
  let itemsUpserted = 0;
  let paymentsUpserted = 0;
  let cursor = null;
  let total = 0;

  try {
    // Hard-loop pagination until empty
    do {
      const { receipts, nextCursor } = await fetchReceiptsWindow(
        startUTC.toISOString(), 
        endUTC.toISOString(), 
        cursor
      );
      total += receipts.length;
      
      for (const loyverseReceipt of receipts) {
        try {
          const normalized = normalizeReceipt(loyverseReceipt, restaurant.id);
          const { receipt, isNew } = await upsertReceipt(normalized, restaurant.id);
          
          receiptsFetched++;
          if (isNew) {
            itemsUpserted += normalized.items.length;
            paymentsUpserted += normalized.payments.length;
          }
          
          console.log(`✅ Upserted receipt ${loyverseReceipt.number || loyverseReceipt.id}`, { isNew });
        } catch (error) {
          console.error(`❌ Failed to upsert receipt ${loyverseReceipt.id}:`, error.message);
          
          // Log individual receipt errors
          await prisma.ingestionError.create({
            data: {
              restaurantId: restaurant.id,
              provider: 'LOYVERSE',
              externalId: loyverseReceipt.id,
              context: 'receipt_upsert',
              errorMessage: error.message,
              rawPayload: loyverseReceipt
            }
          });
        }
      }

      cursor = nextCursor;
    } while (cursor);
    
    console.log('Window total:', total);

    // Update sync log
    await prisma.posSyncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        receiptsFetched,
        itemsUpserted,
        paymentsUpserted,
        status: 'SUCCESS'
      }
    });

    // Update connection last sync
    await prisma.posConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() }
    });

    return { receiptsFetched, itemsUpserted, paymentsUpserted };
  } catch (error) {
    // Update sync log with error
    await prisma.posSyncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        receiptsFetched,
        itemsUpserted,
        paymentsUpserted,
        status: 'FAILED',
        message: error.message
      }
    });

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Helper functions for safe menu item upsert
 */
function s(v) { return (v ?? '').toString().trim(); }

function inferName(raw) {
  return s(raw.item_name) || s(raw.name) || s(raw.handle) || s(raw.title) || s(raw.reference_id) || s(raw.id) || s(raw.sku);
}

async function upsertMenuItem(prisma, restaurantId, raw) {
  // Try SKU; if missing, fall back to external id
  const sku = s(raw.sku) || s(raw.reference_id) || s(raw.id);
  if (!sku) {
    console.warn('SKIP menu item with no sku/id:', raw?.id);
    return;
  }

  const finalName = inferName(raw) || `SKU:${sku}`;
  const category = s(raw.category) || s(raw.category_name) || 'Uncategorized';
  const active = raw.deleted_at ? false : true;

  const isDrink = /drink|coke|sprite|water|soda|pepsi|fanta/i.test(finalName);
  const isBurger = /burger|cheese|double/i.test(finalName);

  await prisma.menuItem.upsert({
    where: { restaurantId_sku: { restaurantId, sku } },
    create: {
      restaurantId,
      sku,
      name: finalName,
      category,
      portionGrams: null,
      isDrink,
      isBurger,
      active,
      meta: raw
    },
    update: {
      name: finalName,
      category,
      active,
      meta: raw
    }
  });
}

/**
 * Sync menu items
 */
export async function syncMenuItems() {
  const restaurant = await ensureRestaurant();
  
  try {
    const loyverseItems = await fetchMenuItems();
    let upserted = 0;

    for (const raw of loyverseItems) {
      try {
        await upsertMenuItem(prisma, restaurant.id, raw);
        upserted++;
      } catch (e) {
        console.error('Menu upsert failed:', e?.message);
        await prisma.ingestionError.create({
          data: {
            restaurantId: restaurant.id,
            provider: 'LOYVERSE',
            context: 'menuItemUpsert',
            errorMessage: String(e?.message || e),
            rawPayload: raw
          }
        });
        // continue to next item (don't crash the whole backfill)
      }
    }

    return { itemsUpserted: upserted };
  } finally {
    await prisma.$disconnect();
  }
}
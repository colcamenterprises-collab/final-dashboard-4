/* eslint-disable no-console */
import 'dotenv/config';
import { Client } from 'pg';

const SHIFT_DATE = '2025-10-15'; // seed date (local Asia/Bangkok)
const TZ = '+07';                // Bangkok UTC offset

// Seed payload
const receipts = [
  {
    id: 'test-burger-receipt-a',
    datetime: `2025-10-15 18:10:00${TZ}`,
    items: [
      { name: 'Single Smash Burger (ซิงเกิ้ล)', quantity: 3, price: 100 },
      { name: 'Coke Can', quantity: 1, price: 30 },
    ],
    payment: 'Cash', total: 1000,
  },
  {
    id: 'test-burger-receipt-b',
    datetime: `2025-10-15 19:25:00${TZ}`,
    items: [
      { name: 'Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)', quantity: 2, price: 200 },
    ],
    payment: 'QR', total: 1200,
  },
  {
    id: 'test-burger-receipt-c',
    datetime: `2025-10-15 20:05:00${TZ}`,
    items: [
      { name: 'Triple Smash Set (Meal Deal)', quantity: 1, price: 350 },
      { name: 'Sprite Can', quantity: 1, price: 30 },
    ],
    payment: 'Cash', total: 800,
  },
  {
    id: 'test-burger-receipt-d',
    datetime: `2025-10-15 21:40:00${TZ}`,
    items: [
      { name: 'Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)', quantity: 2, price: 150 },
    ],
    payment: 'Cash', total: 600,
  },
  {
    id: 'test-burger-receipt-e',
    datetime: `2025-10-15 22:55:00${TZ}`,
    items: [
      { name: 'Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ', quantity: 4, price: 200 },
      { name: 'Coke Can', quantity: 2, price: 30 },
    ],
    payment: 'Card', total: 1800,
  },
  {
    id: 'test-burger-receipt-f',
    datetime: `2025-10-16 01:15:00${TZ}`,
    items: [
      { name: 'Kids Single Meal Set (Burger Fries Drink)', quantity: 1, price: 250 },
    ],
    payment: 'Cash', total: 300,
  },
];

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  console.log('→ Using receipts & receipt_items tables');

  // Get restaurant ID
  const restResult = await db.query('SELECT id FROM restaurants LIMIT 1');
  const restaurantId = restResult.rows[0]?.id;
  
  if (!restaurantId) {
    console.error('💥 No restaurant found in database');
    await db.end();
    process.exit(1);
  }

  // Clean previous test data
  await db.query(`DELETE FROM receipt_items WHERE "receiptId" IN (SELECT id FROM receipts WHERE id LIKE 'test-burger-receipt-%')`);
  await db.query(`DELETE FROM receipts WHERE id LIKE 'test-burger-receipt-%'`);

  // Insert receipts
  for (const r of receipts) {
    const subtotal = r.total;
    
    // Insert receipt
    await db.query(
      `INSERT INTO receipts (
        id, "restaurantId", provider, "externalId", "receiptNumber",
        "createdAtUTC", "closedAtUTC", subtotal, tax, discount, total, "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz, $7, 0, 0, $8, NOW())`,
      [r.id, restaurantId, 'LOYVERSE', r.id, r.id, r.datetime, subtotal, r.total]
    );

    // Insert items
    for (const item of r.items) {
      await db.query(
        `INSERT INTO receipt_items (id, "receiptId", name, qty, "unitPrice", total)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [r.id, item.name, item.quantity, item.price, item.quantity * item.price]
      );
    }
  }

  console.log('✅ Seeded 6 receipts into test shift window (2025-10-15 17:00 → 2025-10-16 03:00 Bangkok)');
  await db.end();
}

main().catch((e) => {
  console.error('💥 Seeder failed:', e?.message || e);
  process.exit(1);
});

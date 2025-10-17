-- Seed test receipts for burger metrics testing
-- Deterministic test shift on 2025-10-15 (18:00 -> 03:00 next day, Asia/Bangkok)

-- 1) Create a test batch if it doesn't exist
INSERT INTO "PosBatch" (id, "createdAt", title)
VALUES ('TEST_BATCH_1', NOW(), 'Test Batch for Burger Metrics')
ON CONFLICT (id) DO NOTHING;

-- 2) Clean any previous test receipts for idempotency
DELETE FROM "PosReceipt" WHERE "batchId" = 'TEST_BATCH_1';

-- 3) Insert receipts within the shift window (2025-10-15 18:xx to 2025-10-16 02:xx)

-- Receipt A: 3x Single Smash Burger (ซิงเกิ้ล), plus a drink line
INSERT INTO "PosReceipt" (id, "batchId", "receiptId", datetime, total, "itemsJson", payment)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-A', '2025-10-15 18:10:00', 1000,
  '[
    {"name":"Single Smash Burger (ซิงเกิ้ล)", "quantity":3, "price":100},
    {"name":"Coke Can", "quantity":1, "price":30}
  ]'::jsonb,
  'Cash'
);

-- Receipt B: 2x Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)
INSERT INTO "PosReceipt" (id, "batchId", "receiptId", datetime, total, "itemsJson", payment)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-B', '2025-10-15 19:25:00', 1200,
  '[
    {"name":"Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)", "quantity":2, "price":200}
  ]'::jsonb,
  'QR'
);

-- Receipt C: 1x Triple Smash Set (Meal Deal) + a drink line
INSERT INTO "PosReceipt" (id, "batchId", "receiptId", datetime, total, "itemsJson", payment)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-C', '2025-10-15 20:05:00', 800,
  '[
    {"name":"Triple Smash Set (Meal Deal)", "quantity":1, "price":350},
    {"name":"Sprite Can", "quantity":1, "price":30}
  ]'::jsonb,
  'Cash'
);

-- Receipt D: 2x Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)
INSERT INTO "PosReceipt" (id, "batchId", "receiptId", datetime, total, "itemsJson", payment)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-D', '2025-10-15 21:40:00', 600,
  '[
    {"name":"Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)", "quantity":2, "price":150}
  ]'::jsonb,
  'Cash'
);

-- Receipt E: 4x Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ + 2 drinks
INSERT INTO "PosReceipt" (id, "batchId", "receiptId", datetime, total, "itemsJson", payment)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-E', '2025-10-15 22:55:00', 1800,
  '[
    {"name":"Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ", "quantity":4, "price":200},
    {"name":"Coke Can", "quantity":2, "price":30}
  ]'::jsonb,
  'Card'
);

-- Receipt F: 1x Kids Single Meal Set (Burger Fries Drink)
INSERT INTO "PosReceipt" (id, "batchId", "receiptId", datetime, total, "itemsJson", payment)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-F', '2025-10-16 01:15:00', 300,
  '[
    {"name":"Kids Single Meal Set (Burger Fries Drink)", "quantity":1, "price":250}
  ]'::jsonb,
  'Cash'
);

-- Seed test receipts for burger metrics testing
-- Deterministic test shift on 2025-10-15 (18:00 -> 03:00 next day, Asia/Bangkok)

-- 1) Create a test batch if it doesn't exist
INSERT INTO pos_batch (id, created_at)
VALUES ('TEST_BATCH_1', NOW())
ON CONFLICT (id) DO NOTHING;

-- 2) Clean any previous test receipts for idempotency
DELETE FROM pos_receipt WHERE batch_id = 'TEST_BATCH_1';

-- 3) Insert receipts within the shift window (2025-10-15 18:xx to 2025-10-16 02:xx)

-- Receipt A: 3x Single Smash Burger (ซิงเกิ้ล), plus a drink line
INSERT INTO pos_receipt (id, batch_id, receipt_id, datetime, total, items_json, payment, created_at)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-A', '2025-10-15 18:10:00+07', 1000,
  '[
    {"name":"Single Smash Burger (ซิงเกิ้ล)", "quantity":3, "price":100},
    {"name":"Coke Can", "quantity":1, "price":30}
  ]'::jsonb,
  'Cash', NOW()
);

-- Receipt B: 2x Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)
INSERT INTO pos_receipt (id, batch_id, receipt_id, datetime, total, items_json, payment, created_at)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-B', '2025-10-15 19:25:00+07', 1200,
  '[
    {"name":"Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)", "quantity":2, "price":200}
  ]'::jsonb,
  'QR', NOW()
);

-- Receipt C: 1x Triple Smash Set (Meal Deal) + a drink line
INSERT INTO pos_receipt (id, batch_id, receipt_id, datetime, total, items_json, payment, created_at)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-C', '2025-10-15 20:05:00+07', 800,
  '[
    {"name":"Triple Smash Set (Meal Deal)", "quantity":1, "price":350},
    {"name":"Sprite Can", "quantity":1, "price":30}
  ]'::jsonb,
  'Cash', NOW()
);

-- Receipt D: 2x Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)
INSERT INTO pos_receipt (id, batch_id, receipt_id, datetime, total, items_json, payment, created_at)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-D', '2025-10-15 21:40:00+07', 600,
  '[
    {"name":"Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)", "quantity":2, "price":150}
  ]'::jsonb,
  'Cash', NOW()
);

-- Receipt E: 4x Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ + 2 drinks
INSERT INTO pos_receipt (id, batch_id, receipt_id, datetime, total, items_json, payment, created_at)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-E', '2025-10-15 22:55:00+07', 1800,
  '[
    {"name":"Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ", "quantity":4, "price":200},
    {"name":"Coke Can", "quantity":2, "price":30}
  ]'::jsonb,
  'Card', NOW()
);

-- Receipt F: 1x Kids Single Meal Set (Burger Fries Drink)
INSERT INTO pos_receipt (id, batch_id, receipt_id, datetime, total, items_json, payment, created_at)
VALUES (
  gen_random_uuid(), 'TEST_BATCH_1', 'R-F', '2025-10-16 01:15:00+07', 300,
  '[
    {"name":"Kids Single Meal Set (Burger Fries Drink)", "quantity":1, "price":250}
  ]'::jsonb,
  'Cash', NOW()
);

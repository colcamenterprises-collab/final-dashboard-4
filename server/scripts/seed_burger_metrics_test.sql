-- Seed test receipts for burger metrics testing
-- Deterministic test shift on 2025-10-15 (18:00 -> 03:00 next day, Asia/Bangkok)

-- Clean previous test data
DELETE FROM receipt_items WHERE "receiptId" IN (SELECT id FROM receipts WHERE "receiptNumber" LIKE 'TEST-%');
DELETE FROM receipt_payments WHERE "receiptId" IN (SELECT id FROM receipts WHERE "receiptNumber" LIKE 'TEST-%');
DELETE FROM receipts WHERE "receiptNumber" LIKE 'TEST-%';

-- Receipt A: 3x Single Smash Burger
INSERT INTO receipts (id, "restaurantId", provider, "externalId", "receiptNumber", "createdAtUTC", "closedAtUTC", total, subtotal, tax, discount, "createdAt")
VALUES ('test-receipt-a', 'cmes916fj0000pio20tvofd44', 'LOYVERSE', 'TEST-A-EXT', 'TEST-A', '2025-10-15 11:10:00'::timestamp, '2025-10-15 11:10:00'::timestamp, 1000, 1000, 0, 0, NOW()))
ON CONFLICT (id) DO NOTHING;

INSERT INTO receipt_items (id, "receiptId", name, qty, "unitPrice", total)
VALUES 
  (gen_random_uuid(), 'test-receipt-a', 'Single Smash Burger (ซิงเกิ้ล)', 3, 100, 300),
  (gen_random_uuid(), 'test-receipt-a', 'Coke Can', 1, 30, 30);

-- Receipt B: 2x Super Double Bacon and Cheese
INSERT INTO receipts (id, "restaurantId", provider, "externalId", "receiptNumber", "createdAtUTC", "closedAtUTC", total, subtotal, tax, discount, "createdAt")
VALUES ('test-receipt-b', 'cmes916fj0000pio20tvofd44', 'LOYVERSE', 'TEST-B-EXT', 'TEST-B', '2025-10-15 12:25:00'::timestamp, '2025-10-15 12:25:00'::timestamp, 1200, 1200, 0, 0, NOW()))
ON CONFLICT (id) DO NOTHING;

INSERT INTO receipt_items (id, "receiptId", name, qty, "unitPrice", total)
VALUES 
  (gen_random_uuid(), 'test-receipt-b', 'Super Double Bacon and Cheese (ซูเปอร์ดับเบิ้ลเบคอน)', 2, 200, 400);

-- Receipt C: 1x Triple Smash Set
INSERT INTO receipts (id, "restaurantId", provider, "externalId", "receiptNumber", "createdAtUTC", "closedAtUTC", total, subtotal, tax, discount, "createdAt")
VALUES ('test-receipt-c', 'cmes916fj0000pio20tvofd44', 'LOYVERSE', 'TEST-C-EXT', 'TEST-C', '2025-10-15 13:05:00'::timestamp, '2025-10-15 13:05:00'::timestamp, 800, 800, 0, 0, NOW()))
ON CONFLICT (id) DO NOTHING;

INSERT INTO receipt_items (id, "receiptId", name, qty, "unitPrice", total)
VALUES 
  (gen_random_uuid(), 'test-receipt-c', 'Triple Smash Set (Meal Deal)', 1, 350, 350),
  (gen_random_uuid(), 'test-receipt-c', 'Sprite Can', 1, 30, 30);

-- Receipt D: 2x Crispy Chicken Fillet Burger
INSERT INTO receipts (id, "restaurantId", provider, "externalId", "receiptNumber", "createdAtUTC", "closedAtUTC", total, subtotal, tax, discount, "createdAt")
VALUES ('test-receipt-d', 'cmes916fj0000pio20tvofd44', 'LOYVERSE', 'TEST-D-EXT', 'TEST-D', '2025-10-15 14:40:00'::timestamp, '2025-10-15 14:40:00'::timestamp, 600, 600, 0, 0, NOW()))
ON CONFLICT (id) DO NOTHING;

INSERT INTO receipt_items (id, "receiptId", name, qty, "unitPrice", total)
VALUES 
  (gen_random_uuid(), 'test-receipt-d', 'Crispy Chicken Fillet Burger (เบอร์เกอร์ไก่ชิ้น)', 2, 150, 300);

-- Receipt E: 4x Karaage Chicken
INSERT INTO receipts (id, "restaurantId", provider, "externalId", "receiptNumber", "createdAtUTC", "closedAtUTC", total, subtotal, tax, discount, "createdAt")
VALUES ('test-receipt-e', 'cmes916fj0000pio20tvofd44', 'LOYVERSE', 'TEST-E-EXT', 'TEST-E', '2025-10-15 15:55:00'::timestamp, '2025-10-15 15:55:00'::timestamp, 1800, 1800, 0, 0, NOW()))
ON CONFLICT (id) DO NOTHING;

INSERT INTO receipt_items (id, "receiptId", name, qty, "unitPrice", total)
VALUES 
  (gen_random_uuid(), 'test-receipt-e', 'Karaage Chicken (Meal Deal) เบอร์เกอร์ไก่คาราอาเกะ', 4, 200, 800),
  (gen_random_uuid(), 'test-receipt-e', 'Coke Can', 2, 30, 60);

-- Receipt F: 1x Kids Single Meal Set
INSERT INTO receipts (id, "restaurantId", provider, "externalId", "receiptNumber", "createdAtUTC", "closedAtUTC", total, subtotal, tax, discount, "createdAt")
VALUES ('test-receipt-f', 'cmes916fj0000pio20tvofd44', 'LOYVERSE', 'TEST-F-EXT', 'TEST-F', '2025-10-15 18:15:00'::timestamp, '2025-10-15 18:15:00'::timestamp, 300, 300, 0, 0, NOW()))
ON CONFLICT (id) DO NOTHING;

INSERT INTO receipt_items (id, "receiptId", name, qty, "unitPrice", total)
VALUES 
  (gen_random_uuid(), 'test-receipt-f', 'Kids Single Meal Set (Burger Fries Drink)', 1, 250, 250);

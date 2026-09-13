-- Complete COGS accounting for normal SBB menu sales.
-- Promotions remain intentionally outside this phase.

-- Canonical recipe links: repair UI/display links at the database source of truth.
WITH mappings(menu_name, recipe_name) AS (
  VALUES
    ('Original Single Smash Burger','Single Smash Burger'),
    ('Ultimate Double Smash Burger','Ultimate Double Smash Burger'),
    ('Super Double Bacon and Cheese','Super Double Bacon and Cheese'),
    ('Crispy Chicken Fillet Burger','Chicken Fillet Burger'),
    ('Triple Smash Burger','Triple Smash Burger'),
    ('Loaded Fries','Loaded Fries (Original)'),
    ('Dirty Fries','Dirty Fries'),
    ('French Fries','French Fries'),
    ('Chicken Nuggets (6)','Chicken Nuggets - 6 Pack'),
    ('Karaage Chicken Burger','Karaage Chicken Burger'),
    ('Sweet Potato Fries','Sweet Potato Fries'),
    ('Cajun Shaker Fries','Cajun Shaker Fries'),
    ('Wingzab Shaker Fries','Wing ZAB Shaker Fries'),
    ('Hot and Spicy Shaker Fries','Hot and Spicy Shaker Fries'),
    ('Cheesy Bacon Fries','Cheesy Bacon Fries'),
    ('Coleslaw with Bacon','Coleslaw with Bacon'),
    ('Chicken Fillet Sriracha Burger','Sriracha Chicken Fillet Burger')
)
INSERT INTO ordering_menu_item_recipe_links(menu_item_id,recipe_id,updated_at)
SELECT mi.id,r.id,NOW()
FROM mappings m JOIN ordering_menu_items mi ON mi.name_en=m.menu_name
JOIN recipes r ON r.name=m.recipe_name
ON CONFLICT(menu_item_id) DO UPDATE SET recipe_id=EXCLUDED.recipe_id,updated_at=NOW();
-- Packaged drinks use verified Purchasing unit costs rather than artificial recipes.
WITH costs(menu_name,unit_cost) AS (
  VALUES
    ('Coke',13.5000::numeric),
    ('Coke No Sugar',14.0000::numeric),
    ('Fanta Orange',13.5000::numeric),
    ('Fanta Strawberry',13.5000::numeric),
    ('Sprite',13.5000::numeric),
    ('Drinking Water',4.0833::numeric),
    ('Schweppes Manao',14.0000::numeric),
    ('Soda Water',8.6667::numeric)
)
INSERT INTO pos_item_costing_config(menu_item_id,costing_mode,recipe_id,direct_unit_cost,notes,updated_at)
SELECT mi.id,'direct',NULL,c.unit_cost,'Verified Purchasing unit cost; COGS phase 2026-09-13',NOW()
FROM costs c JOIN ordering_menu_items mi ON mi.name_en=c.menu_name
ON CONFLICT(menu_item_id) DO UPDATE
SET costing_mode='direct',recipe_id=NULL,direct_unit_cost=EXCLUDED.direct_unit_cost,
    notes=EXCLUDED.notes,updated_at=NOW();

-- Dedicated set products are costed as burger + approved fries recipe + drink allowance.
-- Exact historical selected drink was not recorded, so 14 THB is the verified highest
-- standard canned-drink unit cost. Kids set uses the verified 16.50 THB kids-juice cost.
WITH set_costs(menu_name,unit_cost) AS (
  SELECT 'Single Smash Burger Set',
         (SELECT cost_per_serving FROM recipes WHERE name='Single Smash Burger')+
         (SELECT cost_per_serving FROM recipes WHERE name='French Fries')+14.0000
  UNION ALL SELECT 'Ultimate Double Smash Burger Set',
         (SELECT cost_per_serving FROM recipes WHERE name='Ultimate Double Smash Burger')+
         (SELECT cost_per_serving FROM recipes WHERE name='French Fries')+14.0000
  UNION ALL SELECT 'Super Double Bacon and Cheese Set',
         (SELECT cost_per_serving FROM recipes WHERE name='Super Double Bacon and Cheese')+
         (SELECT cost_per_serving FROM recipes WHERE name='French Fries')+14.0000
  UNION ALL SELECT 'Triple Smash Burger Set',
         (SELECT cost_per_serving FROM recipes WHERE name='Triple Smash Burger')+
         (SELECT cost_per_serving FROM recipes WHERE name='French Fries')+14.0000
  UNION ALL SELECT 'Chicken Fillet Meal Deal',
         (SELECT cost_per_serving FROM recipes WHERE name='Chicken Fillet Burger')+
         (SELECT cost_per_serving FROM recipes WHERE name='French Fries')+14.0000
  UNION ALL SELECT 'Karaage Chicken Meal Deal',
         (SELECT cost_per_serving FROM recipes WHERE name='Karaage Chicken Burger')+
         (SELECT cost_per_serving FROM recipes WHERE name='French Fries')+14.0000
  UNION ALL SELECT 'Kids Cheeseburger Set',
         (SELECT cost_per_serving FROM recipes WHERE name='Kids Cheeseburger')+
         (SELECT cost_per_serving FROM recipes WHERE name='French Fries')+16.5000
)
INSERT INTO pos_item_costing_config(menu_item_id,costing_mode,recipe_id,direct_unit_cost,notes,updated_at)
SELECT mi.id,'direct',NULL,s.unit_cost,'Bundle COGS: base item + French Fries + verified drink allowance',NOW()
FROM set_costs s JOIN ordering_menu_items mi ON mi.name_en=s.menu_name
WHERE s.unit_cost IS NOT NULL
ON CONFLICT(menu_item_id) DO UPDATE
SET costing_mode='direct',recipe_id=NULL,direct_unit_cost=EXCLUDED.direct_unit_cost,
    notes=EXCLUDED.notes,updated_at=NOW();
-- Modifier recipes make paid Level Up choices visible to both COGS and ingredient usage.
WITH defs(name,total_cost,ingredients) AS (
  VALUES
  ('Modifier - Crispy Bacon',19.8000::numeric,
    jsonb_build_array(jsonb_build_object('name','Bacon Long','unitUsed','g','quantityUsed',45,'sourceType','purchasing','purchasingItemId',86))),
  ('Modifier - Double Cheese',4.1531::numeric,
    jsonb_build_array(jsonb_build_object('name','Cheese','unitUsed','g','quantityUsed',11.9,'sourceType','manual'))),
  ('Modifier - Jalapenos',3.8000::numeric,
    jsonb_build_array(jsonb_build_object('name','Jalapenos (tin)','unitUsed','g','quantityUsed',20,'sourceType','purchasing','purchasingItemId',90))),
  ('Modifier - Grilled Onions',1.4500::numeric,
    jsonb_build_array(jsonb_build_object('name','Onions Bulk 10kg','unitUsed','g','quantityUsed',50,'sourceType','purchasing','purchasingItemId',93))),
  ('Modifier - Spicy Sriracha Mayo',1.9034::numeric,
    jsonb_build_array(
      jsonb_build_object('name','Mayonnaise','unitUsed','g','quantityUsed',15,'sourceType','purchasing','purchasingItemId',133),
      jsonb_build_object('name','Sriracha Sauce','unitUsed','g','quantityUsed',5,'sourceType','purchasing','purchasingItemId',140))),
  ('Modifier - Crunchy Fried Onions',2.3700::numeric,
    jsonb_build_array(jsonb_build_object('name','Crispy Fried Onions','unitUsed','g','quantityUsed',15,'sourceType','purchasing','purchasingItemId',130)))
)
INSERT INTO recipes(name,category,yield_quantity,yield_unit,ingredients,total_cost,cost_per_serving,is_active,created_at,updated_at)
SELECT d.name,'Modifier',1,'serving',d.ingredients,d.total_cost,d.total_cost,true,NOW(),NOW()
FROM defs d WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.name=d.name);
WITH defs(name,total_cost,grams) AS (
  VALUES
    ('Modifier - Nuggets +3',13.4850::numeric,87::numeric),
    ('Modifier - Nuggets +6',26.9700::numeric,174::numeric),
    ('Modifier - Nuggets +18',80.9100::numeric,522::numeric)
)
INSERT INTO recipes(name,category,yield_quantity,yield_unit,ingredients,total_cost,cost_per_serving,is_active,created_at,updated_at)
SELECT d.name,'Modifier',1,'serving',
       jsonb_build_array(jsonb_build_object('name','Chicken Nuggets','unitUsed','g','quantityUsed',d.grams,'sourceType','purchasing','purchasingItemId',99)),
       d.total_cost,d.total_cost,true,NOW(),NOW()
FROM defs d WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.name=d.name);

-- Attach the six Level Up modifiers to their accounting recipes.
WITH mappings(modifier_name,recipe_name) AS (
  VALUES
    ('Crispy Bacon','Modifier - Crispy Bacon'),
    ('Double Cheese','Modifier - Double Cheese'),
    ('Jalapenos','Modifier - Jalapenos'),
    ('Grilled Onions','Modifier - Grilled Onions'),
    ('Spicy Sriracha Mayo','Modifier - Spicy Sriracha Mayo'),
    ('Crunchy Fried Onions','Modifier - Crunchy Fried Onions')
)
INSERT INTO pos_modifier_costing_config(item_modifier_id,costing_mode,recipe_id,direct_unit_cost,notes,usage_multiplier,updated_at)
SELECT m.id,'recipe',r.id,NULL,'Level Up modifier recipe accounting',1,NOW()
FROM mappings x JOIN ordering_item_modifiers m ON m.name_en=x.modifier_name
JOIN recipes r ON r.name=x.recipe_name
ON CONFLICT(item_modifier_id) DO UPDATE
SET costing_mode='recipe',recipe_id=EXCLUDED.recipe_id,direct_unit_cost=NULL,notes=EXCLUDED.notes,usage_multiplier=1,updated_at=NOW();
-- Nugget size options: base item is six nuggets; option recipes account only for the increment.
WITH mappings(option_name,recipe_name) AS (
  VALUES
    ('9 nuggets','Modifier - Nuggets +3'),
    ('12 nuggets','Modifier - Nuggets +6'),
    ('24 nuggets','Modifier - Nuggets +18')
)
INSERT INTO pos_modifier_costing_config(item_modifier_id,costing_mode,recipe_id,direct_unit_cost,notes,usage_multiplier,updated_at)
SELECT m.id,'recipe',r.id,NULL,'Increment above the six-nugget base recipe',1,NOW()
FROM mappings x
JOIN ordering_item_modifiers m ON m.name_en=x.option_name
JOIN ordering_modifier_groups g ON g.id=m.modifier_group_id AND g.name_en='Choose size'
JOIN recipes r ON r.name=x.recipe_name
ON CONFLICT(item_modifier_id) DO UPDATE
SET costing_mode='recipe',recipe_id=EXCLUDED.recipe_id,direct_unit_cost=NULL,notes=EXCLUDED.notes,usage_multiplier=1,updated_at=NOW();

-- Selecting the base six-piece option must be an explicitly costed zero increment,
-- otherwise the modifier snapshot would incorrectly make the whole sale uncosted.
INSERT INTO pos_modifier_costing_config(item_modifier_id,costing_mode,recipe_id,direct_unit_cost,notes,usage_multiplier,updated_at)
SELECT m.id,'direct',NULL,0.0000,'Six-piece base: no incremental cost',1,NOW()
FROM ordering_item_modifiers m JOIN ordering_modifier_groups g ON g.id=m.modifier_group_id
WHERE g.name_en='Choose size' AND m.name_en='6 nuggets'
ON CONFLICT(item_modifier_id) DO UPDATE
SET costing_mode='direct',recipe_id=NULL,direct_unit_cost=0.0000,notes=EXCLUDED.notes,usage_multiplier=1,updated_at=NOW();
-- Backfill any POS-era normal sale that has no snapshot at all.
SELECT capture_order_item_cost_snapshot(i.id,'phase2_backfill')
FROM ordering_order_items i
JOIN ordering_orders o ON o.id=i.order_id
LEFT JOIN ordering_order_item_cost_snapshots s ON s.order_item_id=i.id
WHERE o.created_at >= TIMESTAMPTZ '2026-08-08 20:00:00+00'
  AND s.order_item_id IS NULL
  AND i.item_name_en <> 'Biggest Meal Deal Ever';

-- Repair missing/partial direct-cost snapshots and refresh prior bundle backfills.
UPDATE ordering_order_item_cost_snapshots s
SET costing_mode='direct',costing_status='direct',recipe_id=NULL,recipe_name=NULL,
    unit_cost=cfg.direct_unit_cost,total_cost=cfg.direct_unit_cost*i.quantity,
    ingredient_snapshot='[]'::jsonb,recipe_yield=NULL,snapshot_origin='phase2_backfill',captured_at=NOW()
FROM ordering_order_items i
JOIN ordering_orders o ON o.id=i.order_id
JOIN pos_item_costing_config cfg ON cfg.menu_item_id=i.menu_item_id AND cfg.costing_mode='direct'
WHERE s.order_item_id=i.id
  AND o.created_at >= TIMESTAMPTZ '2026-08-08 20:00:00+00'
  AND i.item_name_en <> 'Biggest Meal Deal Ever'
  AND (
    s.costing_status NOT IN ('complete','direct') OR s.unit_cost IS NULL
    OR (s.snapshot_origin='phase2_backfill' AND i.item_name_en IN (
      'Single Smash Burger Set','Ultimate Double Smash Burger Set','Super Double Bacon and Cheese Set',
      'Triple Smash Burger Set','Chicken Fillet Meal Deal','Karaage Chicken Meal Deal','Kids Cheeseburger Set'
    ))
  );
-- Repair missing/partial recipe snapshots from the now-canonical recipe links.
UPDATE ordering_order_item_cost_snapshots s
SET costing_mode='recipe',costing_status='complete',recipe_id=r.id,recipe_name=r.name,
    unit_cost=r.cost_per_serving,total_cost=r.cost_per_serving*i.quantity,
    ingredient_snapshot=COALESCE(r.ingredients,'[]'::jsonb),
    recipe_yield=COALESCE(r.yield_quantity,1),snapshot_origin='phase2_backfill',captured_at=NOW()
FROM ordering_order_items i
JOIN ordering_orders o ON o.id=i.order_id
JOIN ordering_menu_item_recipe_links l ON l.menu_item_id=i.menu_item_id
JOIN recipes r ON r.id=l.recipe_id
WHERE s.order_item_id=i.id
  AND o.created_at >= TIMESTAMPTZ '2026-08-08 20:00:00+00'
  AND i.item_name_en <> 'Biggest Meal Deal Ever'
  AND (s.costing_status NOT IN ('complete','direct') OR s.unit_cost IS NULL)
  AND r.cost_per_serving IS NOT NULL
  AND jsonb_typeof(COALESCE(r.ingredients,'[]'::jsonb))='array'
  AND jsonb_array_length(COALESCE(r.ingredients,'[]'::jsonb))>0;

-- Create missing modifier snapshots now that nugget and Level Up costing is configured.
SELECT capture_modifier_cost_snapshot(m.id,'phase2_backfill')
FROM ordering_order_item_modifiers m
JOIN ordering_order_items i ON i.id=m.order_item_id
JOIN ordering_orders o ON o.id=i.order_id
LEFT JOIN ordering_modifier_cost_snapshots s ON s.order_item_modifier_id=m.id
WHERE o.created_at >= TIMESTAMPTZ '2026-08-08 20:00:00+00'
  AND s.order_item_modifier_id IS NULL
  AND m.item_modifier_id IS NOT NULL
  AND i.item_name_en <> 'Biggest Meal Deal Ever';
-- Repair existing missing/partial direct modifier snapshots (the six-piece nugget choice).
UPDATE ordering_modifier_cost_snapshots s
SET costing_mode='direct',costing_status='direct',recipe_id=NULL,recipe_name=NULL,
    unit_cost=cfg.direct_unit_cost,total_cost=cfg.direct_unit_cost*m.quantity,
    ingredient_snapshot='[]'::jsonb,recipe_yield=NULL,usage_multiplier=COALESCE(NULLIF(cfg.usage_multiplier,0),1),
    snapshot_origin='phase2_backfill',captured_at=NOW()
FROM ordering_order_item_modifiers m
JOIN ordering_order_items i ON i.id=m.order_item_id
JOIN ordering_orders o ON o.id=i.order_id
JOIN pos_modifier_costing_config cfg ON cfg.item_modifier_id=m.item_modifier_id AND cfg.costing_mode='direct'
WHERE s.order_item_modifier_id=m.id
  AND o.created_at >= TIMESTAMPTZ '2026-08-08 20:00:00+00'
  AND i.item_name_en <> 'Biggest Meal Deal Ever'
  AND (s.costing_status NOT IN ('complete','direct') OR s.unit_cost IS NULL);

-- Repair existing missing/partial recipe modifier snapshots.
UPDATE ordering_modifier_cost_snapshots s
SET costing_mode='recipe',costing_status='complete',recipe_id=r.id,recipe_name=r.name,
    unit_cost=r.cost_per_serving,total_cost=r.cost_per_serving*m.quantity,
    ingredient_snapshot=COALESCE(r.ingredients,'[]'::jsonb),recipe_yield=COALESCE(r.yield_quantity,1),
    usage_multiplier=COALESCE(NULLIF(cfg.usage_multiplier,0),1),snapshot_origin='phase2_backfill',captured_at=NOW()
FROM ordering_order_item_modifiers m
JOIN ordering_order_items i ON i.id=m.order_item_id
JOIN ordering_orders o ON o.id=i.order_id
JOIN pos_modifier_costing_config cfg ON cfg.item_modifier_id=m.item_modifier_id AND cfg.costing_mode='recipe'
JOIN recipes r ON r.id=cfg.recipe_id
WHERE s.order_item_modifier_id=m.id
  AND o.created_at >= TIMESTAMPTZ '2026-08-08 20:00:00+00'
  AND i.item_name_en <> 'Biggest Meal Deal Ever'
  AND (s.costing_status NOT IN ('complete','direct') OR s.unit_cost IS NULL);
-- Make it Better applies to every burger and every meal deal, including Grab orders.
INSERT INTO ordering_modifier_groups(menu_item_id,name_en,min_select,max_select,is_required,sort_order)
SELECT i.id,'Make it Better',0,6,false,10
FROM ordering_menu_items i
JOIN ordering_menu_categories c ON c.id=i.category_id
WHERE c.name_en IN ('Burgers','Chicken Burgers','Meal Deals')
  AND NOT EXISTS (
    SELECT 1 FROM ordering_modifier_groups g
    WHERE g.menu_item_id=i.id AND g.name_en='Make it Better'
  );

INSERT INTO ordering_item_modifiers(modifier_group_id,name_en,price_delta,sort_order)
SELECT g.id,v.name_en,v.price_delta,v.sort_order
FROM ordering_modifier_groups g
JOIN ordering_menu_items i ON i.id=g.menu_item_id
JOIN ordering_menu_categories c ON c.id=i.category_id
JOIN (VALUES
  ('Crispy Bacon',40,1),
  ('Double Cheese',40,2),
  ('Jalapenos',40,3),
  ('Grilled Onions',30,4),
  ('Spicy Sriracha Mayo',40,5),
  ('Crunchy Fried Onions',40,6)
) AS v(name_en,price_delta,sort_order) ON true
WHERE g.name_en='Make it Better'
  AND c.name_en IN ('Burgers','Chicken Burgers','Meal Deals')
  AND NOT EXISTS (
    SELECT 1 FROM ordering_item_modifiers m
    WHERE m.modifier_group_id=g.id AND m.name_en=v.name_en
  );

-- Confirmed SBB Grab menu. Direct prices intentionally start equal to Grab prices
-- until the owner supplies the final direct-price schedule; both columns remain editable.
INSERT INTO ordering_menu_categories (name_en, sort_order)
SELECT v.name, v.sort_order FROM (VALUES
 ('Burgers',1),('Chicken Burgers',2),('Shaker Fries',3),('Meal Deals',4),('Sides',5),('Drinks',6)
) v(name,sort_order) WHERE NOT EXISTS (SELECT 1 FROM ordering_menu_categories c WHERE lower(c.name_en)=lower(v.name));

WITH menu(category,name,price,sort,is_upgrade) AS (VALUES
 ('Burgers','Original Single Smash Burger',189,1,true),('Burgers','Ultimate Double Smash Burger',260,2,true),('Burgers','Super Double Bacon and Cheese',280,3,true),('Burgers','Triple Smash Burger',330,4,true),
 ('Chicken Burgers','Crispy Chicken Fillet Burger',190,1,true),('Chicken Burgers','Karaage Chicken Burger',260,2,true),('Chicken Burgers','Chicken Fillet Sriracha Burger',249,3,true),
 ('Shaker Fries','Cajun Shaker Fries',130,1,false),('Shaker Fries','Hot and Spicy Shaker Fries',130,2,false),('Shaker Fries','Wingzab Shaker Fries',130,3,false),
 ('Meal Deals','Chicken Fillet Meal Deal',270,1,false),('Meal Deals','Karaage Chicken Meal Deal',330,2,false),('Meal Deals','Single Smash Burger Set',270,3,false),('Meal Deals','Ultimate Double Smash Burger Set',340,4,false),('Meal Deals','Super Double Bacon and Cheese Set',360,5,false),('Meal Deals','Triple Smash Burger Set',410,6,false),
 ('Sides','Dirty Fries',249,1,false),('Sides','Coleslaw with Bacon',99,2,false),('Sides','French Fries',99,3,false),('Sides','Cheesy Bacon Fries',119,4,false),('Sides','Loaded Fries',180,5,false),('Sides','Sweet Potato Fries',119,6,false),('Sides','Chicken Nuggets (6)',89,7,false),
 ('Drinks','Coke',40,1,false),('Drinks','Coke No Sugar',40,2,false),('Drinks','Schweppes Manao',40,3,false),('Drinks','Fanta Orange',40,4,false),('Drinks','Fanta Strawberry',40,5,false),('Drinks','Soda Water',40,6,false),('Drinks','Drinking Water',40,7,false)
)
INSERT INTO ordering_menu_items(category_id,name_en,price,direct_price,grab_price,pos_enabled,set_upgrade_eligible,sort_order,source_sku)
SELECT c.id,m.name,m.price,m.price,m.price,true,m.is_upgrade,m.sort,'sbb-pos-'||replace(lower(m.name),' ','-')
FROM menu m JOIN ordering_menu_categories c ON lower(c.name_en)=lower(m.category)
WHERE NOT EXISTS (SELECT 1 FROM ordering_menu_items i WHERE lower(i.name_en)=lower(m.name));

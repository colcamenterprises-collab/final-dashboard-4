-- Ensure the default set drink is present and available on every POS.
WITH drinks AS (
  SELECT id FROM ordering_menu_categories WHERE lower(name_en)=lower('Drinks') LIMIT 1
)
INSERT INTO ordering_menu_items(category_id,name_en,price,direct_price,grab_price,pos_enabled,set_upgrade_eligible,sort_order,source_sku,is_active,is_sold_out)
SELECT id,'Coke',40,40,40,true,false,1,'sbb-pos-coke',true,false FROM drinks
ON CONFLICT (source_sku) WHERE source_sku IS NOT NULL DO UPDATE
SET name_en='Coke',price=40,direct_price=40,grab_price=40,pos_enabled=true,is_active=true,is_sold_out=false,sort_order=1;

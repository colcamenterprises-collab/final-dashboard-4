UPDATE ordering_menu_items SET image_url='/images/menu/french-fries.webp', updated_at=NOW() WHERE lower(name_en)=lower('French Fries');
UPDATE ordering_menu_items SET image_url='/images/menu/cajun-fries.webp', updated_at=NOW() WHERE lower(name_en)=lower('Cajun Shaker Fries');
UPDATE ordering_menu_items SET image_url='/images/menu/cheesy-bacon-fries.webp', updated_at=NOW() WHERE lower(name_en)=lower('Cheesy Bacon Fries');
UPDATE ordering_menu_items SET image_url='/images/menu/loaded-fries.webp', updated_at=NOW() WHERE lower(name_en) IN (lower('Loaded Fries'), lower('Dirty Fries'));
UPDATE ordering_menu_items SET image_url='/images/menu/chicken-nuggets.webp', updated_at=NOW() WHERE lower(name_en)=lower('Chicken Nuggets (6)');
UPDATE ordering_menu_items SET image_url='/images/menu/coleslaw.webp', updated_at=NOW() WHERE lower(name_en)=lower('Coleslaw with Bacon');

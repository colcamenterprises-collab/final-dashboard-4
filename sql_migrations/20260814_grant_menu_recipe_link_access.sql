BEGIN;

-- The menu API connects as sbb_prod_app while this table is created by postgres.
-- Grant the application role the access required to read and persist recipe links.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.ordering_menu_item_recipe_links
  TO sbb_prod_app;

COMMIT;

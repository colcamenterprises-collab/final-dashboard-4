import { pool } from "../../db";

const db = () => {
  if (!pool) throw new Error("Menu database is unavailable");
  return pool;
};

const mapItem = (row: any) => ({
  id: String(row.id),
  categoryId: String(row.category_id),
  category: row.category_name,
  name: row.name_en,
  description: row.description_en ?? null,
  basePrice: Number(row.direct_price ?? row.price ?? 0),
  price: Number(row.direct_price ?? row.price ?? 0),
  directPrice: Number(row.direct_price ?? row.price ?? 0),
  grabPrice: Number(row.grab_price ?? row.direct_price ?? row.price ?? 0),
  imageUrl: row.image_url ?? null,
  posEnabled: row.pos_enabled !== false,
  onlineEnabled: row.pos_enabled !== false,
  isOnlineEnabled: row.pos_enabled !== false,
  isActive: row.is_active !== false,
  soldOut: row.is_sold_out === true,
  displayOrder: Number(row.sort_order ?? 0),
  sortOrder: Number(row.sort_order ?? 0),
  recipeId: row.recipe_id ?? null,
});

export async function getAllItems() {
  const result = await db().query(
    `SELECT i.*, c.name_en AS category_name,
            mir.recipe_id
       FROM ordering_menu_items i
       JOIN ordering_menu_categories c ON c.id=i.category_id
       LEFT JOIN ordering_menu_item_recipe_links mir ON mir.menu_item_id=i.id
      ORDER BY c.sort_order, i.sort_order, i.name_en`,
  ).catch(async () => db().query(
    `SELECT i.*, c.name_en AS category_name, NULL::integer AS recipe_id
       FROM ordering_menu_items i
       JOIN ordering_menu_categories c ON c.id=i.category_id
      ORDER BY c.sort_order, i.sort_order, i.name_en`,
  ));
  return result.rows.map(mapItem);
}

async function saveRecipeLink(client: any, itemId: string, recipeId: number | null | undefined) {
  if (recipeId === undefined) return;
  await client.query(`DELETE FROM ordering_menu_item_recipe_links WHERE menu_item_id=$1`, [itemId]);
  if (recipeId === null) return;
  await client.query(
    `INSERT INTO ordering_menu_item_recipe_links(menu_item_id, recipe_id, updated_at)
     VALUES($1,$2,NOW())`,
    [itemId, recipeId],
  );
}

async function saveModifierLinks(client: any, itemId: string, modifierGroupIds: string[] | undefined) {
  if (!Array.isArray(modifierGroupIds)) return;
  await client.query(`DELETE FROM ordering_modifier_group_items WHERE menu_item_id=$1`, [itemId]);
  if (modifierGroupIds.length) {
    await client.query(
      `INSERT INTO ordering_modifier_group_items(modifier_group_id, menu_item_id, sort_order)
       SELECT id, $1::uuid, COALESCE(sort_order, 0)
         FROM ordering_modifier_groups
        WHERE id = ANY($2::uuid[])
       ON CONFLICT (modifier_group_id, menu_item_id) DO NOTHING`,
      [itemId, modifierGroupIds],
    );
  }
}

export async function createItem(data: any) {
  const name = String(data?.name ?? data?.name_en ?? "").trim();
  const categoryId = data?.categoryId ?? data?.category_id;
  if (!name || !categoryId) throw new Error("Item name and category are required");
  const directPrice = Number(data?.directPrice ?? data?.basePrice ?? data?.price ?? 0);
  const grabPrice = Number(data?.grabPrice ?? data?.deliveryPartnerPrice ?? directPrice);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO ordering_menu_items(
         category_id,name_en,description_en,price,direct_price,grab_price,image_url,
         is_active,is_sold_out,pos_enabled,sort_order
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [categoryId, name, data?.description ?? data?.description_en ?? null, directPrice, directPrice, grabPrice, data?.imageUrl ?? data?.image_url ?? null, data?.isActive !== false, data?.soldOut === true, (data?.posEnabled ?? data?.onlineEnabled ?? data?.isOnlineEnabled ?? true) !== false, Number(data?.displayOrder ?? data?.sortOrder ?? 0)],
    );
    const itemId = String(result.rows[0].id);
    await saveRecipeLink(client, itemId, data?.recipeId === undefined ? undefined : data.recipeId === null ? null : Number(data.recipeId));
    await saveModifierLinks(client, itemId, data?.modifierGroupIds);
    await client.query("COMMIT");
    const category = await db().query(`SELECT name_en FROM ordering_menu_categories WHERE id=$1`, [categoryId]);
    return mapItem({ ...result.rows[0], category_name: category.rows[0]?.name_en, recipe_id: data?.recipeId ?? null });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateItem(id: string, data: any) {
  const directPriceInput = data?.directPrice ?? data?.basePrice ?? data?.price;
  const grabPriceInput = data?.grabPrice ?? data?.deliveryPartnerPrice;
  const clearImage = data?.clearImage === true;
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE ordering_menu_items SET
         category_id=COALESCE($2,category_id), name_en=COALESCE($3,name_en),
         description_en=COALESCE($4,description_en), price=COALESCE($5,price),
         direct_price=COALESCE($5,direct_price), grab_price=COALESCE($6,grab_price),
         image_url=CASE WHEN $12::boolean THEN NULL ELSE COALESCE($7,image_url) END,
         is_active=COALESCE($8,is_active), is_sold_out=COALESCE($9,is_sold_out),
         pos_enabled=COALESCE($10,pos_enabled), sort_order=COALESCE($11,sort_order),
         updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id, data?.categoryId ?? data?.category_id ?? null, String(data?.name ?? data?.name_en ?? "").trim() || null, data?.description ?? data?.description_en ?? null, directPriceInput === undefined ? null : Number(directPriceInput), grabPriceInput === undefined ? null : Number(grabPriceInput), data?.imageUrl ?? data?.image_url ?? null, typeof data?.isActive === "boolean" ? data.isActive : null, typeof data?.soldOut === "boolean" ? data.soldOut : null, typeof (data?.posEnabled ?? data?.onlineEnabled ?? data?.isOnlineEnabled) === "boolean" ? Boolean(data?.posEnabled ?? data?.onlineEnabled ?? data?.isOnlineEnabled) : null, data?.displayOrder === undefined && data?.sortOrder === undefined ? null : Number(data?.displayOrder ?? data?.sortOrder), clearImage],
    );
    if (!result.rows[0]) throw new Error("Menu item not found");
    await saveRecipeLink(client, id, data?.recipeId === undefined ? undefined : data.recipeId === null ? null : Number(data.recipeId));
    await saveModifierLinks(client, id, data?.modifierGroupIds);
    await client.query("COMMIT");
    const category = await db().query(`SELECT name_en FROM ordering_menu_categories WHERE id=$1`, [result.rows[0].category_id]);
    return mapItem({ ...result.rows[0], category_name: category.rows[0]?.name_en, recipe_id: data?.recipeId ?? null });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleItem(id: string, isActive: boolean) {
  const result = await db().query(`UPDATE ordering_menu_items SET is_active=$2, updated_at=NOW() WHERE id=$1 RETURNING *`, [id, isActive]);
  if (!result.rows[0]) throw new Error("Menu item not found");
  return mapItem(result.rows[0]);
}

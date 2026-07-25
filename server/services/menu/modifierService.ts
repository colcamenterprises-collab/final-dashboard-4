import { pool } from "../../db";

const db = () => {
  if (!pool) throw new Error("Menu database is unavailable");
  return pool;
};

const mapOption = (row: any) => ({
  id: String(row.id),
  name: row.name_en,
  thaiName: row.name_th ?? null,
  price: Number(row.price_delta ?? 0),
  priceDelta: Number(row.price_delta ?? 0),
  active: row.is_active !== false,
  isActive: row.is_active !== false,
  sortOrder: Number(row.sort_order ?? 0),
});

export async function getModifierGroups() {
  const [groups, options] = await Promise.all([
    db().query(
      `SELECT g.id, g.name_en, g.name_th, g.menu_item_id, g.sort_order, g.is_active,
              i.name_en AS menu_item_name
         FROM ordering_modifier_groups g
         LEFT JOIN ordering_menu_items i ON i.id=g.menu_item_id
        ORDER BY g.sort_order, g.name_en`,
    ),
    db().query(
      `SELECT id, modifier_group_id, name_en, name_th, price_delta, sort_order, is_active
         FROM ordering_item_modifiers
        ORDER BY sort_order, name_en`,
    ),
  ]);
  const optionsByGroup = new Map<string, any[]>();
  for (const option of options.rows) {
    const key = String(option.modifier_group_id);
    optionsByGroup.set(key, [...(optionsByGroup.get(key) || []), mapOption(option)]);
  }
  return groups.rows.map((row) => ({
    id: String(row.id),
    name: row.name_en,
    name_en: row.name_en,
    name_th: row.name_th ?? null,
    menuItemId: row.menu_item_id ? String(row.menu_item_id) : "",
    linkedMenuItemIds: row.menu_item_id ? [String(row.menu_item_id)] : [],
    linkedMenuItemNames: row.menu_item_name ? [row.menu_item_name] : [],
    options: optionsByGroup.get(String(row.id)) || [],
    modifiers: optionsByGroup.get(String(row.id)) || [],
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

export async function createModifierGroup(data: any) {
  const name = String(data?.name ?? data?.name_en ?? "").trim();
  const menuItemId = data?.menuItemId ?? data?.menu_item_id;
  if (!name || !menuItemId) throw new Error("Modifier group name and linked menu item are required");
  const result = await db().query(
    `INSERT INTO ordering_modifier_groups(name_en,name_th,menu_item_id,sort_order,is_active)
     VALUES($1,$2,$3,$4,$5)
     RETURNING id,name_en,name_th,menu_item_id,sort_order,is_active`,
    [name, data?.name_th || null, menuItemId, Number(data?.sortOrder ?? 0), data?.isActive !== false],
  );
  return {
    id: String(result.rows[0].id),
    name: result.rows[0].name_en,
    menuItemId: String(result.rows[0].menu_item_id),
    linkedMenuItemIds: [String(result.rows[0].menu_item_id)],
    options: [],
    modifiers: [],
    isActive: result.rows[0].is_active !== false,
  };
}

export async function updateModifierGroup(id: string, data: any) {
  const result = await db().query(
    `UPDATE ordering_modifier_groups SET
       name_en=COALESCE($2,name_en),
       name_th=COALESCE($3,name_th),
       menu_item_id=COALESCE($4,menu_item_id),
       sort_order=COALESCE($5,sort_order),
       is_active=COALESCE($6,is_active),
       updated_at=NOW()
     WHERE id=$1
     RETURNING id,name_en,name_th,menu_item_id,sort_order,is_active`,
    [
      id,
      String(data?.name ?? data?.name_en ?? "").trim() || null,
      data?.name_th || null,
      data?.menuItemId ?? data?.menu_item_id ?? null,
      data?.sortOrder === undefined ? null : Number(data.sortOrder),
      typeof data?.isActive === "boolean" ? data.isActive : null,
    ],
  );
  if (!result.rows[0]) throw new Error("Modifier group not found");
  return result.rows[0];
}

export async function deleteModifierGroup(id: string) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM ordering_item_modifiers WHERE modifier_group_id=$1`, [id]);
    const result = await client.query(`DELETE FROM ordering_modifier_groups WHERE id=$1 RETURNING id`, [id]);
    await client.query("COMMIT");
    if (!result.rows[0]) throw new Error("Modifier group not found");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createModifier(groupId: string, data: any) {
  const name = String(data?.name ?? data?.name_en ?? "").trim();
  if (!name) throw new Error("Modifier option name is required");
  const result = await db().query(
    `INSERT INTO ordering_item_modifiers(modifier_group_id,name_en,name_th,price_delta,sort_order,is_active)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id,modifier_group_id,name_en,name_th,price_delta,sort_order,is_active`,
    [groupId, name, data?.thaiName ?? data?.name_th ?? null, Number(data?.priceDelta ?? data?.price ?? 0), Number(data?.sortOrder ?? 0), data?.isActive !== false],
  );
  return mapOption(result.rows[0]);
}

export async function updateModifier(id: string, data: any) {
  const result = await db().query(
    `UPDATE ordering_item_modifiers SET
       name_en=COALESCE($2,name_en),
       name_th=COALESCE($3,name_th),
       price_delta=COALESCE($4,price_delta),
       sort_order=COALESCE($5,sort_order),
       is_active=COALESCE($6,is_active),
       updated_at=NOW()
     WHERE id=$1
     RETURNING id,modifier_group_id,name_en,name_th,price_delta,sort_order,is_active`,
    [
      id,
      String(data?.name ?? data?.name_en ?? "").trim() || null,
      data?.thaiName ?? data?.name_th ?? null,
      data?.priceDelta === undefined && data?.price === undefined ? null : Number(data?.priceDelta ?? data?.price),
      data?.sortOrder === undefined ? null : Number(data.sortOrder),
      typeof (data?.isActive ?? data?.active) === "boolean" ? Boolean(data?.isActive ?? data?.active) : null,
    ],
  );
  if (!result.rows[0]) throw new Error("Modifier option not found");
  return mapOption(result.rows[0]);
}

export async function deleteModifier(id: string) {
  const result = await db().query(`DELETE FROM ordering_item_modifiers WHERE id=$1 RETURNING id`, [id]);
  if (!result.rows[0]) throw new Error("Modifier option not found");
  return result.rows[0];
}

export async function applyGroupToItem(groupId: string, itemId: string) {
  const result = await db().query(
    `UPDATE ordering_modifier_groups SET menu_item_id=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
    [groupId, itemId],
  );
  if (!result.rows[0]) throw new Error("Modifier group not found");
  return result.rows[0];
}

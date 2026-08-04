import { pool } from "../../db";

const db = () => {
  if (!pool) throw new Error("Menu database is unavailable");
  return pool;
};

const mapCategory = (row: any) => ({
  id: String(row.id),
  name: row.name_en,
  name_en: row.name_en,
  name_th: row.name_th ?? null,
  sortOrder: Number(row.sort_order ?? 0),
  displayOrder: Number(row.sort_order ?? 0),
  isActive: row.is_active !== false,
  onlineEnabled: row.is_active !== false,
  visibleOnline: row.is_active !== false,
});

export async function getAllCategories() {
  const result = await db().query(
    `SELECT id, name_en, name_th, sort_order, is_active
       FROM ordering_menu_categories
      ORDER BY sort_order, name_en`,
  );
  return result.rows.map(mapCategory);
}

export async function createCategory(data: any) {
  const name = String(data?.name ?? data?.name_en ?? "").trim();
  if (!name) throw new Error("Category name is required");
  const result = await db().query(
    `INSERT INTO ordering_menu_categories(name_en, name_th, sort_order, is_active)
     VALUES($1,$2,$3,$4)
     RETURNING id, name_en, name_th, sort_order, is_active`,
    [name, data?.name_th || null, Number(data?.sortOrder ?? data?.displayOrder ?? 0), data?.isActive !== false],
  );
  return mapCategory(result.rows[0]);
}

export async function updateCategory(id: string, data: any) {
  const result = await db().query(
    `UPDATE ordering_menu_categories SET
       name_en=COALESCE($2,name_en),
       name_th=COALESCE($3,name_th),
       sort_order=COALESCE($4,sort_order),
       is_active=COALESCE($5,is_active),
       updated_at=NOW()
     WHERE id=$1
     RETURNING id, name_en, name_th, sort_order, is_active`,
    [
      id,
      String(data?.name ?? data?.name_en ?? "").trim() || null,
      data?.name_th || null,
      data?.sortOrder === undefined && data?.displayOrder === undefined ? null : Number(data?.sortOrder ?? data?.displayOrder),
      typeof data?.isActive === "boolean" ? data.isActive : null,
    ],
  );
  if (!result.rows[0]) throw new Error("Category not found");
  return mapCategory(result.rows[0]);
}

export async function reorderCategories(orderList: string[]) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    for (let index = 0; index < orderList.length; index += 1) {
      await client.query(
        `UPDATE ordering_menu_categories SET sort_order=$2, updated_at=NOW() WHERE id=$1`,
        [orderList[index], index],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteCategory(id: string) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const categoryResult = await client.query(
      `SELECT id, name_en, name_th, sort_order, is_active FROM ordering_menu_categories WHERE id=$1 FOR UPDATE`,
      [id],
    );
    const category = categoryResult.rows[0];
    if (!category) throw new Error("Category not found");

    const itemResult = await client.query(
      `DELETE FROM ordering_menu_items WHERE category_id=$1 RETURNING id, name_en`,
      [id],
    );
    await client.query(`DELETE FROM ordering_menu_categories WHERE id=$1`, [id]);
    await client.query("COMMIT");

    return {
      success: true,
      deletedCategory: mapCategory(category),
      deletedItemCount: itemResult.rowCount ?? itemResult.rows.length,
      deletedItems: itemResult.rows.map((row: any) => ({ id: String(row.id), name: row.name_en })),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

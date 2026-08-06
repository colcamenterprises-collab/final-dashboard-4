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
  recipeId: row.recipe_id ?? null,
  addedMenuItemId: row.added_menu_item_id ? String(row.added_menu_item_id) : null,
  requiresGroupId: row.requires_group_id ? String(row.requires_group_id) : null,
});

export async function getModifierGroups() {
  const [groups, options, assignments] = await Promise.all([
    db().query(`SELECT id,name_en,name_th,sort_order,is_active,
      COALESCE(group_type,'modifier') AS group_type,
      COALESCE(selection_mode,'multiple') AS selection_mode,
      COALESCE(min_selections,0) AS min_selections,
      max_selections,prompt_text
      FROM ordering_modifier_groups ORDER BY sort_order,name_en`),
    db().query(`SELECT id,modifier_group_id,name_en,name_th,price_delta,sort_order,is_active,
      recipe_id,added_menu_item_id,requires_group_id
      FROM ordering_item_modifiers ORDER BY sort_order,name_en`),
    db().query(`SELECT a.modifier_group_id,a.menu_item_id,i.name_en AS menu_item_name
      FROM ordering_modifier_group_items a
      JOIN ordering_menu_items i ON i.id=a.menu_item_id
      ORDER BY a.sort_order,i.name_en`),
  ]);

  const optionsByGroup = new Map<string, any[]>();
  for (const option of options.rows) {
    const key = String(option.modifier_group_id);
    optionsByGroup.set(key, [...(optionsByGroup.get(key) || []), mapOption(option)]);
  }
  const itemIdsByGroup = new Map<string, string[]>();
  const itemNamesByGroup = new Map<string, string[]>();
  for (const assignment of assignments.rows) {
    const key = String(assignment.modifier_group_id);
    itemIdsByGroup.set(key, [...(itemIdsByGroup.get(key) || []), String(assignment.menu_item_id)]);
    itemNamesByGroup.set(key, [...(itemNamesByGroup.get(key) || []), assignment.menu_item_name]);
  }

  return groups.rows.map((row) => ({
    id: String(row.id),
    name: row.name_en,
    name_en: row.name_en,
    name_th: row.name_th ?? null,
    type: row.group_type,
    groupType: row.group_type,
    selectionMode: row.selection_mode,
    minSelections: Number(row.min_selections ?? 0),
    maxSelections: row.max_selections === null ? null : Number(row.max_selections),
    promptText: row.prompt_text ?? null,
    linkedMenuItemIds: itemIdsByGroup.get(String(row.id)) || [],
    linkedMenuItemNames: itemNamesByGroup.get(String(row.id)) || [],
    options: optionsByGroup.get(String(row.id)) || [],
    modifiers: optionsByGroup.get(String(row.id)) || [],
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

export async function createModifierGroup(data: any) {
  const name = String(data?.name ?? data?.name_en ?? "").trim();
  if (!name) throw new Error("Modifier group name is required");
  const groupType = ["modifier", "upsell", "choice"].includes(data?.groupType ?? data?.type)
    ? (data?.groupType ?? data?.type)
    : "modifier";
  const selectionMode = data?.selectionMode === "single" ? "single" : "multiple";
  const result = await db().query(`INSERT INTO ordering_modifier_groups(
      name_en,name_th,menu_item_id,sort_order,is_active,group_type,selection_mode,
      min_selections,max_selections,prompt_text)
    VALUES($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *`, [
    name,
    data?.name_th || null,
    Number(data?.sortOrder ?? 0),
    data?.isActive !== false,
    groupType,
    selectionMode,
    Number(data?.minSelections ?? 0),
    data?.maxSelections === "" || data?.maxSelections == null ? null : Number(data.maxSelections),
    data?.promptText || null,
  ]);
  return { id: String(result.rows[0].id), name, groupType, selectionMode, linkedMenuItemIds: [], options: [], isActive: true };
}

export async function updateModifierGroup(id: string, data: any) {
  const result = await db().query(`UPDATE ordering_modifier_groups SET
      name_en=COALESCE($2,name_en),name_th=COALESCE($3,name_th),
      sort_order=COALESCE($4,sort_order),is_active=COALESCE($5,is_active),
      group_type=COALESCE($6,group_type),selection_mode=COALESCE($7,selection_mode),
      min_selections=COALESCE($8,min_selections),max_selections=$9,
      prompt_text=$10,updated_at=NOW()
    WHERE id=$1 RETURNING *`, [
    id,
    String(data?.name ?? data?.name_en ?? "").trim() || null,
    data?.name_th || null,
    data?.sortOrder === undefined ? null : Number(data.sortOrder),
    typeof data?.isActive === "boolean" ? data.isActive : null,
    data?.groupType ?? data?.type ?? null,
    data?.selectionMode ?? null,
    data?.minSelections === undefined ? null : Number(data.minSelections),
    data?.maxSelections === "" || data?.maxSelections == null ? null : Number(data.maxSelections),
    data?.promptText ?? null,
  ]);
  if (!result.rows[0]) throw new Error("Modifier group not found");
  return result.rows[0];
}

export async function setGroupAssignments(groupId: string, itemIds: string[]) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM ordering_modifier_group_items WHERE modifier_group_id=$1`, [groupId]);
    for (let i = 0; i < itemIds.length; i++) {
      await client.query(`INSERT INTO ordering_modifier_group_items(modifier_group_id,menu_item_id,sort_order)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [groupId, itemIds[i], i]);
    }
    await client.query("COMMIT");
    return { groupId, itemIds };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteModifierGroup(id: string) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM ordering_modifier_group_items WHERE modifier_group_id=$1`, [id]);
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
  const result = await db().query(`INSERT INTO ordering_item_modifiers(
      modifier_group_id,name_en,name_th,price_delta,sort_order,is_active,
      recipe_id,added_menu_item_id,requires_group_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [
    groupId,
    name,
    data?.thaiName ?? data?.name_th ?? null,
    Number(data?.priceDelta ?? data?.price ?? 0),
    Number(data?.sortOrder ?? 0),
    data?.isActive !== false,
    data?.recipeId || null,
    data?.addedMenuItemId || null,
    data?.requiresGroupId || null,
  ]);
  return mapOption(result.rows[0]);
}

export async function updateModifier(id: string, data: any) {
  const result = await db().query(`UPDATE ordering_item_modifiers SET
      name_en=COALESCE($2,name_en),name_th=COALESCE($3,name_th),
      price_delta=COALESCE($4,price_delta),sort_order=COALESCE($5,sort_order),
      is_active=COALESCE($6,is_active),recipe_id=$7,added_menu_item_id=$8,
      requires_group_id=$9,updated_at=NOW()
    WHERE id=$1 RETURNING *`, [
    id,
    String(data?.name ?? data?.name_en ?? "").trim() || null,
    data?.thaiName ?? data?.name_th ?? null,
    data?.priceDelta === undefined && data?.price === undefined ? null : Number(data?.priceDelta ?? data?.price),
    data?.sortOrder === undefined ? null : Number(data.sortOrder),
    typeof (data?.isActive ?? data?.active) === "boolean" ? Boolean(data?.isActive ?? data?.active) : null,
    data?.recipeId || null,
    data?.addedMenuItemId || null,
    data?.requiresGroupId || null,
  ]);
  if (!result.rows[0]) throw new Error("Modifier option not found");
  return mapOption(result.rows[0]);
}

export async function deleteModifier(id: string) {
  const result = await db().query(`DELETE FROM ordering_item_modifiers WHERE id=$1 RETURNING id`, [id]);
  if (!result.rows[0]) throw new Error("Modifier option not found");
  return result.rows[0];
}

export async function applyGroupToItem(groupId: string, itemId: string) {
  const current = await db().query(`SELECT menu_item_id FROM ordering_modifier_group_items WHERE modifier_group_id=$1`, [groupId]);
  const ids = Array.from(new Set([...current.rows.map((row) => String(row.menu_item_id)), String(itemId)]));
  return setGroupAssignments(groupId, ids);
}

type ItemChoiceOptionInput = {
  name?: unknown;
  thaiName?: unknown;
  name_th?: unknown;
  finalPrice?: unknown;
};

function normalizeItemChoiceOptions(options: unknown, basePrice: number) {
  if (!Array.isArray(options) || options.length < 2) {
    throw new Error("Add at least two choices");
  }

  const seen = new Set<string>();
  return options.map((raw: ItemChoiceOptionInput, index) => {
    const name = String(raw?.name ?? "").trim();
    const normalizedName = name.toLowerCase();
    const finalPrice = Number(raw?.finalPrice);

    if (!name) throw new Error(`Choice ${index + 1} needs a name`);
    if (seen.has(normalizedName)) throw new Error(`Choice names must be unique: ${name}`);
    if (!Number.isFinite(finalPrice) || finalPrice < basePrice) {
      throw new Error(`The final price for ${name} must be at least the product base price`);
    }

    seen.add(normalizedName);
    return {
      name,
      thaiName: String(raw?.thaiName ?? raw?.name_th ?? "").trim() || null,
      finalPrice,
      priceDelta: Number((finalPrice - basePrice).toFixed(2)),
      sortOrder: index,
    };
  });
}

/**
 * Create or update a required, single-select price choice directly from a menu item.
 * The public editor works with final selling prices; the canonical modifier table stores
 * only the delta from the item's direct/POS base price.
 */
export async function saveItemChoiceGroup(itemId: string, groupId: string | null, data: any) {
  const name = String(data?.name ?? "").trim();
  if (!name) throw new Error("Option group name is required");

  const client = await db().connect();
  try {
    await client.query("BEGIN");

    const itemResult = await client.query(
      `SELECT id, COALESCE(direct_price, price) AS base_price
       FROM ordering_menu_items
       WHERE id=$1
       FOR UPDATE`,
      [itemId],
    );
    const item = itemResult.rows[0];
    if (!item) throw new Error("Menu item not found");

    const basePrice = Number(item.base_price);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      throw new Error("Set the product Direct / POS base price before adding price choices");
    }
    const options = normalizeItemChoiceOptions(data?.options, basePrice);
    const promptText = String(data?.promptText ?? name).trim() || name;

    let savedGroupId = groupId;
    if (savedGroupId) {
      const ownership = await client.query(
        `SELECT g.id
         FROM ordering_modifier_groups g
         JOIN ordering_modifier_group_items own
           ON own.modifier_group_id=g.id AND own.menu_item_id=$2
         WHERE g.id=$1
           AND COALESCE(g.group_type,'modifier')='choice'
           AND (SELECT COUNT(*) FROM ordering_modifier_group_items all_links WHERE all_links.modifier_group_id=g.id)=1
         FOR UPDATE`,
        [savedGroupId, itemId],
      );
      if (!ownership.rows[0]) {
        throw new Error("Only an item-exclusive price choice can be edited here");
      }
      await client.query(
        `UPDATE ordering_modifier_groups SET
           name_en=$2, name_th=$3, group_type='choice', selection_mode='single',
           min_select=1, max_select=1, is_required=TRUE,
           min_selections=1, max_selections=1, prompt_text=$4,
           is_active=TRUE, updated_at=NOW()
         WHERE id=$1`,
        [savedGroupId, name, String(data?.name_th ?? "").trim() || null, promptText],
      );
      await client.query(`DELETE FROM ordering_item_modifiers WHERE modifier_group_id=$1`, [savedGroupId]);
    } else {
      const created = await client.query(
        `INSERT INTO ordering_modifier_groups(
           name_en,name_th,menu_item_id,min_select,max_select,is_required,sort_order,
           group_type,selection_mode,min_selections,max_selections,prompt_text,is_active)
         VALUES($1,$2,$3,1,1,TRUE,$4,'choice','single',1,1,$5,TRUE)
         RETURNING id`,
        [name, String(data?.name_th ?? "").trim() || null, itemId, Number(data?.sortOrder ?? 0), promptText],
      );
      savedGroupId = String(created.rows[0].id);
      await client.query(
        `INSERT INTO ordering_modifier_group_items(modifier_group_id,menu_item_id,sort_order)
         VALUES($1,$2,$3)`,
        [savedGroupId, itemId, Number(data?.sortOrder ?? 0)],
      );
    }

    for (const option of options) {
      await client.query(
        `INSERT INTO ordering_item_modifiers(
           modifier_group_id,name_en,name_th,price_delta,sort_order,is_active)
         VALUES($1,$2,$3,$4,$5,TRUE)`,
        [savedGroupId, option.name, option.thaiName, option.priceDelta, option.sortOrder],
      );
    }

    await client.query("COMMIT");
    return { id: savedGroupId, itemId, name, promptText, basePrice, options };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteItemChoiceGroup(itemId: string, groupId: string) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const ownership = await client.query(
      `SELECT g.id
       FROM ordering_modifier_groups g
       JOIN ordering_modifier_group_items own
         ON own.modifier_group_id=g.id AND own.menu_item_id=$2
       WHERE g.id=$1
         AND COALESCE(g.group_type,'modifier')='choice'
         AND (SELECT COUNT(*) FROM ordering_modifier_group_items all_links WHERE all_links.modifier_group_id=g.id)=1
       FOR UPDATE`,
      [groupId, itemId],
    );
    if (!ownership.rows[0]) throw new Error("Item-exclusive price choice not found");
    await client.query(`DELETE FROM ordering_modifier_groups WHERE id=$1`, [groupId]);
    await client.query("COMMIT");
    return { id: groupId, itemId, deleted: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function mergeModifierGroups(targetGroupId: string, sourceGroupIds: string[], mergeUniqueOptions = true) {
  const targetId = String(targetGroupId || "").trim();
  const sourceIds = Array.from(new Set((sourceGroupIds || []).map(String).filter((id) => id && id !== targetId)));
  if (!targetId) throw new Error("Canonical modifier group is required");
  if (!sourceIds.length) throw new Error("Select at least one duplicate modifier group");

  const client = await db().connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      'SELECT id,name_en,is_active FROM ordering_modifier_groups WHERE id = ANY($1::uuid[])',
      [[targetId, ...sourceIds]],
    );
    const existingIds = new Set(existing.rows.map((row) => String(row.id)));
    if (!existingIds.has(targetId)) throw new Error("Canonical modifier group was not found");
    const missing = sourceIds.filter((id) => !existingIds.has(id));
    if (missing.length) throw new Error('Duplicate modifier group not found: ' + missing.join(', '));

    const targetOptions = await client.query(
      'SELECT id,LOWER(TRIM(name_en)) AS normalized_name FROM ordering_item_modifiers WHERE modifier_group_id=$1',
      [targetId],
    );
    const optionNames = new Set(targetOptions.rows.map((row) => String(row.normalized_name || "")));

    let assignmentsMoved = 0;
    let optionsMoved = 0;
    let duplicateOptionsArchived = 0;

    for (const sourceId of sourceIds) {
      const assignmentResult = await client.query(
        'INSERT INTO ordering_modifier_group_items(modifier_group_id,menu_item_id,sort_order) SELECT $1,menu_item_id,sort_order FROM ordering_modifier_group_items WHERE modifier_group_id=$2 ON CONFLICT DO NOTHING',
        [targetId, sourceId],
      );
      assignmentsMoved += assignmentResult.rowCount || 0;

      if (mergeUniqueOptions) {
        const sourceOptions = await client.query(
          'SELECT id,name_en,LOWER(TRIM(name_en)) AS normalized_name FROM ordering_item_modifiers WHERE modifier_group_id=$1 ORDER BY sort_order,name_en',
          [sourceId],
        );
        for (const option of sourceOptions.rows) {
          const normalized = String(option.normalized_name || "");
          if (normalized && !optionNames.has(normalized)) {
            await client.query('UPDATE ordering_item_modifiers SET modifier_group_id=$2,updated_at=NOW() WHERE id=$1', [option.id, targetId]);
            optionNames.add(normalized);
            optionsMoved += 1;
          } else {
            await client.query('UPDATE ordering_item_modifiers SET is_active=false,updated_at=NOW() WHERE id=$1', [option.id]);
            duplicateOptionsArchived += 1;
          }
        }
      }

      await client.query('DELETE FROM ordering_modifier_group_items WHERE modifier_group_id=$1', [sourceId]);
      await client.query('UPDATE ordering_modifier_groups SET is_active=false,updated_at=NOW() WHERE id=$1', [sourceId]);
    }

    await client.query('UPDATE ordering_modifier_groups SET is_active=true,updated_at=NOW() WHERE id=$1', [targetId]);
    await client.query("COMMIT");

    return { ok: true, targetGroupId: targetId, archivedGroupIds: sourceIds, assignmentsMoved, optionsMoved, duplicateOptionsArchived };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

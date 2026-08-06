import { pool } from "../../db";
import { getModifierGroups, saveItemChoiceGroup } from "./modifierService";

const db = () => {
  if (!pool) throw new Error("Menu database is unavailable");
  return pool;
};

/**
 * Menu option groups existed before ordering_modifier_group_items became the canonical
 * assignment table. POS still supports both legacy ordering_modifier_groups.menu_item_id
 * and the newer assignment table. The menu editor must do the same or older item-level
 * choices (for example Chicken Nuggets sizes) disappear after a reload.
 */
export async function getModifierGroupsWithLegacyAssignments() {
  const [groups, legacyLinks] = await Promise.all([
    getModifierGroups(),
    db().query(`
      SELECT id, menu_item_id
      FROM ordering_modifier_groups
      WHERE menu_item_id IS NOT NULL
    `),
  ]);

  const legacyByGroup = new Map<string, string>();
  for (const row of legacyLinks.rows) {
    legacyByGroup.set(String(row.id), String(row.menu_item_id));
  }

  return groups.map((group: any) => {
    const legacyItemId = legacyByGroup.get(String(group.id));
    const linkedMenuItemIds = Array.from(new Set([
      ...(Array.isArray(group.linkedMenuItemIds) ? group.linkedMenuItemIds.map(String) : []),
      ...(legacyItemId ? [legacyItemId] : []),
    ]));

    return {
      ...group,
      menuItemId: legacyItemId || group.menuItemId || null,
      linkedMenuItemIds,
    };
  });
}

/**
 * Before editing an existing item-level choice, normalize a legacy menu_item_id link into
 * ordering_modifier_group_items. This makes the existing transactional save path safe for
 * old menu data without requiring a migration or changing POS behaviour.
 */
export async function saveItemChoiceGroupCompatible(
  itemId: string,
  groupId: string | null,
  data: any,
) {
  if (groupId) {
    await db().query(`
      INSERT INTO ordering_modifier_group_items(modifier_group_id, menu_item_id, sort_order)
      SELECT g.id, $2::uuid, COALESCE(g.sort_order, 0)
      FROM ordering_modifier_groups g
      WHERE g.id=$1::uuid
        AND g.menu_item_id=$2::uuid
      ON CONFLICT (modifier_group_id, menu_item_id) DO NOTHING
    `, [groupId, itemId]);
  }

  const saved = await saveItemChoiceGroup(itemId, groupId, data);

  const verification = await db().query(`
    SELECT
      g.id,
      g.name_en,
      COALESCE(g.group_type, 'modifier') AS group_type,
      COALESCE(g.selection_mode, 'multiple') AS selection_mode,
      COALESCE(g.min_selections, g.min_select, CASE WHEN g.is_required THEN 1 ELSE 0 END, 0) AS min_selections,
      COALESCE(g.max_selections, g.max_select) AS max_selections,
      COUNT(m.id)::int AS option_count
    FROM ordering_modifier_groups g
    LEFT JOIN ordering_item_modifiers m
      ON m.modifier_group_id=g.id AND m.is_active
    WHERE g.id=$1::uuid
      AND (
        g.menu_item_id=$2::uuid OR EXISTS (
          SELECT 1
          FROM ordering_modifier_group_items a
          WHERE a.modifier_group_id=g.id AND a.menu_item_id=$2::uuid
        )
      )
    GROUP BY g.id, g.name_en, g.group_type, g.selection_mode,
             g.min_selections, g.min_select, g.is_required,
             g.max_selections, g.max_select
  `, [String(saved.id), itemId]);

  const row = verification.rows[0];
  if (!row || Number(row.option_count || 0) < 2) {
    throw new Error("Item price options were not persisted correctly. Save was rolled back from the UI perspective; please retry.");
  }

  return {
    ...saved,
    verified: true,
    persistedOptionCount: Number(row.option_count),
    selectionMode: row.selection_mode,
    minSelections: Number(row.min_selections || 0),
    maxSelections: row.max_selections == null ? null : Number(row.max_selections),
  };
}

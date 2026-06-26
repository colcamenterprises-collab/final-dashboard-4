import { db } from "../../lib/prisma";

export async function getModifierGroups() {
  return await db().menu_modifiers_group_v3.findMany({
    include: { modifiers: true }
  });
}

export async function createModifierGroup(data: any) {
  return await db().menu_modifiers_group_v3.create({ data });
}

export async function updateModifierGroup(id: string, data: any) {
  return await db().menu_modifiers_group_v3.update({
    where: { id },
    data
  });
}

export async function deleteModifierGroup(id: string) {
  return await db().menu_modifiers_group_v3.delete({ where: { id } });
}

export async function createModifier(groupId: string, data: any) {
  return await db().menu_modifiers_v3.create({
    data: { ...data, groupId }
  });
}

export async function updateModifier(id: string, data: any) {
  return await db().menu_modifiers_v3.update({
    where: { id },
    data
  });
}

export async function deleteModifier(id: string) {
  return await db().menu_modifiers_v3.delete({ where: { id } });
}

export async function applyGroupToItem(groupId: string, itemId: string) {
  return await db().menu_items_v3.update({
    where: { id: itemId },
    data: {
      modifiers: { connect: { id: groupId } }
    }
  });
}

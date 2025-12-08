// PATCH 2 — FORT KNOX LOCKDOWN FOR SHOPPING LIST PIPELINE
// STRICT: Do NOT modify any unrelated logic. 
// Do NOT allow ANY shopping list logic outside this file.

import { db } from "../lib/prisma";

/**
 * Input sanitizer — prevents malformed, blank, or tampered items.
 */
function normalizeItem(item: any) {
  if (!item) return null;
  if (!item.item || typeof item.item !== "string") return null;

  return {
    item: item.item.trim(),
    quantity: Number(item.quantity || 1),
    notes: item.notes?.trim() || "",
  };
}

/**
 * Build the shopping list strictly from:
 * - Daily Stock V2 requisition fields (authoritative)
 * - Optional shopping items from Sales (only if non-empty)
 *
 * NO OTHER SOURCE IS PERMITTED.
 */
export async function buildShoppingList(salesId: string) {
  const prisma = db();

  // Enforce linkage
  if (!salesId) {
    console.error("Blocked attempt: Missing salesId.");
    return null;
  }

  // Caller validation — hard block unknown entry points
  const caller = (new Error().stack || "").toString();
  if (!caller.includes("dailyStockV2Routes") && !caller.includes("forms")) {
    console.error("BLOCKED: Unauthorized module attempted to build shopping list.");
    return null;
  }

  // Load Daily Stock V2 (mandatory)
  const stock = await prisma.dailyStockV2.findUnique({
    where: { salesId },
  });

  if (!stock) {
    console.error(
      "Blocked attempt: Shopping list cannot generate without Daily Stock V2."
    );
    return null;
  }

  // Mandatory source — requisition_items
  const requisition = Array.isArray(stock.requisition_items)
    ? stock.requisition_items
    : [];

  // Safe optional inclusion from sales
  const sales = await prisma.dailySalesV2.findUnique({
    where: { id: salesId },
  });

  const salesShopping =
    sales?.shopping_items?.filter((x: any) => x?.item?.trim()) || [];

  // Normalize & clean
  const combinedRaw = [...requisition, ...salesShopping];
  const combined = combinedRaw
    .map((i) => normalizeItem(i))
    .filter((i) => i !== null);

  // Tripwire: Empty lists are allowed but must be intentional
  if (!combined.length) {
    console.warn(
      "Shopping list generated but empty — check staff input (not an error)."
    );
  }

  // Upsert = overwrite only THIS shift — never others
  const result = await prisma.shoppingListV2.upsert({
    where: { salesId },
    update: { items: combined },
    create: { salesId, items: combined },
  });

  console.log("Shopping List locked & saved for shift:", salesId);
  return result;
}

import { pool } from "../../db";
import {
  ORDERING_ORDER_STATUSES,
  ORDERING_PAYMENT_METHODS,
  ORDERING_PHASE1_CHANNELS,
  type OrderingCreateOrderInput,
  type OrderingOrderStatus,
} from "../../../shared/schema/ordering";

const SOURCE = "sbb_ordering_os_phase1";


const ORDERING_GO_LIVE_MENU = [
  { category: "Burgers", name: "Single Burger", description: "Classic Smash Brothers single burger.", price: "150.00", sort: 10 },
  { category: "Burgers", name: "Double Burger", description: "Two smashed beef patties with cheese.", price: "220.00", sort: 20 },
  { category: "Burgers", name: "Triple Burger", description: "Three smashed beef patties with cheese.", price: "290.00", sort: 30 },
  { category: "Burgers", name: "Super Double Bacon", description: "Double burger with bacon.", price: "270.00", sort: 40 },
  { category: "Sides", name: "Fries", description: "Crispy fries.", price: "80.00", sort: 10 },
  { category: "Sides", name: "Onion Rings", description: "Crispy onion rings.", price: "90.00", sort: 20 },
  { category: "Sides", name: "Nuggets", description: "Chicken nuggets.", price: "95.00", sort: 30 },
  { category: "Drinks", name: "Coke", description: "Coca-Cola.", price: "40.00", sort: 10 },
  { category: "Drinks", name: "Coke Zero", description: "Coca-Cola Zero Sugar.", price: "40.00", sort: 20 },
  { category: "Drinks", name: "Sprite", description: "Sprite.", price: "40.00", sort: 30 },
  { category: "Drinks", name: "Water", description: "Bottled water.", price: "25.00", sort: 40 },
] as const;

const STATUS_TO_DB: Record<string, string> = {
  SUBMITTED: "submitted",
  ACCEPTED: "accepted",
  PREPARING: "in_kitchen",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const STATUS_FROM_DB: Record<string, string> = {
  submitted: "SUBMITTED",
  accepted: "ACCEPTED",
  in_kitchen: "PREPARING",
  ready: "READY",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};


function requireDb() {
  if (!pool) {
    const error: any = new Error("DATABASE_URL is not configured");
    error.code = "ORDERING_DATABASE_UNAVAILABLE";
    throw error;
  }
  return pool;
}

export function orderingBlocker(code: string, message: string, where: string, canonical_source = SOURCE) {
  return { code, message, where, canonical_source, auto_build_attempted: false as const };
}

function assertText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function asNumber(value: any) {
  return Number.parseFloat(String(value ?? "0"));
}

function normalizeInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function hasOwn(input: any, key: string) {
  return Object.prototype.hasOwnProperty.call(input ?? {}, key);
}

async function ensureGoLiveMenuIfEmpty() {
  const db = requireDb();
  const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM ordering_menu_items`);
  if (Number(countResult.rows[0]?.count ?? 0) > 0) return;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const categoryIds = new Map<string, string>();
    for (const [index, category] of ["Burgers", "Sides", "Drinks"].entries()) {
      const result = await client.query(
        `INSERT INTO ordering_menu_categories (name_en, description_en, sort_order, is_active)
         VALUES ($1, $2, $3, TRUE) RETURNING id`,
        [category, `Go-live ${category.toLowerCase()} category`, (index + 1) * 10],
      );
      categoryIds.set(category, result.rows[0].id);
    }
    for (const item of ORDERING_GO_LIVE_MENU) {
      await client.query(
        `INSERT INTO ordering_menu_items (category_id, name_en, description_en, price, is_active, is_sold_out, sort_order)
         VALUES ($1, $2, $3, $4, TRUE, FALSE, $5)`,
        [categoryIds.get(item.category), item.name, item.description, item.price, item.sort],
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

function decorateOrder(order: any) {
  if (!order) return order;
  return { ...order, status_code: STATUS_FROM_DB[order.status] ?? order.status.toUpperCase(), last_update_time: order.updated_at };
}

export async function getMenu(includeInactive = false) {
  const db = requireDb();
  await ensureGoLiveMenuIfEmpty();
  const [categoryResult, itemResult, groupResult, modifierResult] = await Promise.all([
    db.query(`SELECT * FROM ordering_menu_categories ${includeInactive ? "" : "WHERE is_active = TRUE"} ORDER BY sort_order ASC, name_en ASC`),
    db.query(`SELECT * FROM ordering_menu_items ${includeInactive ? "" : "WHERE is_active = TRUE"} ORDER BY sort_order ASC, name_en ASC`),
    db.query(`SELECT * FROM ordering_modifier_groups ORDER BY sort_order ASC, name_en ASC`),
    db.query(`SELECT * FROM ordering_item_modifiers ${includeInactive ? "" : "WHERE is_active = TRUE"} ORDER BY sort_order ASC, name_en ASC`),
  ]);

  const modifiersByGroup = new Map<string, any[]>();
  for (const modifier of modifierResult.rows) {
    const list = modifiersByGroup.get(modifier.modifier_group_id) ?? [];
    list.push(modifier);
    modifiersByGroup.set(modifier.modifier_group_id, list);
  }

  const groupsByItem = new Map<string, any[]>();
  for (const group of groupResult.rows) {
    const list = groupsByItem.get(group.menu_item_id) ?? [];
    list.push({ ...group, modifiers: modifiersByGroup.get(group.id) ?? [] });
    groupsByItem.set(group.menu_item_id, list);
  }

  const itemsByCategory = new Map<string, any[]>();
  for (const item of itemResult.rows) {
    if (!includeInactive && item.is_sold_out) {
      // Sold-out items remain visible so customers can see they are unavailable.
    }
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push({ ...item, modifier_groups: groupsByItem.get(item.id) ?? [] });
    itemsByCategory.set(item.category_id, list);
  }

  return {
    ok: true,
    source: SOURCE,
    categories: categoryResult.rows.map((category) => ({
      ...category,
      items: itemsByCategory.get(category.id) ?? [],
    })),
    warnings: [],
    blockers: [],
    last_updated: new Date().toISOString(),
  };
}

export async function createCategory(input: any) {
  const db = requireDb();
  const result = await db.query(
    `INSERT INTO ordering_menu_categories (name_en, name_th, description_en, description_th, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [assertText(input.name_en, "name_en"), input.name_th || null, input.description_en || null, input.description_th || null, normalizeInt(input.sort_order), input.is_active !== false],
  );
  return result.rows[0];
}

export async function updateCategory(id: string, input: any) {
  const db = requireDb();
  const result = await db.query(
    `UPDATE ordering_menu_categories SET
      name_en = COALESCE($2, name_en), name_th = $3, description_en = $4, description_th = $5,
      sort_order = COALESCE($6, sort_order), is_active = COALESCE($7, is_active), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, input.name_en ?? null, input.name_th ?? null, input.description_en ?? null, input.description_th ?? null, input.sort_order ?? null, input.is_active ?? null],
  );
  return result.rows[0] ?? null;
}

export async function createMenuItem(input: any) {
  const db = requireDb();
  const result = await db.query(
    `INSERT INTO ordering_menu_items (category_id, name_en, name_th, description_en, description_th, price, is_active, is_sold_out, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [assertText(input.category_id, "category_id"), assertText(input.name_en, "name_en"), input.name_th || null, input.description_en || null, input.description_th || null, asNumber(input.price).toFixed(2), input.is_active !== false, input.is_sold_out === true, normalizeInt(input.sort_order)],
  );
  return result.rows[0];
}

export async function updateMenuItem(id: string, input: any) {
  const db = requireDb();
  const price = hasOwn(input, "price") ? asNumber(input.price).toFixed(2) : null;
  const result = await db.query(
    `UPDATE ordering_menu_items SET
      category_id = CASE WHEN $2 THEN $3 ELSE category_id END,
      name_en = CASE WHEN $4 THEN $5 ELSE name_en END,
      name_th = CASE WHEN $6 THEN $7 ELSE name_th END,
      description_en = CASE WHEN $8 THEN $9 ELSE description_en END,
      description_th = CASE WHEN $10 THEN $11 ELSE description_th END,
      price = CASE WHEN $12 THEN $13 ELSE price END,
      is_active = CASE WHEN $14 THEN $15 ELSE is_active END,
      is_sold_out = CASE WHEN $16 THEN $17 ELSE is_sold_out END,
      sort_order = CASE WHEN $18 THEN $19 ELSE sort_order END,
      updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      id,
      hasOwn(input, "category_id"), input.category_id ?? null,
      hasOwn(input, "name_en"), input.name_en ?? null,
      hasOwn(input, "name_th"), input.name_th ?? null,
      hasOwn(input, "description_en"), input.description_en ?? null,
      hasOwn(input, "description_th"), input.description_th ?? null,
      hasOwn(input, "price"), price,
      hasOwn(input, "is_active"), input.is_active ?? null,
      hasOwn(input, "is_sold_out"), input.is_sold_out ?? null,
      hasOwn(input, "sort_order"), input.sort_order ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

export async function createModifierGroup(input: any) {
  const db = requireDb();
  const result = await db.query(
    `INSERT INTO ordering_modifier_groups (menu_item_id, name_en, name_th, min_select, max_select, is_required, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [assertText(input.menu_item_id, "menu_item_id"), assertText(input.name_en, "name_en"), input.name_th || null, normalizeInt(input.min_select), normalizeInt(input.max_select, 1), input.is_required === true, normalizeInt(input.sort_order)],
  );
  return result.rows[0];
}

export async function updateModifierGroup(id: string, input: any) {
  const db = requireDb();
  const result = await db.query(
    `UPDATE ordering_modifier_groups SET
      name_en = COALESCE($2, name_en), name_th = $3, min_select = COALESCE($4, min_select),
      max_select = COALESCE($5, max_select), is_required = COALESCE($6, is_required), sort_order = COALESCE($7, sort_order), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, input.name_en ?? null, input.name_th ?? null, input.min_select ?? null, input.max_select ?? null, input.is_required ?? null, input.sort_order ?? null],
  );
  return result.rows[0] ?? null;
}

export async function createItemModifier(input: any) {
  const db = requireDb();
  const result = await db.query(
    `INSERT INTO ordering_item_modifiers (modifier_group_id, name_en, name_th, price_delta, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [assertText(input.modifier_group_id, "modifier_group_id"), assertText(input.name_en, "name_en"), input.name_th || null, asNumber(input.price_delta).toFixed(2), input.is_active !== false, normalizeInt(input.sort_order)],
  );
  return result.rows[0];
}

export async function updateItemModifier(id: string, input: any) {
  const db = requireDb();
  const result = await db.query(
    `UPDATE ordering_item_modifiers SET
      name_en = COALESCE($2, name_en), name_th = $3, price_delta = COALESCE($4, price_delta),
      is_active = COALESCE($5, is_active), sort_order = COALESCE($6, sort_order), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, input.name_en ?? null, input.name_th ?? null, input.price_delta ?? null, input.is_active ?? null, input.sort_order ?? null],
  );
  return result.rows[0] ?? null;
}


export async function seedPhase1TestMenu(_actor = "admin") {
  await ensureGoLiveMenuIfEmpty();
  const menu = await getMenu(true);
  return {
    category: menu.categories[0] ?? null,
    items: menu.categories.flatMap((category: any) => category.items ?? []),
    warning: "Go-live menu exists with enabled, visible items priced above zero.",
  };
}

export async function createVenueTable(input: any) {
  const db = requireDb();
  const result = await db.query(
    `INSERT INTO ordering_venue_tables (table_code, table_label, is_active)
     VALUES ($1,$2,$3)
     ON CONFLICT (table_code) DO UPDATE SET table_label = EXCLUDED.table_label, is_active = EXCLUDED.is_active, updated_at = NOW()
     RETURNING *`,
    [assertText(input.table_code, "table_code"), assertText(input.table_label, "table_label"), input.is_active !== false],
  );
  return result.rows[0];
}

export async function listVenueTables() {
  const db = requireDb();
  const result = await db.query(`SELECT * FROM ordering_venue_tables ORDER BY table_label ASC`);
  return result.rows;
}

export async function createOrder(input: OrderingCreateOrderInput) {
  const db = requireDb();
  if (!ORDERING_PHASE1_CHANNELS.includes(input.channel)) throw new Error("Unsupported Phase 1 ordering channel");
  if (!ORDERING_PAYMENT_METHODS.includes(input.payment_method)) throw new Error("Unsupported payment method");
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("At least one order item is required");

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    let tableId: string | null = null;
    if (input.table_code) {
      const tableResult = await client.query(`SELECT id FROM ordering_venue_tables WHERE table_code = $1 AND is_active = TRUE`, [input.table_code]);
      if (tableResult.rows[0]) tableId = tableResult.rows[0].id;
    }

    const orderResult = await client.query(
      `INSERT INTO ordering_orders (channel, table_id, table_code, customer_name, customer_phone, order_notes, status, payment_status, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,'submitted',$7,$8) RETURNING *`,
      [input.channel, tableId, input.table_code || null, input.customer_name || null, input.customer_phone || null, input.order_notes || null, input.payment_method === "manual_qr_transfer" ? "pending_manual_confirmation" : "unpaid", input.payment_method],
    );
    const order = orderResult.rows[0];
    let total = 0;

    for (let index = 0; index < input.items.length; index += 1) {
      const cartItem = input.items[index];
      const quantity = normalizeInt(cartItem.quantity, 1);
      if (quantity <= 0) throw new Error("Item quantity must be greater than zero");
      const itemResult = await client.query(`SELECT * FROM ordering_menu_items WHERE id = $1 AND is_active = TRUE`, [cartItem.menu_item_id]);
      const menuItem = itemResult.rows[0];
      if (!menuItem) throw new Error(`Menu item not available: ${cartItem.menu_item_id}`);
      if (menuItem.is_sold_out) throw new Error(`Menu item is sold out: ${menuItem.name_en}`);
      const unitPrice = asNumber(menuItem.price);
      let modifierTotal = 0;
      const modifierRows: any[] = [];
      for (const selected of cartItem.modifiers ?? []) {
        const modifierResult = await client.query(
          `SELECT m.*, g.name_en AS group_name_en, g.min_select, g.max_select
           FROM ordering_item_modifiers m
           JOIN ordering_modifier_groups g ON g.id = m.modifier_group_id
           WHERE m.id = $1 AND g.menu_item_id = $2 AND m.is_active = TRUE`,
          [selected.item_modifier_id, cartItem.menu_item_id],
        );
        const modifier = modifierResult.rows[0];
        if (!modifier) throw new Error(`Modifier not available: ${selected.item_modifier_id}`);
        const modQty = normalizeInt(selected.quantity, 1);
        modifierTotal += asNumber(modifier.price_delta) * modQty;
        modifierRows.push({ ...modifier, quantity: modQty });
      }
      const lineTotal = (unitPrice + modifierTotal) * quantity;
      total += lineTotal;
      const lineResult = await client.query(
        `INSERT INTO ordering_order_items (order_id, menu_item_id, item_name_en, item_name_th, unit_price, quantity, line_total, notes, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [order.id, menuItem.id, menuItem.name_en, menuItem.name_th, unitPrice.toFixed(2), quantity, lineTotal.toFixed(2), cartItem.notes || null, index],
      );
      const orderItem = lineResult.rows[0];
      for (const modifier of modifierRows) {
        await client.query(
          `INSERT INTO ordering_order_item_modifiers (order_item_id, item_modifier_id, modifier_group_name_en, modifier_name_en, modifier_name_th, price_delta, quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [orderItem.id, modifier.id, modifier.group_name_en, modifier.name_en, modifier.name_th, asNumber(modifier.price_delta).toFixed(2), modifier.quantity],
        );
      }
    }

    await client.query(`UPDATE ordering_orders SET subtotal = $2, total = $2, updated_at = NOW() WHERE id = $1`, [order.id, total.toFixed(2)]);
    await client.query(
      `INSERT INTO ordering_payments (order_id, method, status, amount) VALUES ($1,$2,$3,$4)`,
      [order.id, input.payment_method, input.payment_method === "manual_qr_transfer" ? "pending" : "pending", total.toFixed(2)],
    );
    await client.query(`INSERT INTO ordering_status_events (order_id, from_status, to_status, actor) VALUES ($1,NULL,'submitted','customer')`, [order.id]);
    await client.query("COMMIT");
    return getOrder(order.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrder(id: string) {
  const db = requireDb();
  const orderResult = await db.query(`SELECT * FROM ordering_orders WHERE id = $1`, [id]);
  const order = orderResult.rows[0];
  if (!order) return null;
  const [itemsResult, eventsResult, paymentsResult] = await Promise.all([
    db.query(`SELECT * FROM ordering_order_items WHERE order_id = $1 ORDER BY sort_order ASC`, [id]),
    db.query(`SELECT * FROM ordering_status_events WHERE order_id = $1 ORDER BY created_at ASC`, [id]),
    db.query(`SELECT * FROM ordering_payments WHERE order_id = $1 ORDER BY created_at ASC`, [id]),
  ]);
  const modifiersResult = await db.query(
    `SELECT m.* FROM ordering_order_item_modifiers m JOIN ordering_order_items i ON i.id = m.order_item_id WHERE i.order_id = $1 ORDER BY m.created_at ASC`,
    [id],
  );
  const modifiersByItem = new Map<string, any[]>();
  for (const modifier of modifiersResult.rows) {
    const list = modifiersByItem.get(modifier.order_item_id) ?? [];
    list.push(modifier);
    modifiersByItem.set(modifier.order_item_id, list);
  }
  return decorateOrder({ ...order, items: itemsResult.rows.map((item) => ({ ...item, modifiers: modifiersByItem.get(item.id) ?? [] })), events: eventsResult.rows, payments: paymentsResult.rows });
}

export async function listOrders(options: { kitchen?: boolean; status?: string; limit?: number } = {}) {
  const db = requireDb();
  const values: any[] = [];
  const clauses: string[] = [];
  if (options.kitchen) clauses.push(`status IN ('submitted','accepted','in_kitchen','ready')`);
  if (options.status) {
    values.push(STATUS_TO_DB[options.status.toUpperCase()] ?? options.status.toLowerCase());
    clauses.push(`status = $${values.length}`);
  }
  values.push(options.limit ?? 100);
  const result = await db.query(
    `SELECT * FROM ordering_orders ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT $${values.length}`,
    values,
  );
  const orders = [];
  for (const row of result.rows) orders.push(await getOrder(row.id));
  return orders.filter(Boolean);
}

export async function updateOrderStatus(id: string, status: OrderingOrderStatus, actor = "staff", notes?: string | null) {
  const db = requireDb();
  const dbStatus = STATUS_TO_DB[String(status).toUpperCase()] ?? String(status).toLowerCase();
  if (!ORDERING_ORDER_STATUSES.includes(dbStatus as OrderingOrderStatus) || !(STATUS_FROM_DB[dbStatus])) throw new Error("Unsupported order status");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(`SELECT status FROM ordering_orders WHERE id = $1 FOR UPDATE`, [id]);
    const current = currentResult.rows[0];
    if (!current) throw new Error("Order not found");
    const result = await client.query(`UPDATE ordering_orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, dbStatus]);
    await client.query(`INSERT INTO ordering_status_events (order_id, from_status, to_status, actor, notes) VALUES ($1,$2,$3,$4,$5)`, [id, current.status, dbStatus, actor, notes || null]);
    await client.query("COMMIT");
    return decorateOrder(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmManualPayment(orderId: string, input: any) {
  const db = requireDb();
  const result = await db.query(
    `UPDATE ordering_payments SET status = 'confirmed', confirmed_by = $2, confirmed_at = NOW(), notes = $3, updated_at = NOW()
     WHERE order_id = $1 RETURNING *`,
    [orderId, input.confirmed_by || "manager", input.notes || null],
  );
  await db.query(`UPDATE ordering_orders SET payment_status = 'paid', updated_at = NOW() WHERE id = $1`, [orderId]);
  return result.rows;
}

export async function getSettings() {
  const db = requireDb();
  const result = await db.query(`SELECT key, value, updated_at FROM ordering_settings ORDER BY key ASC`);
  return result.rows;
}

export async function updateSettings(settings: Record<string, unknown>) {
  const db = requireDb();
  const keys = Object.keys(settings || {});
  for (const key of keys) {
    await db.query(
      `INSERT INTO ordering_settings (key, value, updated_at) VALUES ($1,$2,NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(settings[key])],
    );
  }
  return getSettings();
}

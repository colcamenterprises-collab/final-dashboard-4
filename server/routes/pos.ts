import { Router, type NextFunction, type Request, type Response } from "express";
import { DateTime } from "luxon";
import { pool } from "../db";
import { attachSessionUser } from "../middleware/sessionAuth";
import { getPinSessionUser } from "./pinAuth";

const router = Router();
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ ok: false, source: "sbb_pos_core", error: message });
const db = () => {
  if (!pool) throw new Error("POS database is unavailable");
  return pool;
};
const value = (input: unknown) => {
  const n = Number(input);
  return Number.isFinite(n) ? n : 0;
};
const clean = (input: unknown) => String(input ?? "").trim();
const normaliseMobile = (input: unknown) => clean(input).replace(/\D/g, "");

function shiftDateFor(date = DateTime.now().setZone("Asia/Bangkok")) {
  return (date.hour < 3 ? date.minus({ days: 1 }) : date).toFormat("yyyyLLdd");
}

function receiptNumber(orderNumber: number, createdAt?: string | Date) {
  const date = createdAt
    ? DateTime.fromJSDate(new Date(createdAt)).setZone("Asia/Bangkok")
    : DateTime.now().setZone("Asia/Bangkok");
  return `SBB-${shiftDateFor(date)}-${String(orderNumber).padStart(4, "0")}`;
}

function staffDevice(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") return next();
  if (attachSessionUser(req)) return next();
  const pinUser = getPinSessionUser(req);
  if (
    pinUser &&
    (["owner", "manager", "cashier", "kitchen_staff"].includes(pinUser.role) ||
      pinUser.permissions?.["pos.view"] === true)
  ) {
    (req as any).user = pinUser;
    return next();
  }
  if (
    !process.env.POS_DEVICE_TOKEN ||
    req.header("x-pos-device-token") !== process.env.POS_DEVICE_TOKEN
  ) return fail(res, "Registered POS device required", 401);
  next();
}

router.get("/menu", async (req, res) => {
  try {
    const mode = req.query.price_mode === "grab" ? "grab" : "direct";
    const price = mode === "grab" ? "grab_price" : "direct_price";
    const rows = await db().query(
      `SELECT i.*, c.name_en category_name,
        COALESCE(i.${price}, i.direct_price, i.price) active_price
       FROM ordering_menu_items i
       JOIN ordering_menu_categories c ON c.id = i.category_id
       WHERE c.is_active
         AND lower(c.name_en) <> lower('Phase 1 Test Menu')
         AND i.is_active AND i.pos_enabled AND NOT i.is_sold_out
       ORDER BY c.sort_order, i.sort_order`,
    );
    res.json({ ok: true, source: "sbb_pos_core", price_mode: mode, data: rows.rows });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

router.get("/orders/next-ticket", staffDevice, async (_req, res) => {
  try {
    const result = await db().query(
      `SELECT COALESCE(MAX(order_number), 0) + 1 AS next_order_number FROM ordering_orders`,
    );
    const next = Number(result.rows[0]?.next_order_number || 1);
    res.json({ ok: true, source: "sbb_pos_core", data: { ticket_number: receiptNumber(next) } });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

router.get("/menu/:menuItemId/modifiers", staffDevice, async (req, res) => {
  try {
    const result = await db().query(
      `SELECT m.*, g.name_en AS modifier_group_name_en,
              g.name_th AS modifier_group_name_name_th
       FROM ordering_item_modifiers m
       JOIN ordering_modifier_groups g ON g.id = m.modifier_group_id
       WHERE g.menu_item_id = $1 AND m.is_active
       ORDER BY g.sort_order, m.sort_order`,
      [req.params.menuItemId],
    );
    res.json({ ok: true, source: "sbb_pos_core", data: result.rows });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

router.get("/customers/lookup", staffDevice, async (req, res) => {
  const mobile = normaliseMobile(req.query.mobile);
  if (mobile.length < 7) return fail(res, "Enter a valid mobile number");
  try {
    const result = await db().query(
      `SELECT id, first_name, last_name, mobile, email, marketing_opt_in, member_since
       FROM pos_customers
       WHERE regexp_replace(mobile, '\\D', '', 'g') = $1
       LIMIT 1`,
      [mobile],
    );
    res.json({ ok: true, source: "sbb_pos_core", data: result.rows[0] || null });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

router.post("/orders", staffDevice, async (req, res) => {
  const input = req.body || {};
  const mode = input.order_mode === "grab" ? "grab" : input.order_mode === "direct" ? "direct" : null;
  if (!mode || !Array.isArray(input.items) || !input.items.length)
    return fail(res, "order_mode and items are required");
  if (mode === "grab" && input.payment_method !== "grab")
    return fail(res, "Grab orders must use Grab payment");

  const grabOrderNumber = clean(input.grab_order_number).toUpperCase();
  const grabCustomerName = clean(input.grab_customer_name);
  const grabCustomerMobile = clean(input.grab_customer_mobile);
  if (mode === "grab") {
    if (!/^GF-[A-Z0-9]{3,12}$/.test(grabOrderNumber))
      return fail(res, "Grab Order Number must use the format GF-xxxxx");
    if (!grabCustomerName) return fail(res, "Grab customer name is required");
    if (normaliseMobile(grabCustomerMobile).length < 7)
      return fail(res, "Grab customer mobile is required");
  }

  const customerInput = input.customer && typeof input.customer === "object" ? input.customer : null;
  if (customerInput) {
    if (!clean(customerInput.first_name)) return fail(res, "Member first name is required");
    if (normaliseMobile(customerInput.mobile).length < 7)
      return fail(res, "Member mobile number is required");
  }

  const client = await db().connect();
  try {
    await client.query("BEGIN");

    let customerId: string | null = null;
    let customer: any = null;
    if (customerInput) {
      const mobile = clean(customerInput.mobile);
      const mobileKey = normaliseMobile(mobile);
      customer = (
        await client.query(
          `INSERT INTO pos_customers(first_name, last_name, mobile, email, marketing_opt_in)
           VALUES($1,$2,$3,$4,$5)
           ON CONFLICT ((regexp_replace(mobile, '\\D', '', 'g')))
           DO UPDATE SET
             first_name = EXCLUDED.first_name,
             last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), pos_customers.last_name),
             email = COALESCE(NULLIF(EXCLUDED.email, ''), pos_customers.email),
             marketing_opt_in = EXCLUDED.marketing_opt_in,
             updated_at = NOW()
           RETURNING *`,
          [
            clean(customerInput.first_name),
            clean(customerInput.last_name) || null,
            mobile,
            clean(customerInput.email) || null,
            customerInput.marketing_opt_in === true,
          ],
        )
      ).rows[0];
      if (!customer || normaliseMobile(customer.mobile) !== mobileKey)
        throw new Error("Could not save customer record");
      customerId = customer.id;
    }

    const order = (
      await client.query(
        `INSERT INTO ordering_orders(
           channel, order_mode, dining_type, order_notes,
           status, payment_status, payment_method,
           customer_id, grab_order_number, grab_customer_name, grab_customer_mobile
         ) VALUES($1,$2,$3,$4,'submitted','paid',$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          mode === "grab" ? "grab" : "pos_direct",
          mode,
          input.dining_type || null,
          input.order_notes || null,
          input.payment_method,
          customerId,
          mode === "grab" ? grabOrderNumber : null,
          mode === "grab" ? grabCustomerName : null,
          mode === "grab" ? grabCustomerMobile : null,
        ],
      )
    ).rows[0];

    const ticket = receiptNumber(Number(order.order_number), order.created_at);
    await client.query(`UPDATE ordering_orders SET ticket_number = $2 WHERE id = $1`, [order.id, ticket]);

    let total = 0;
    let sort = 0;
    for (const line of input.items) {
      const item = (
        await client.query(
          `SELECT * FROM ordering_menu_items
           WHERE id = $1 AND is_active AND pos_enabled AND NOT is_sold_out`,
          [line.menu_item_id],
        )
      ).rows[0];
      if (!item) throw new Error("POS item unavailable");

      const qty = Math.max(1, Math.trunc(value(line.quantity) || 1));
      const unit = value(mode === "grab" ? item.grab_price : item.direct_price ?? item.price);
      if (!unit) throw new Error(`${item.name_en} has no ${mode} price`);
      if (mode === "direct" && item.set_upgrade_eligible && line.set_upgrade === undefined)
        throw new Error(`Set decision required for ${item.name_en}`);
      if (mode === "grab" && line.set_upgrade)
        throw new Error("Grab orders cannot use staff upsells");

      const parent = (
        await client.query(
          `INSERT INTO ordering_order_items(
             order_id, menu_item_id, item_name_en, item_name_th,
             unit_price, quantity, line_total, notes, sort_order,
             source_sku, price_mode
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING *`,
          [order.id, item.id, item.name_en, item.name_th, unit, qty, unit * qty,
            line.notes || null, sort++, item.source_sku || null, mode],
        )
      ).rows[0];
      total += unit * qty;

      const modifierIds = Array.isArray(line.modifier_ids)
        ? [...new Set(line.modifier_ids.filter((id: any) => typeof id === "string"))]
        : [];
      if (mode === "grab" && modifierIds.length)
        throw new Error("Grab orders cannot use staff modifiers");
      if (modifierIds.length) {
        const result = await client.query(
          `SELECT m.*, g.name_en AS modifier_group_name_en
           FROM ordering_item_modifiers m
           JOIN ordering_modifier_groups g ON g.id = m.modifier_group_id
           WHERE m.id = ANY($1::uuid[]) AND g.menu_item_id = $2 AND m.is_active`,
          [modifierIds, item.id],
        );
        if (result.rows.length !== modifierIds.length)
          throw new Error("Invalid modifier for this item");
        for (const modifier of result.rows) {
          const delta = value(modifier.price_delta) * qty;
          await client.query(
            `INSERT INTO ordering_order_item_modifiers(
               order_item_id, item_modifier_id, modifier_group_name_en,
               modifier_name_en, modifier_name_th, price_delta, quantity
             ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [parent.id, modifier.id, modifier.modifier_group_name_en, modifier.name_en,
              modifier.name_th, value(modifier.price_delta), qty],
          );
          await client.query(
            `UPDATE ordering_order_items SET line_total = line_total + $2 WHERE id = $1`,
            [parent.id, delta],
          );
          total += delta;
        }
      }

      if (mode === "direct" && line.set_upgrade) {
        if (!line.set_drink_menu_item_id) throw new Error("Set drink selection is required");
        const [friesResult, drinkResult, setting] = await Promise.all([
          client.query(`SELECT * FROM ordering_menu_items
                        WHERE lower(name_en) = lower('French Fries')
                          AND is_active AND pos_enabled LIMIT 1`),
          client.query(`SELECT * FROM ordering_menu_items
                        WHERE id = $1 AND is_active AND pos_enabled`, [line.set_drink_menu_item_id]),
          client.query(`SELECT value FROM ordering_settings WHERE key = 'pos_set_upgrade_amount'`),
        ]);
        const fries = friesResult.rows[0];
        const drink = drinkResult.rows[0];
        const upgrade = value(setting.rows[0]?.value || 80);
        if (!fries || !drink) throw new Error("Set fries or drink is not configured");
        await client.query(
          `UPDATE ordering_order_items SET line_total = line_total + $2 WHERE id = $1`,
          [parent.id, upgrade * qty],
        );
        await client.query(
          `INSERT INTO ordering_order_item_modifiers(
             order_item_id, modifier_group_name_en, modifier_name_en, price_delta, quantity
           ) VALUES($1,'SET UPGRADE','Burger + French Fries + Drink',$2,$3)`,
          [parent.id, upgrade, qty],
        );
        for (const component of [fries, drink]) {
          await client.query(
            `INSERT INTO ordering_order_items(
               order_id, menu_item_id, item_name_en, item_name_th,
               unit_price, quantity, line_total, sort_order,
               source_sku, price_mode, is_set_component, parent_order_item_id
             ) VALUES($1,$2,$3,$4,0,$5,0,$6,$7,$8,true,$9)`,
            [order.id, component.id, component.name_en, component.name_th, qty,
              sort++, component.source_sku || null, mode, parent.id],
          );
        }
        total += upgrade * qty;
      }
    }

    await client.query(`UPDATE ordering_orders SET subtotal = $2, total = $2 WHERE id = $1`, [order.id, total]);
    await client.query(
      `INSERT INTO ordering_payments(order_id, method, status, amount)
       VALUES($1,$2,'confirmed',$3)`,
      [order.id, input.payment_method, total],
    );
    await client.query(
      `INSERT INTO pos_order_events(order_id, event_type, payload)
       VALUES($1,'order_created',$2)`,
      [order.id, JSON.stringify({
        ticket_number: ticket,
        receipt_number: ticket,
        customer_id: customerId,
        grab_order_number: mode === "grab" ? grabOrderNumber : null,
      })],
    );
    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      source: "sbb_pos_core",
      data: {
        id: order.id,
        ticket_number: ticket,
        receipt_number: ticket,
        total,
        created_at: order.created_at,
        customer,
        grab_order_number: mode === "grab" ? grabOrderNumber : null,
        grab_customer_name: mode === "grab" ? grabCustomerName : null,
        grab_customer_mobile: mode === "grab" ? grabCustomerMobile : null,
      },
    });
  } catch (e: any) {
    await client.query("ROLLBACK");
    fail(res, e.message);
  } finally {
    client.release();
  }
});

router.get("/orders/:id/receipt", staffDevice, async (req, res) => {
  try {
    const result = await db().query(
      `SELECT o.*,
        CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', c.id, 'first_name', c.first_name, 'last_name', c.last_name,
          'mobile', c.mobile, 'email', c.email,
          'marketing_opt_in', c.marketing_opt_in, 'member_since', c.member_since
        ) END AS customer,
        COALESCE(
          jsonb_agg(
            to_jsonb(i) || jsonb_build_object(
              'modifiers', COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'name_en', m.modifier_name_en,
                    'name_th', m.modifier_name_th,
                    'price_delta', m.price_delta,
                    'quantity', m.quantity
                  ) ORDER BY m.created_at)
                 FROM ordering_order_item_modifiers m
                 WHERE m.order_item_id = i.id),
                '[]'::jsonb
              )
            ) ORDER BY i.sort_order
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::jsonb
        ) AS items
       FROM ordering_orders o
       LEFT JOIN pos_customers c ON c.id = o.customer_id
       LEFT JOIN ordering_order_items i ON i.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id, c.id`,
      [req.params.id],
    );
    const row = result.rows[0];
    if (!row) return fail(res, "Receipt not found", 404);
    res.json({ ok: true, source: "sbb_pos_core", data: row });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

router.post("/orders/:id/print-event", staffDevice, async (req, res) => {
  const allowed = ["print_requested", "print_completed", "print_failed", "reprint_requested"];
  if (!allowed.includes(req.body.event_type)) return fail(res, "Unsupported print event");
  try {
    await db().query(
      `INSERT INTO pos_order_events(order_id, event_type, payload) VALUES($1,$2,$3)`,
      [req.params.id, req.body.event_type, JSON.stringify({
        printer_profile: "58mm_escpos",
        print_kind: req.body.print_kind || "customer_and_kitchen",
        error: req.body.error || null,
      })],
    );
    res.json({ ok: true, source: "sbb_pos_core" });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

router.get("/receipts/reconciliation", staffDevice, async (req, res) => {
  const shiftDate = String(req.query.shift_date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) return fail(res, "shift_date must be YYYY-MM-DD");
  try {
    const result = await db().query(
      `SELECT id, order_number, ticket_number, status, payment_status,
              payment_method, total, created_at
       FROM ordering_orders
       WHERE channel IN ('pos_direct','grab')
         AND created_at >= (($1::date + time '17:00') AT TIME ZONE 'Asia/Bangkok')
         AND created_at < ((($1::date + 1) + time '03:00') AT TIME ZONE 'Asia/Bangkok')
       ORDER BY order_number`,
      [shiftDate],
    );
    const rows = result.rows;
    const numbers = rows.map((row) => Number(row.order_number)).filter(Number.isFinite);
    const first = numbers.length ? Math.min(...numbers) : null;
    const last = numbers.length ? Math.max(...numbers) : null;
    const present = new Set(numbers);
    const missing: string[] = [];
    if (first !== null && last !== null) {
      for (let n = first; n <= last; n += 1)
        if (!present.has(n)) missing.push(receiptNumber(n, `${shiftDate}T17:00:00+07:00`));
    }
    res.json({ ok: true, source: "sbb_pos_core", data: {
      shift_date: shiftDate,
      first_receipt: rows[0]?.ticket_number || null,
      last_receipt: rows.at(-1)?.ticket_number || null,
      completed_count: rows.length,
      expected_count: first === null || last === null ? 0 : last - first + 1,
      missing_receipts: missing,
      voided_count: rows.filter((row) => row.status === "cancelled").length,
      refunded_count: rows.filter((row) => row.payment_status === "refunded").length,
      total: rows.reduce((sum, row) => sum + value(row.total), 0),
      receipts: rows,
    }});
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

router.get("/kitchen/orders", staffDevice, async (_req, res) => {
  try {
    const result = await db().query(
      `SELECT o.*,
        json_agg(
          to_jsonb(i) || jsonb_build_object(
            'modifiers', COALESCE(
              (SELECT jsonb_agg(jsonb_build_object(
                  'name_en', m.modifier_name_en,
                  'price_delta', m.price_delta
                ))
               FROM ordering_order_item_modifiers m
               WHERE m.order_item_id = i.id),
              '[]'::jsonb
            )
          ) ORDER BY i.sort_order
        ) items
       FROM ordering_orders o
       JOIN ordering_order_items i ON i.order_id = o.id
       WHERE o.channel IN ('pos_direct','grab')
         AND o.status IN ('submitted','accepted','in_kitchen')
       GROUP BY o.id ORDER BY o.created_at`,
    );
    res.json({ ok: true, source: "sbb_pos_core", data: result.rows });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

router.get("/display/orders", async (_req, res) => {
  try {
    const result = await db().query(
      `SELECT ticket_number, status, updated_at
       FROM ordering_orders
       WHERE channel IN ('pos_direct','grab') AND status = 'ready'
       ORDER BY updated_at DESC LIMIT 20`,
    );
    res.json({ ok: true, source: "sbb_pos_core", data: result.rows });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

router.patch("/orders/:id/status", staffDevice, async (req, res) => {
  const allowed = ["accepted", "in_kitchen", "ready", "completed"];
  if (!allowed.includes(req.body.status)) return fail(res, "Unsupported ticket status");
  try {
    const row = (
      await db().query(
        `UPDATE ordering_orders SET status = $2, updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('completed','cancelled') RETURNING *`,
        [req.params.id, req.body.status],
      )
    ).rows[0];
    if (!row) return fail(res, "Order not found or already finalised", 409);
    await db().query(
      `INSERT INTO pos_order_events(order_id, event_type, payload) VALUES($1,$2,$3)`,
      [row.id, row.status === "ready" ? "ticket_ready" : "order_updated",
        JSON.stringify({ ticket_number: row.ticket_number, status: row.status })],
    );
    res.json({ ok: true, source: "sbb_pos_core", data: row });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});

export default router;

import { Router, type NextFunction, type Request, type Response } from "express";
import { pool } from "../db";
import { attachSessionUser } from "../middleware/sessionAuth";
import { getPinSessionUser } from "./pinAuth";

const router = Router();
const fail = (res: Response, message: string, status = 400) => res.status(status).json({ ok: false, source: "sbb_pos_grab", error: message });
const value = (input: unknown) => {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
};
const db = () => {
  if (!pool) throw new Error("POS database is unavailable");
  return pool;
};

function staffDevice(req: Request, res: Response, next: NextFunction) {
  if (process.env.EMERGENCY_STAFF_ACCESS === "true") return next();
  if (process.env.NODE_ENV !== "production") return next();
  if (attachSessionUser(req)) return next();
  const pinUser = getPinSessionUser(req);
  if (pinUser && (["owner", "manager", "cashier", "kitchen_staff"].includes(pinUser.role) || pinUser.permissions?.["pos.view"] === true)) {
    (req as any).user = pinUser;
    return next();
  }
  if (!process.env.POS_DEVICE_TOKEN || req.header("x-pos-device-token") !== process.env.POS_DEVICE_TOKEN) return fail(res, "Registered POS device required", 401);
  next();
}

function grabOnly(req: Request, _res: Response, next: NextFunction) {
  if (req.body?.order_mode !== "grab") return next("route");
  next();
}

const DISPLAY_TICKET_MAX = 999;
const DISPLAY_TICKET_DIGITS = 3;
const ticketNumber = (sequence: number) => String(sequence).padStart(DISPLAY_TICKET_DIGITS, "0");

/**
 * Grab checkout contract after the dedicated POS move.
 *
 * This route is mounted before the legacy POS router and handles Grab orders only.
 * Direct counter orders intentionally fall through to the existing canonical handler.
 * Grab customer phone is neither required nor persisted. The Grab receipt promotion is
 * an exact fixed THB adjustment against the order subtotal; individual menu prices stay
 * unchanged so gross sales, item mix and recipe/COGS reporting remain auditable.
 */
router.post("/orders", grabOnly, staffDevice, async (req, res) => {
  const input = req.body || {};
  if (!Array.isArray(input.items) || !input.items.length) return fail(res, "items are required");
  if (input.payment_method !== "grab") return fail(res, "Grab orders must use Grab payment");

  const grabOrderDigits = String(input.grab_order_number || "").slice(0, 64).replace(/\D/g, "");
  const grabOrderNumber = grabOrderDigits ? `GF-${grabOrderDigits}` : "";
  const customerName = String(input.customer_name || "").trim().slice(0, 120);
  const requestedGrabDiscount = Math.round(value(input.grab_discount_amount) * 100) / 100;
  if (!grabOrderDigits) return fail(res, "Enter the Grab order number");
  if (!customerName) return fail(res, "Grab customer name is required");
  if (requestedGrabDiscount < 0) return fail(res, "Grab discount cannot be negative");

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query(`ALTER TABLE ordering_orders DROP CONSTRAINT IF EXISTS ordering_orders_grab_order_number_unique`);
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ordering_orders_shift_grab_order_number_unique
       ON ordering_orders(pos_shift_id, grab_order_number)
       WHERE pos_shift_id IS NOT NULL AND grab_order_number IS NOT NULL`,
    );

    const openShiftResult = await client.query(`SELECT id FROM public.pos_shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1 FOR SHARE`);
    if (!openShiftResult.rowCount) throw new Error("Open a POS shift before taking orders");
    const activeShiftId = openShiftResult.rows[0].id;

    const order = (await client.query(
      `INSERT INTO ordering_orders(channel,order_mode,dining_type,order_notes,status,payment_status,payment_method,grab_order_number,customer_name,customer_mobile,pos_shift_id)
       VALUES('grab','grab',$1,$2,'submitted','paid','grab',$3,$4,NULL,$5) RETURNING *`,
      [input.dining_type || null, input.order_notes || null, grabOrderNumber, customerName, activeShiftId],
    )).rows[0];

    const numericOrderNumber = Number(order.order_number || 1);
    const displayTicket = ticketNumber(((numericOrderNumber - 1) % DISPLAY_TICKET_MAX) + 1);
    const storedTicket = `${displayTicket}-${order.id}`;
    await client.query(`UPDATE ordering_orders SET ticket_number=$2 WHERE id=$1`, [order.id, storedTicket]);

    let subtotal = 0;
    let sort = 0;
    for (const line of input.items) {
      const item = (await client.query(`SELECT * FROM ordering_menu_items WHERE id=$1 AND is_active AND pos_enabled AND NOT is_sold_out`, [line.menu_item_id])).rows[0];
      if (!item) throw new Error("POS item unavailable");
      const qty = Math.max(1, Math.trunc(value(line.quantity) || 1));
      const unit = value(item.grab_price ?? item.direct_price ?? item.price);
      if (!unit) throw new Error(`${item.name_en} has no grab price`);
      if (line.set_upgrade) throw new Error("Grab orders cannot use staff upsells");

      const modifierIds: string[] = Array.isArray(line.modifier_ids)
        ? [...new Set<string>(line.modifier_ids.filter((id: any): id is string => typeof id === "string"))]
        : [];
      const groupResult = await client.query(
        `SELECT DISTINCT g.id,g.name_en,g.selection_mode,
                COALESCE(g.min_selections,g.min_select,CASE WHEN g.is_required THEN 1 ELSE 0 END,0) AS min_selections,
                COALESCE(g.max_selections,g.max_select) AS max_selections
         FROM ordering_modifier_groups g
         WHERE g.is_active
           AND (g.menu_item_id=$1 OR EXISTS(SELECT 1 FROM ordering_modifier_group_items a WHERE a.modifier_group_id=g.id AND a.menu_item_id=$1))
           AND EXISTS(SELECT 1 FROM ordering_item_modifiers available WHERE available.modifier_group_id=g.id AND available.is_active)`,
        [item.id],
      );
      let selectedModifiers: any[] = [];
      if (modifierIds.length) {
        const modifierResult = await client.query(
          `SELECT m.*,g.name_en AS modifier_group_name_en,g.group_type
           FROM ordering_item_modifiers m JOIN ordering_modifier_groups g ON g.id=m.modifier_group_id
           WHERE m.id=ANY($1::uuid[]) AND m.is_active AND g.is_active
             AND (g.menu_item_id=$2 OR EXISTS(SELECT 1 FROM ordering_modifier_group_items a WHERE a.modifier_group_id=g.id AND a.menu_item_id=$2))`,
          [modifierIds,item.id],
        );
        selectedModifiers = modifierResult.rows;
        if (selectedModifiers.length !== modifierIds.length) throw new Error("Invalid option for this item");
      }
      const selectionsByGroup = new Map<string,number>();
      for (const modifier of selectedModifiers) {
        const key = String(modifier.modifier_group_id);
        selectionsByGroup.set(key,(selectionsByGroup.get(key)||0)+1);
      }
      for (const group of groupResult.rows) {
        const count = selectionsByGroup.get(String(group.id)) || 0;
        const minimum = Number(group.min_selections || 0);
        const maximum = group.selection_mode === "single" ? 1 : group.max_selections == null ? null : Number(group.max_selections);
        if (count < minimum) throw new Error(`Select ${minimum} option${minimum === 1 ? "" : "s"} from ${group.name_en}`);
        if (maximum !== null && count > maximum) throw new Error(`Select no more than ${maximum} option${maximum === 1 ? "" : "s"} from ${group.name_en}`);
      }

      const parent = (await client.query(
        `INSERT INTO ordering_order_items(order_id,menu_item_id,item_name_en,item_name_th,unit_price,quantity,line_total,notes,sort_order,source_sku,price_mode)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'grab') RETURNING *`,
        [order.id,item.id,item.name_en,item.name_th,unit,qty,unit*qty,line.notes||null,sort++,item.source_sku||null],
      )).rows[0];
      subtotal += unit * qty;

      for (const modifier of selectedModifiers) {
        const delta = value(modifier.price_delta) * qty;
        await client.query(
          `INSERT INTO ordering_order_item_modifiers(order_item_id,item_modifier_id,modifier_group_name_en,modifier_name_en,modifier_name_th,price_delta,quantity)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [parent.id,modifier.id,modifier.modifier_group_name_en,modifier.name_en,modifier.name_th,value(modifier.price_delta),qty],
        );
        await client.query(`UPDATE ordering_order_items SET line_total=line_total+$2 WHERE id=$1`, [parent.id,delta]);
        subtotal += delta;
      }
    }

    if (requestedGrabDiscount > subtotal) throw new Error("Grab discount cannot exceed the item subtotal");
    const discountAmount = requestedGrabDiscount;
    const total = Math.round(Math.max(0,subtotal-discountAmount)*100)/100;
    const discountCode = discountAmount > 0 ? "GRAB_PROMO" : null;
    const discountName = discountAmount > 0 ? "Grab promotion" : null;

    await client.query(
      `UPDATE ordering_orders SET subtotal=$2,total=$3,discount_code=$4,discount_name=$5,discount_amount=$6,customer_mobile=NULL WHERE id=$1`,
      [order.id,subtotal,total,discountCode,discountName,discountAmount],
    );
    await client.query(`INSERT INTO ordering_payments(order_id,method,status,amount) VALUES($1,'grab','confirmed',$2)`, [order.id,total]);
    await client.query(
      `INSERT INTO pos_order_events(order_id,event_type,payload) VALUES($1,'order_created',$2)`,
      [order.id,JSON.stringify({ticket_number:displayTicket,receipt_number:displayTicket,shift_id:activeShiftId,discount_code:discountCode||undefined,discount_name:discountName||undefined,discount_amount:discountAmount,subtotal,total,privacy:{customer_mobile_stored:false}})],
    );
    await client.query("COMMIT");

    res.status(201).json({
      ok:true,
      source:"sbb_pos_grab",
      data:{id:order.id,ticket_number:displayTicket,receipt_number:displayTicket,shift_id:activeShiftId,subtotal,discount_amount:discountAmount,total,created_at:order.created_at},
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error.code === "23505" && (error.constraint === "ordering_orders_shift_grab_order_number_unique" || String(error.constraint||"").includes("grab_order_number"))) {
      return fail(res, `Grab order ${grabOrderNumber} has already been entered for this shift`,409);
    }
    fail(res,error.message);
  } finally {
    client.release();
  }
});

export default router;

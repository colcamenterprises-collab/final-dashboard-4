import { Router, type NextFunction, type Request, type Response } from "express";
import { pool } from "../db";
import { attachSessionUser } from "../middleware/sessionAuth";
import { getPinSessionUser } from "./pinAuth";

const router = Router();
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ ok: false, source: "sbb_pos_shifts", error: message });
const db = () => { if (!pool) throw new Error("POS database is unavailable"); return pool; };
const amount = (input: unknown) => {
  const n = Number(input);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const text = (input: unknown, max = 300) => typeof input === "string" ? input.trim().slice(0, max) : "";
const register = (input: unknown) => text(input, 40).toLowerCase().replace(/[^a-z0-9_-]/g, "") || "main";

function requirePosStaff(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") return next();
  if (attachSessionUser(req)) return next();
  const pinUser = getPinSessionUser(req);
  if (pinUser && (["owner", "manager", "cashier", "kitchen_staff"].includes(pinUser.role) || pinUser.permissions?.["pos.view"] === true)) {
    (req as any).user = pinUser;
    return next();
  }
  if (!process.env.POS_DEVICE_TOKEN || req.header("x-pos-device-token") !== process.env.POS_DEVICE_TOKEN) {
    return fail(res, "Registered POS device required", 401);
  }
  next();
}

const actor = (req: Request) => {
  const user = (req as any).user;
  return { id: typeof user?.id === "number" ? user.id : null, name: text(user?.name, 120) || "POS device" };
};

async function shiftSummary(shiftId: string) {
  const result = await db().query(`
    SELECT s.*,
      COALESCE((SELECT SUM(p.amount) FROM ordering_orders o JOIN ordering_payments p ON p.order_id=o.id
        WHERE o.shift_id=s.id AND p.status='confirmed' AND p.method='cash'),0)::numeric AS cash_sales,
      COALESCE((SELECT SUM(amount) FROM pos_register_cash_movements m WHERE m.shift_id=s.id AND m.direction='in'),0)::numeric AS money_in,
      COALESCE((SELECT SUM(amount) FROM pos_register_cash_movements m WHERE m.shift_id=s.id AND m.direction='out'),0)::numeric AS money_out,
      COALESCE((SELECT COUNT(*) FROM ordering_orders o WHERE o.shift_id=s.id),0)::integer AS receipt_count
    FROM pos_register_shifts s WHERE s.id=$1`, [shiftId]);
  const row = result.rows[0];
  if (!row) return null;
  const expected = amount(row.opening_float) + amount(row.cash_sales) + amount(row.money_in) - amount(row.money_out);
  return { ...row, opening_float: amount(row.opening_float), cash_sales: amount(row.cash_sales), money_in: amount(row.money_in), money_out: amount(row.money_out), expected_cash: amount(row.expected_cash ?? expected), live_expected_cash: expected, cash_variance: row.cash_variance == null ? null : amount(row.cash_variance) };
}

router.get("/current", requirePosStaff, async (req, res) => {
  try {
    const result = await db().query(`SELECT id FROM pos_register_shifts WHERE register_code=$1 AND status='open' LIMIT 1`, [register(req.query.register_code)]);
    const data = result.rows[0] ? await shiftSummary(result.rows[0].id) : null;
    res.json({ ok: true, source: "sbb_pos_shifts", data });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.post("/open", requirePosStaff, async (req, res) => {
  const registerCode = register(req.body?.register_code);
  const openingFloat = amount(req.body?.opening_float);
  if (openingFloat < 0) return fail(res, "Opening float cannot be negative");
  const user = actor(req);
  try {
    const result = await db().query(`INSERT INTO pos_register_shifts(register_code,opened_by_user_id,opened_by_name,opening_float)
      VALUES($1,$2,$3,$4) RETURNING id`, [registerCode, user.id, user.name, openingFloat]);
    res.status(201).json({ ok: true, source: "sbb_pos_shifts", data: await shiftSummary(result.rows[0].id) });
  } catch (e: any) {
    if (e.code === "23505") return fail(res, "This register already has an open shift", 409);
    fail(res, e.message, 500);
  }
});

router.post("/:id/movements", requirePosStaff, async (req, res) => {
  const direction = req.body?.direction === "in" ? "in" : req.body?.direction === "out" ? "out" : "";
  const valid = direction === "out" ? ["shopping","wages","staff_payment","other"] : ["owner_funding","refund","cash_correction","other"];
  const category = text(req.body?.category, 40);
  const value = amount(req.body?.amount);
  const note = text(req.body?.note, 300);
  if (!direction || !valid.includes(category) || value <= 0 || !note) return fail(res, "Enter a valid cash direction, category, amount and note");
  const user = actor(req);
  try {
    const shift = await db().query(`SELECT id FROM pos_register_shifts WHERE id=$1 AND status='open'`, [req.params.id]);
    if (!shift.rows[0]) return fail(res, "Open shift not found", 404);
    const result = await db().query(`INSERT INTO pos_register_cash_movements(shift_id,direction,category,amount,note,created_by_user_id,created_by_name)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [req.params.id,direction,category,value,note,user.id,user.name]);
    res.status(201).json({ ok: true, source: "sbb_pos_shifts", data: result.rows[0] });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.post("/:id/close", requirePosStaff, async (req, res) => {
  const counted = amount(req.body?.closing_counted_cash);
  const notes = text(req.body?.close_notes, 500);
  if (counted < 0) return fail(res, "Closing counted cash cannot be negative");
  const user = actor(req);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(`SELECT * FROM pos_register_shifts WHERE id=$1 FOR UPDATE`, [req.params.id]);
    const shift = locked.rows[0];
    if (!shift || shift.status !== "open") throw new Error("Open shift not found");
    const totals = await client.query(`SELECT
      COALESCE((SELECT SUM(p.amount) FROM ordering_orders o JOIN ordering_payments p ON p.order_id=o.id WHERE o.shift_id=$1 AND p.status='confirmed' AND p.method='cash'),0)::numeric AS cash_sales,
      COALESCE((SELECT SUM(amount) FROM pos_register_cash_movements WHERE shift_id=$1 AND direction='in'),0)::numeric AS money_in,
      COALESCE((SELECT SUM(amount) FROM pos_register_cash_movements WHERE shift_id=$1 AND direction='out'),0)::numeric AS money_out`, [shift.id]);
    const expected = amount(shift.opening_float) + amount(totals.rows[0].cash_sales) + amount(totals.rows[0].money_in) - amount(totals.rows[0].money_out);
    await client.query(`UPDATE pos_register_shifts SET status='closed',closed_at=NOW(),closed_by_user_id=$2,closed_by_name=$3,closing_counted_cash=$4,expected_cash=$5,cash_variance=$6,close_notes=$7,updated_at=NOW() WHERE id=$1`,
      [shift.id,user.id,user.name,counted,expected,amount(counted-expected),notes||null]);
    await client.query("COMMIT");
    res.json({ ok: true, source: "sbb_pos_shifts", data: await shiftSummary(shift.id) });
  } catch (e: any) {
    await client.query("ROLLBACK");
    fail(res, e.message, e.message === "Open shift not found" ? 404 : 500);
  } finally { client.release(); }
});

router.get("/history", requirePosStaff, async (req, res) => {
  try {
    const result = await db().query(`SELECT id FROM pos_register_shifts WHERE register_code=$1 ORDER BY opened_at DESC LIMIT 100`, [register(req.query.register_code)]);
    res.json({ ok: true, source: "sbb_pos_shifts", data: await Promise.all(result.rows.map(row => shiftSummary(row.id))) });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.get("/:id/receipts", requirePosStaff, async (req, res) => {
  try {
    const shift = await shiftSummary(req.params.id);
    if (!shift) return fail(res, "Shift not found", 404);
    const receipts = await db().query(`SELECT o.id,o.ticket_number,o.created_at,o.collected_at,o.status,o.order_mode,o.payment_method,o.subtotal,o.total,o.discount_code,o.discount_name,o.discount_amount,
      COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'name',i.item_name_en,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total,'notes',i.notes,'is_set_component',i.is_set_component,'parent_order_item_id',i.parent_order_item_id,'modifiers',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',m.modifier_name_en,'price_delta',m.price_delta)) FROM ordering_order_item_modifiers m WHERE m.order_item_id=i.id),'[]'::jsonb)) ORDER BY i.sort_order) FILTER (WHERE i.id IS NOT NULL),'[]'::jsonb) AS items
      FROM ordering_orders o LEFT JOIN ordering_order_items i ON i.order_id=o.id WHERE o.shift_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`, [req.params.id]);
    const movements = await db().query(`SELECT * FROM pos_register_cash_movements WHERE shift_id=$1 ORDER BY created_at`, [req.params.id]);
    res.json({ ok: true, source: "sbb_pos_shifts", data: { shift, receipts: receipts.rows, cash_movements: movements.rows } });
  } catch (e: any) { fail(res, e.message, 500); }
});

export default router;

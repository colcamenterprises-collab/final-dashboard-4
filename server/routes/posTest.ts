import { Router, type NextFunction, type Request, type Response } from "express";
import { pool } from "../db";
import { getPinSessionUser } from "./pinAuth";

const router = Router();
const SOURCE = "sbb_pos_test_sandbox";
const fail = (res: Response, message: string, status = 400) => res.status(status).json({ ok: false, source: SOURCE, error: message });
const db = () => {
  if (!pool) throw new Error("POS database is unavailable");
  return pool;
};
const numberValue = (input: unknown) => {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
};
const textValue = (input: unknown, max = 240) => typeof input === "string" ? input.trim().slice(0, max) : "";

function managerOnly(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") return next();
  const user = getPinSessionUser(req);
  if (!user) return fail(res, "Manager login required for Test Mode", 401);
  if (!["owner", "manager"].includes(user.role)) return fail(res, "Manager access required for Test Mode", 403);
  (req as any).user = user;
  next();
}

router.use(managerOnly);

async function currentTestShift() {
  const result = await db().query(`SELECT * FROM public.pos_test_shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1`);
  return result.rows[0] || null;
}

async function testCashSales(shiftId: string) {
  const result = await db().query(
    `SELECT COALESCE(SUM(total),0) AS total FROM public.pos_test_orders WHERE shift_id=$1 AND payment_method='cash' AND status <> 'cancelled'`,
    [shiftId],
  );
  return numberValue(result.rows[0]?.total);
}

router.get("/access", (req, res) => {
  res.json({ ok: true, source: SOURCE, test_mode: true, data: { authorised: true, user: getPinSessionUser(req) } });
});

router.get("/current", async (_req, res) => {
  try {
    const shift = await currentTestShift();
    const movements = shift ? (await db().query(`SELECT * FROM public.pos_test_shift_movements WHERE shift_id=$1 ORDER BY created_at DESC`, [shift.id])).rows : [];
    const history = (await db().query(`SELECT * FROM public.pos_test_shifts ORDER BY opened_at DESC LIMIT 20`)).rows;
    res.json({ ok: true, source: SOURCE, test_mode: true, data: { shift, movements, history, cashSales: shift ? await testCashSales(shift.id) : 0 } });
  } catch (error: any) { fail(res, error.message, 500); }
});

router.post("/open", async (req, res) => {
  try {
    if (await currentTestShift()) return fail(res, "A test shift is already open", 409);
    const user = getPinSessionUser(req);
    const staffName = textValue(req.body?.staff_name, 120) || user?.name || "Manager Test";
    const startingFloat = numberValue(req.body?.starting_float);
    if (startingFloat < 0) return fail(res, "Starting float must be valid");
    const actor = user?.name || String(user?.id || "manager");
    const result = await db().query(`INSERT INTO public.pos_test_shifts(staff_name,starting_float,opened_by) VALUES($1,$2,$3) RETURNING *`, [staffName, startingFloat, actor]);
    res.status(201).json({ ok: true, source: SOURCE, test_mode: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === "23505") return fail(res, "A test shift is already open", 409);
    fail(res, error.message, 500);
  }
});

router.post("/:id/movements", async (req, res) => {
  try {
    const movementType = req.body?.movement_type;
    const amount = numberValue(req.body?.amount);
    const reason = textValue(req.body?.reason);
    if (!["cash_in", "cash_out"].includes(movementType) || amount <= 0 || !reason) return fail(res, "Movement type, amount and reason are required");
    const open = await db().query(`SELECT id FROM public.pos_test_shifts WHERE id=$1 AND status='open'`, [req.params.id]);
    if (!open.rowCount) return fail(res, "Test shift is not open", 409);
    const user = getPinSessionUser(req);
    const result = await db().query(
      `INSERT INTO public.pos_test_shift_movements(shift_id,movement_type,amount,reason,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, movementType, amount, reason, user?.name || String(user?.id || "manager")],
    );
    res.status(201).json({ ok: true, source: SOURCE, test_mode: true, data: result.rows[0] });
  } catch (error: any) { fail(res, error.message, 500); }
});

router.post("/:id/close", async (req, res) => {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const current = (await client.query(`SELECT * FROM public.pos_test_shifts WHERE id=$1 AND status='open' FOR UPDATE`, [req.params.id])).rows[0];
    if (!current) { await client.query("ROLLBACK"); return fail(res, "Test shift is not open", 409); }
    const closingCash = numberValue(req.body?.closing_cash);
    const cashBanked = numberValue(req.body?.cash_banked);
    if (closingCash < 0 || cashBanked < 0) { await client.query("ROLLBACK"); return fail(res, "Closing cash and cash banked must be valid"); }
    const movements = (await client.query(`SELECT COALESCE(SUM(CASE WHEN movement_type='cash_in' THEN amount ELSE -amount END),0) total FROM public.pos_test_shift_movements WHERE shift_id=$1`, [req.params.id])).rows[0];
    const cashSales = await testCashSales(current.id);
    const expected = numberValue(current.starting_float) + cashSales + numberValue(movements.total) - cashBanked;
    const variance = closingCash - expected;
    const user = getPinSessionUser(req);
    const actor = user?.name || String(user?.id || "manager");
    const closed = (await client.query(`UPDATE public.pos_test_shifts SET status='closed',closed_at=NOW(),closing_cash=$2,cash_banked=$3,expected_cash=$4,variance=$5,closed_by=$6,updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id, closingCash, cashBanked, expected, variance, actor])).rows[0];
    await client.query("COMMIT");
    res.json({ ok: true, source: SOURCE, test_mode: true, data: { ...closed, cash_sales: cashSales } });
  } catch (error: any) {
    await client.query("ROLLBACK");
    fail(res, error.message, 500);
  } finally { client.release(); }
});

router.get("/orders/next-ticket", async (_req, res) => {
  try {
    const shift = await currentTestShift();
    if (!shift) return fail(res, "Open a test shift before taking test orders", 409);
    const result = await db().query(`SELECT COUNT(*)::int + 1 AS next_number FROM public.pos_test_orders WHERE shift_id=$1`, [shift.id]);
    const next = Number(result.rows[0]?.next_number || 1);
    res.json({ ok: true, source: SOURCE, test_mode: true, data: { ticket_number: String(((next - 1) % 999) + 1).padStart(3, "0") } });
  } catch (error: any) { fail(res, error.message, 500); }
});

router.post("/orders", async (req, res) => {
  const input = req.body || {};
  const mode = input.order_mode === "grab" ? "grab" : input.order_mode === "direct" ? "direct" : null;
  if (!mode || !Array.isArray(input.items) || !input.items.length) return fail(res, "order_mode and items are required");
  if (mode === "grab" && input.payment_method !== "grab") return fail(res, "Grab orders must use Grab payment");
  if (mode === "direct" && !["cash", "manual_qr_transfer"].includes(input.payment_method)) return fail(res, "Direct orders must use Cash or QR payment");

  const grabDigits = String(input.grab_order_number || "").slice(0, 64).replace(/\D/g, "");
  const grabOrderNumber = mode === "grab" && grabDigits ? `GF-${grabDigits}` : null;
  const customerName = textValue(input.customer_name, 120);
  const customerMobile = textValue(input.customer_mobile, 30);
  if (mode === "grab" && (!grabDigits || !customerName || !customerMobile)) return fail(res, "Grab order number, customer name and mobile are required");

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const shift = (await client.query(`SELECT * FROM public.pos_test_shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1 FOR SHARE`)).rows[0];
    if (!shift) throw new Error("Open a test shift before taking test orders");
    const count = Number((await client.query(`SELECT COUNT(*)::int AS count FROM public.pos_test_orders WHERE shift_id=$1`, [shift.id])).rows[0]?.count || 0);
    const ticket = String((count % 999) + 1).padStart(3, "0");
    let subtotal = 0;
    const receiptItems: any[] = [];

    for (const line of input.items) {
      const item = (await client.query(`SELECT * FROM public.ordering_menu_items WHERE id=$1 AND is_active AND pos_enabled AND NOT is_sold_out`, [line.menu_item_id])).rows[0];
      if (!item) throw new Error("POS item unavailable");
      const quantity = Math.max(1, Math.trunc(numberValue(line.quantity) || 1));
      const unitPrice = numberValue(mode === "grab" ? item.grab_price : (item.direct_price ?? item.price));
      if (!unitPrice) throw new Error(`${item.name_en} has no ${mode} price`);
      if (mode === "grab" && line.set_upgrade) throw new Error("Grab orders cannot use staff upsells");

      const rawModifierIds = Array.isArray(line.modifier_ids) ? line.modifier_ids.filter((id: unknown): id is string => typeof id === "string") : [];
      const modifierIds = Array.from(new Set<string>(rawModifierIds));
      const selectedModifiers = modifierIds.length ? (await client.query(
        `SELECT m.*,g.name_en AS modifier_group_name_en,g.group_type FROM public.ordering_item_modifiers m JOIN public.ordering_modifier_groups g ON g.id=m.modifier_group_id WHERE m.id=ANY($1::uuid[]) AND m.is_active AND g.is_active AND (g.menu_item_id=$2 OR EXISTS(SELECT 1 FROM public.ordering_modifier_group_items a WHERE a.modifier_group_id=g.id AND a.menu_item_id=$2))`,
        [modifierIds, item.id],
      )).rows : [];
      if (selectedModifiers.length !== modifierIds.length) throw new Error("Invalid option for this item");

      const modifiers = selectedModifiers.map((modifier: any) => ({ id: modifier.id, name_en: modifier.name_en, modifier_name_en: modifier.name_en, name_th: modifier.name_th, price_delta: numberValue(modifier.price_delta), quantity }));
      const modifierTotal = modifiers.reduce((sum: number, modifier: any) => sum + numberValue(modifier.price_delta) * quantity, 0);
      let lineTotal = unitPrice * quantity + modifierTotal;
      const receiptItem: any = { id: `${item.id}-${receiptItems.length}`, menu_item_id: item.id, item_name_en: item.name_en, item_name_th: item.name_th, unit_price: unitPrice, quantity, line_total: lineTotal, notes: textValue(line.notes, 240) || null, is_set_component: false, modifiers };

      if (mode === "direct" && line.set_upgrade) {
        if (!line.set_drink_menu_item_id) throw new Error("Set drink selection is required");
        const [friesResult, drinkResult, settingResult] = await Promise.all([
          client.query(`SELECT * FROM public.ordering_menu_items WHERE lower(name_en)=lower('French Fries') AND is_active AND pos_enabled LIMIT 1`),
          client.query(`SELECT * FROM public.ordering_menu_items WHERE id=$1 AND is_active AND pos_enabled`, [line.set_drink_menu_item_id]),
          client.query(`SELECT value FROM public.ordering_settings WHERE key='pos_set_upgrade_amount' LIMIT 1`),
        ]);
        const fries = friesResult.rows[0];
        const drink = drinkResult.rows[0];
        const upgrade = numberValue(settingResult.rows[0]?.value || 80);
        if (!fries || !drink) throw new Error("Set fries or drink is not configured");
        lineTotal += upgrade * quantity;
        receiptItem.line_total = lineTotal;
        receiptItem.modifiers.push({ name_en: "Burger + French Fries + Drink", modifier_name_en: "Burger + French Fries + Drink", price_delta: upgrade, quantity });
        receiptItems.push(receiptItem,
          { id: `set-fries-${receiptItems.length}`, menu_item_id: fries.id, item_name_en: fries.name_en, item_name_th: fries.name_th, unit_price: 0, quantity, line_total: 0, notes: null, is_set_component: true, modifiers: [] },
          { id: `set-drink-${receiptItems.length}`, menu_item_id: drink.id, item_name_en: drink.name_en, item_name_th: drink.name_th, unit_price: 0, quantity, line_total: 0, notes: null, is_set_component: true, modifiers: [] });
      } else receiptItems.push(receiptItem);
      subtotal += lineTotal;
    }

    let discountAmount = 0;
    let discountCode: string | null = null;
    const requestedDiscount = textValue(input.discount_code, 32).toUpperCase();
    if (requestedDiscount) {
      const discount = (await client.query(`SELECT code,name,discount_type,value FROM public.pos_discount_codes WHERE upper(code)=upper($1) AND active AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>=NOW()) LIMIT 1`, [requestedDiscount])).rows[0];
      if (!discount) throw new Error("Selected discount code is unavailable");
      discountCode = discount.code;
      const raw = discount.discount_type === "percent" ? (subtotal * numberValue(discount.value)) / 100 : numberValue(discount.value);
      discountAmount = Math.min(subtotal, Math.round(raw * 100) / 100);
    }
    const total = Math.max(0, subtotal - discountAmount);
    const payload = { items: receiptItems, dining_type: input.dining_type || "takeaway", order_notes: input.order_notes || null, channel: mode === "grab" ? "grab" : "pos_direct", pos_origin_channel: mode === "grab" ? "grab" : "pos_direct", discount_code: discountCode };
    const created = (await client.query(`INSERT INTO public.pos_test_orders(shift_id,ticket_number,order_mode,payment_method,status,grab_order_number,customer_name,customer_mobile,subtotal,discount_amount,total,payload) VALUES($1,$2,$3,$4,'submitted',$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING *`, [shift.id, ticket, mode, input.payment_method, grabOrderNumber, mode === "grab" ? customerName : null, mode === "grab" ? customerMobile : null, subtotal, discountAmount, total, JSON.stringify(payload)])).rows[0];
    await client.query("COMMIT");
    res.status(201).json({ ok: true, source: SOURCE, test_mode: true, data: { id: created.id, ticket_number: ticket, receipt_number: ticket, shift_id: shift.id, subtotal, discount_amount: discountAmount, total, created_at: created.created_at } });
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error.code === "23505" && String(error.constraint || "").includes("grab")) return fail(res, `Grab order ${grabOrderNumber} has already been entered for this test shift`, 409);
    fail(res, error.message, 400);
  } finally { client.release(); }
});

router.get("/orders/:id/receipt", async (req, res) => {
  try {
    const row = (await db().query(`SELECT * FROM public.pos_test_orders WHERE id=$1`, [req.params.id])).rows[0];
    if (!row) return fail(res, "Test receipt not found", 404);
    const payload = row.payload || {};
    res.json({ ok: true, source: SOURCE, test_mode: true, data: { ...row, items: payload.items || [] } });
  } catch (error: any) { fail(res, error.message, 500); }
});

router.post("/orders/:id/print-event", (_req, res) => res.json({ ok: true, source: SOURCE, test_mode: true }));

router.get("/kitchen/orders", async (_req, res) => {
  try {
    const shift = await currentTestShift();
    if (!shift) return res.json({ ok: true, source: SOURCE, test_mode: true, data: [] });
    const rows = (await db().query(`SELECT * FROM public.pos_test_orders WHERE shift_id=$1 AND status NOT IN ('completed','cancelled') ORDER BY created_at ASC`, [shift.id])).rows;
    const data = rows.map((row: any) => ({ ...row, ...(row.payload || {}), ticket_number: row.ticket_number, order_mode: row.order_mode, customer_name: row.customer_name }));
    res.json({ ok: true, source: SOURCE, test_mode: true, data });
  } catch (error: any) { fail(res, error.message, 500); }
});

router.patch("/orders/:id/status", async (req, res) => {
  try {
    const status = String(req.body?.status || "");
    if (!["accepted", "preparing", "ready", "completed", "cancelled"].includes(status)) return fail(res, "Invalid test order status");
    const updated = (await db().query(`UPDATE public.pos_test_orders SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id, status])).rows[0];
    if (!updated) return fail(res, "Test order not found", 404);
    res.json({ ok: true, source: SOURCE, test_mode: true, data: updated });
  } catch (error: any) { fail(res, error.message, 500); }
});

router.get("/display/orders", async (_req, res) => {
  try {
    const shift = await currentTestShift();
    if (!shift) return res.json({ ok: true, source: SOURCE, test_mode: true, data: [] });
    const rows = (await db().query(`SELECT id,ticket_number,created_at FROM public.pos_test_orders WHERE shift_id=$1 AND status='ready' ORDER BY created_at ASC`, [shift.id])).rows;
    res.json({ ok: true, source: SOURCE, test_mode: true, data: rows });
  } catch (error: any) { fail(res, error.message, 500); }
});

router.delete("/reset", async (_req, res) => {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM public.pos_test_orders`);
    await client.query(`DELETE FROM public.pos_test_shift_movements`);
    await client.query(`DELETE FROM public.pos_test_shifts`);
    await client.query("COMMIT");
    res.json({ ok: true, source: SOURCE, test_mode: true, data: { reset: true } });
  } catch (error: any) {
    await client.query("ROLLBACK");
    fail(res, error.message, 500);
  } finally { client.release(); }
});

export default router;

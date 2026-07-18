import { Router, type NextFunction, type Request, type Response } from "express";
import { pool } from "../db";
import { attachSessionUser } from "../middleware/sessionAuth";
import { getPinSessionUser } from "./pinAuth";

const router = Router();
const fail = (res: Response, message: string, status = 400) => res.status(status).json({ ok: false, source: "sbb_pos_core", error: message });
const db = () => { if (!pool) throw new Error("POS database is unavailable"); return pool; };
const value = (input: unknown) => { const n = Number(input); return Number.isFinite(n) ? n : 0; };
const text = (input: unknown, max = 200) => typeof input === "string" ? input.trim().slice(0, max) : "";
const SKIP_REASONS = ["customer_declined", "customer_in_a_hurry", "already_a_member"] as const;

function staffDevice(req: Request, res: Response, next: NextFunction) {
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
function ownerOnly(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user || getPinSessionUser(req);
  if (!user || user.role !== "owner") return fail(res, "Owner access required", 403);
  next();
}

router.get("/menu", async (req, res) => {
  try {
    const mode = req.query.price_mode === "grab" ? "grab" : "direct";
    const price = mode === "grab" ? "grab_price" : "direct_price";
    const rows = await db().query(`SELECT i.*, c.name_en category_name, COALESCE(i.${price},i.direct_price,i.price) active_price
      FROM ordering_menu_items i JOIN ordering_menu_categories c ON c.id=i.category_id
      WHERE c.is_active AND lower(c.name_en) <> lower('Phase 1 Test Menu') AND i.is_active AND i.pos_enabled AND NOT i.is_sold_out
      ORDER BY c.sort_order,i.sort_order`);
    res.json({ ok: true, source: "sbb_pos_core", price_mode: mode, data: rows.rows });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.get("/discounts", staffDevice, async (_req, res) => {
  try {
    const result = await db().query(`SELECT id, code, name, discount_type, value
      FROM pos_discount_codes
      WHERE active AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())
      ORDER BY code`);
    res.json({ ok: true, source: "sbb_pos_core", data: result.rows.map(row => ({ ...row, value: value(row.value) })) });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.get("/discounts/manage", staffDevice, ownerOnly, async (_req, res) => {
  try {
    const result = await db().query(`SELECT id, code, name, discount_type, value, active, starts_at, ends_at, created_at
      FROM pos_discount_codes ORDER BY active DESC, code`);
    res.json({ ok: true, source: "sbb_pos_core", data: result.rows.map(row => ({ ...row, value: value(row.value) })) });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.post("/discounts/manage", staffDevice, ownerOnly, async (req, res) => {
  const code = text(req.body?.code, 32).toUpperCase();
  const name = text(req.body?.name, 100);
  const discountType = req.body?.discount_type === "fixed" ? "fixed" : req.body?.discount_type === "percent" ? "percent" : "";
  const discountValue = value(req.body?.value);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) return fail(res, "Discount code must use 3–32 letters, numbers, hyphens, or underscores");
  if (!name || !discountType || discountValue <= 0 || (discountType === "percent" && discountValue > 100)) return fail(res, "Enter a valid discount name and value");
  try {
    const result = await db().query(`INSERT INTO pos_discount_codes(code,name,discount_type,value)
      VALUES($1,$2,$3,$4) RETURNING id, code, name, discount_type, value, active`, [code, name, discountType, discountValue]);
    res.status(201).json({ ok: true, source: "sbb_pos_core", data: { ...result.rows[0], value: value(result.rows[0].value) } });
  } catch (e: any) {
    if (e.code === "23505") return fail(res, "That discount code already exists", 409);
    fail(res, e.message, 500);
  }
});

router.patch("/discounts/manage/:id", staffDevice, ownerOnly, async (req, res) => {
  if (typeof req.body?.active !== "boolean") return fail(res, "active must be true or false");
  try {
    const result = await db().query(`UPDATE pos_discount_codes SET active=$2, updated_at=NOW() WHERE id=$1
      RETURNING id, code, name, discount_type, value, active`, [req.params.id, req.body.active]);
    if (!result.rows[0]) return fail(res, "Discount code not found", 404);
    res.json({ ok: true, source: "sbb_pos_core", data: { ...result.rows[0], value: value(result.rows[0].value) } });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.get("/marketing-prompt", staffDevice, async (_req, res) => {
  const fallback = "Are you a member? If you join you get 10% off every meal, starting with your next order";
  try {
    const result = await db().query(`SELECT value FROM ordering_settings WHERE key='pos_marketing_prompt' LIMIT 1`);
    const stored = result.rows[0]?.value;
    const prompt = typeof stored === "string" ? stored : typeof stored?.text === "string" ? stored.text : fallback;
    res.json({ ok: true, source: "sbb_pos_core", data: { prompt } });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.get("/orders/next-ticket", staffDevice, async (_req, res) => {
  try {
    const result = await db().query(`SELECT COALESCE(MAX(order_number),0)+1 AS next_order_number FROM ordering_orders`);
    const next = Number(result.rows[0]?.next_order_number || 1);
    res.json({ ok: true, source: "sbb_pos_core", data: { ticket_number: `SBB-${String(next).padStart(4, "0")}` } });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.get("/menu/:menuItemId/modifiers", staffDevice, async (req, res) => {
  try {
    const result = await db().query(`SELECT m.*,g.name_en AS modifier_group_name_en,g.name_th AS modifier_group_name_th
      FROM ordering_item_modifiers m JOIN ordering_modifier_groups g ON g.id=m.modifier_group_id
      WHERE g.menu_item_id=$1 AND m.is_active ORDER BY g.sort_order,m.sort_order`, [req.params.menuItemId]);
    res.json({ ok: true, source: "sbb_pos_core", data: result.rows });
  } catch (e: any) { fail(res, e.message, 500); }
});

router.post("/orders", staffDevice, async (req, res) => {
  const input = req.body || {};
  const mode = input.order_mode === "grab" ? "grab" : input.order_mode === "direct" ? "direct" : null;
  if (!mode || !Array.isArray(input.items) || !input.items.length) return fail(res, "order_mode and items are required");
  if (mode === "grab" && input.payment_method !== "grab") return fail(res, "Grab orders must use Grab payment");

  const grabOrderNumber = text(input.grab_order_number, 12).toUpperCase();
  const customerName = text(input.customer_name, 120);
  const customerMobile = text(input.customer_mobile, 30);
  if (mode === "grab") {
    if (!/^GF-[A-Z0-9]{5,7}$/.test(grabOrderNumber)) return fail(res, "Grab order number must be GF- followed by 5–7 letters or numbers");
    if (!customerName) return fail(res, "Grab customer name is required");
    if (!/^[+0-9][0-9 ()-]{5,29}$/.test(customerMobile)) return fail(res, "Enter the Grab customer mobile number");
  }

  const marketing = input.marketing || {};
  const marketingFirstName = text(marketing.first_name, 80);
  const marketingMobile = text(marketing.mobile_number, 30);
  const marketingEmail = text(marketing.email, 160).toLowerCase();
  const marketingConsent = marketing.consent === true;
  const marketingSkipReason = text(marketing.skip_reason, 80);
  if (marketingConsent) {
    if (!marketingFirstName || (!marketingMobile && !marketingEmail)) return fail(res, "Marketing consent needs a first name and a mobile number or email");
    if (marketingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(marketingEmail)) return fail(res, "Enter a valid email address");
  } else if (!SKIP_REASONS.includes(marketingSkipReason as typeof SKIP_REASONS[number])) {
    return fail(res, "Select a reason when the customer does not join");
  }

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const order = (await client.query(`INSERT INTO ordering_orders(
      channel,order_mode,dining_type,order_notes,status,payment_status,payment_method,
      grab_order_number,customer_name,customer_mobile,customer_first_name,customer_email,
      marketing_consent,marketing_skip_reason
    ) VALUES($1,$2,$3,$4,'submitted','paid',$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [
      mode === "grab" ? "grab" : "pos_direct", mode, input.dining_type || null, input.order_notes || null,
      input.payment_method, mode === "grab" ? grabOrderNumber : null, mode === "grab" ? customerName : null,
      mode === "grab" ? customerMobile : null, marketingConsent ? marketingFirstName : null,
      marketingConsent ? marketingEmail : null, marketingConsent, marketingConsent ? null : marketingSkipReason,
    ])).rows[0];

    const ticket = `SBB-${String(order.order_number).padStart(4, "0")}`;
    await client.query(`UPDATE ordering_orders SET ticket_number=$2 WHERE id=$1`, [order.id, ticket]);
    let subtotal = 0;
    let sort = 0;

    for (const line of input.items) {
      const item = (await client.query(`SELECT * FROM ordering_menu_items WHERE id=$1 AND is_active AND pos_enabled AND NOT is_sold_out`, [line.menu_item_id])).rows[0];
      if (!item) throw new Error("POS item unavailable");
      const qty = Math.max(1, Math.trunc(value(line.quantity) || 1));
      const unit = value(mode === "grab" ? item.grab_price : item.direct_price ?? item.price);
      if (!unit) throw new Error(`${item.name_en} has no ${mode} price`);
      if (mode === "direct" && item.set_upgrade_eligible && line.set_upgrade === undefined) throw new Error(`Set decision required for ${item.name_en}`);
      if (mode === "grab" && line.set_upgrade) throw new Error("Grab orders cannot use staff upsells");

      const parent = (await client.query(`INSERT INTO ordering_order_items(order_id,menu_item_id,item_name_en,item_name_th,unit_price,quantity,line_total,notes,sort_order,source_sku,price_mode)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [
        order.id, item.id, item.name_en, item.name_th, unit, qty, unit * qty, line.notes || null, sort++, item.source_sku || null, mode,
      ])).rows[0];
      subtotal += unit * qty;

      const modifierIds = Array.isArray(line.modifier_ids) ? [...new Set(line.modifier_ids.filter((id: any) => typeof id === "string"))] : [];
      if (mode === "grab" && modifierIds.length) throw new Error("Grab orders cannot use staff modifiers");
      if (modifierIds.length) {
        const result = await client.query(`SELECT m.*,g.name_en AS modifier_group_name_en FROM ordering_item_modifiers m
          JOIN ordering_modifier_groups g ON g.id=m.modifier_group_id WHERE m.id=ANY($1::uuid[]) AND g.menu_item_id=$2 AND m.is_active`, [modifierIds, item.id]);
        if (result.rows.length !== modifierIds.length) throw new Error("Invalid modifier for this item");
        for (const modifier of result.rows) {
          const delta = value(modifier.price_delta) * qty;
          await client.query(`INSERT INTO ordering_order_item_modifiers(order_item_id,item_modifier_id,modifier_group_name_en,modifier_name_en,modifier_name_th,price_delta,quantity)
            VALUES($1,$2,$3,$4,$5,$6,$7)`, [parent.id, modifier.id, modifier.modifier_group_name_en, modifier.name_en, modifier.name_th, value(modifier.price_delta), qty]);
          await client.query(`UPDATE ordering_order_items SET line_total=line_total+$2 WHERE id=$1`, [parent.id, delta]);
          subtotal += delta;
        }
      }

      if (mode === "direct" && line.set_upgrade) {
        if (!line.set_drink_menu_item_id) throw new Error("Set drink selection is required");
        const [friesResult, drinkResult, setting] = await Promise.all([
          client.query(`SELECT * FROM ordering_menu_items WHERE lower(name_en)=lower('French Fries') AND is_active AND pos_enabled LIMIT 1`),
          client.query(`SELECT * FROM ordering_menu_items WHERE id=$1 AND is_active AND pos_enabled`, [line.set_drink_menu_item_id]),
          client.query(`SELECT value FROM ordering_settings WHERE key='pos_set_upgrade_amount'`),
        ]);
        const fries = friesResult.rows[0], drink = drinkResult.rows[0], upgrade = value(setting.rows[0]?.value || 80);
        if (!fries || !drink) throw new Error("Set fries or drink is not configured");
        await client.query(`UPDATE ordering_order_items SET line_total=line_total+$2 WHERE id=$1`, [parent.id, upgrade * qty]);
        await client.query(`INSERT INTO ordering_order_item_modifiers(order_item_id,modifier_group_name_en,modifier_name_en,price_delta,quantity)
          VALUES($1,'SET UPGRADE','Burger + French Fries + Drink',$2,$3)`, [parent.id, upgrade, qty]);
        for (const component of [fries, drink]) await client.query(`INSERT INTO ordering_order_items(order_id,menu_item_id,item_name_en,item_name_th,unit_price,quantity,line_total,sort_order,source_sku,price_mode,is_set_component,parent_order_item_id)
          VALUES($1,$2,$3,$4,0,$5,0,$6,$7,$8,true,$9)`, [order.id, component.id, component.name_en, component.name_th, qty, sort++, component.source_sku || null, mode, parent.id]);
        subtotal += upgrade * qty;
      }
    }

    let discountAmount = 0;
    let discount: any = null;
    const requestedDiscount = text(input.discount_code, 32).toUpperCase();
    if (requestedDiscount) {
      const result = await client.query(`SELECT code,name,discount_type,value FROM pos_discount_codes
        WHERE upper(code)=upper($1) AND active AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW()) LIMIT 1`, [requestedDiscount]);
      discount = result.rows[0];
      if (!discount) throw new Error("Selected discount code is unavailable");
      const raw = discount.discount_type === "percent" ? subtotal * value(discount.value) / 100 : value(discount.value);
      discountAmount = Math.min(subtotal, Math.round(raw * 100) / 100);
    }
    const total = Math.max(0, subtotal - discountAmount);

    await client.query(`UPDATE ordering_orders SET subtotal=$2,total=$3,discount_code=$4,discount_name=$5,discount_amount=$6 WHERE id=$1`,
      [order.id, subtotal, total, discount?.code || null, discount?.name || null, discountAmount]);
    await client.query(`INSERT INTO ordering_payments(order_id,method,status,amount) VALUES($1,$2,'confirmed',$3)`, [order.id, input.payment_method, total]);
    if (marketingConsent) {
      await client.query(`INSERT INTO pos_customer_marketing_captures(order_id,first_name,mobile_number,email,consent)
        VALUES($1,$2,$3,$4,true)`, [order.id, marketingFirstName, marketingMobile || null, marketingEmail || null]);
    }
    await client.query(`INSERT INTO pos_order_events(order_id,event_type,payload) VALUES($1,'order_created',$2)`,
      [order.id, JSON.stringify({ ticket_number: ticket, mode, grab_order_number: mode === "grab" ? grabOrderNumber : undefined, discount_code: discount?.code || undefined, discount_amount: discountAmount })]);
    await client.query("COMMIT");
    res.status(201).json({ ok: true, source: "sbb_pos_core", data: { id: order.id, ticket_number: ticket, subtotal, discount_amount: discountAmount, total } });
  } catch (e: any) {
    await client.query("ROLLBACK");
    fail(res, e.message);
  } finally { client.release(); }
});

router.get("/kitchen/orders", staffDevice, async (_req, res) => {
  try {
    const result = await db().query(`SELECT o.*,json_agg(to_jsonb(i) || jsonb_build_object('modifiers',COALESCE((SELECT jsonb_agg(jsonb_build_object('name_en',m.modifier_name_en,'price_delta',m.price_delta)) FROM ordering_order_item_modifiers m WHERE m.order_item_id=i.id),'[]'::jsonb)) ORDER BY i.sort_order) items FROM ordering_orders o JOIN ordering_order_items i ON i.order_id=o.id WHERE o.channel IN ('pos_direct','grab') AND o.status IN ('submitted','accepted','in_kitchen') GROUP BY o.id ORDER BY o.created_at`);
    res.json({ ok: true, source: "sbb_pos_core", data: result.rows });
  } catch (e: any) { fail(res, e.message, 500); }
});
router.get("/display/orders", async (_req, res) => {
  try {
    const result = await db().query(`SELECT ticket_number,status,updated_at FROM ordering_orders WHERE channel IN ('pos_direct','grab') AND status='ready' ORDER BY updated_at DESC LIMIT 20`);
    res.json({ ok: true, source: "sbb_pos_core", data: result.rows });
  } catch (e: any) { fail(res, e.message, 500); }
});
router.patch("/orders/:id/status", staffDevice, async (req, res) => {
  const allowed = ["accepted", "in_kitchen", "ready", "completed"];
  if (!allowed.includes(req.body.status)) return fail(res, "Unsupported ticket status");
  try {
    const row = (await db().query(`UPDATE ordering_orders SET status=$2,updated_at=NOW() WHERE id=$1 AND status NOT IN ('completed','cancelled') RETURNING *`, [req.params.id, req.body.status])).rows[0];
    if (!row) return fail(res, "Order not found or already finalised", 409);
    await db().query(`INSERT INTO pos_order_events(order_id,event_type,payload) VALUES($1,$2,$3)`, [row.id, row.status === "ready" ? "ticket_ready" : "order_updated", JSON.stringify({ ticket_number: row.ticket_number, status: row.status })]);
    res.json({ ok: true, source: "sbb_pos_core", data: row });
  } catch (e: any) { fail(res, e.message, 500); }
});
export default router;

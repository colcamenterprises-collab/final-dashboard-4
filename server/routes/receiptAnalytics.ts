import { Router } from "express";
import { DateTime } from "luxon";
import { pool } from "../db";

const router = Router();
const TZ = "Asia/Bangkok";
const HISTORICAL_START = DateTime.fromISO("2026-01-01T17:00:00+07:00");
const HISTORICAL_END = DateTime.fromISO("2026-08-08T03:00:00+07:00");
const LIVE_CUTOVER = DateTime.fromISO("2026-08-08T17:00:00+07:00");
const HISTORICAL_SHA = "0691d0062768a4fcf3b7f530905b716d0c370cf65d6e40ac1bb7268d5bb5c854";

const n = (v: unknown) => Number(v ?? 0) || 0;
const s = (v: unknown) => String(v ?? "");
const validDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(s(v)) ? s(v) : null;
const validTime = (v: unknown) => /^\d{2}:\d{2}$/.test(s(v)) ? s(v) : null;
const bkk = (value: unknown) => DateTime.fromJSDate(new Date(String(value))).setZone(TZ);

const categoryCase = `CASE
 WHEN lower(COALESCE(c.name_en,'')) LIKE '%chicken%' OR lower(i.item_name_en) LIKE '%chicken%' OR lower(i.item_name_en) LIKE '%nugget%' OR lower(i.item_name_en) LIKE '%karaage%' THEN 'Chicken'
 WHEN lower(COALESCE(c.name_en,'')) LIKE '%fries%' OR lower(i.item_name_en) LIKE '%fries%' OR lower(i.item_name_en) LIKE '%cajun%' OR lower(i.item_name_en) LIKE '%sweet potato%' OR lower(i.item_name_en) LIKE '%dirty%' OR lower(i.item_name_en) LIKE '%loaded%' THEN 'Fries'
 WHEN lower(COALESCE(c.name_en,'')) LIKE '%drink%' OR lower(i.item_name_en) LIKE '%coke%' OR lower(i.item_name_en) LIKE '%water%' OR lower(i.item_name_en) LIKE '%fanta%' OR lower(i.item_name_en) LIKE '%soda%' OR lower(i.item_name_en) LIKE '%schweppes%' OR lower(i.item_name_en) LIKE '%juice%' THEN 'Drinks'
 WHEN lower(COALESCE(c.name_en,'')) LIKE '%side%' OR lower(i.item_name_en) LIKE '%coleslaw%' OR lower(i.item_name_en) LIKE '%onion ring%' THEN 'Sides'
 WHEN lower(COALESCE(c.name_en,'')) LIKE '%burger%' OR lower(i.item_name_en) LIKE '%burger%' OR lower(i.item_name_en) LIKE '%smash%' THEN 'Burgers'
 ELSE COALESCE(NULLIF(c.name_en,''),'Other') END`;

const modifierTypeCase = `CASE
 WHEN lower(COALESCE(m.modifier_group_name_en,'')) LIKE '%upgrade%' OR lower(COALESCE(m.modifier_group_name_en,'')) LIKE '%make it better%' OR lower(COALESCE(m.modifier_group_name_en,'')) LIKE '%extra%' OR lower(COALESCE(m.modifier_group_name_en,'')) LIKE '%add on%' OR lower(COALESCE(m.modifier_group_name_en,'')) LIKE '%add-on%' OR lower(COALESCE(m.modifier_group_name_en,'')) LIKE '%upsell%' THEN 'Upsell'
 WHEN lower(COALESCE(m.modifier_group_name_en,'')) LIKE '%size%' OR lower(COALESCE(m.modifier_group_name_en,'')) LIKE '%choose%' OR lower(COALESCE(m.modifier_group_name_en,'')) LIKE '%option%' THEN 'Option'
 ELSE 'Modifier' END`;

type Window = {
  mode: string;
  fromDate: string;
  toDate: string;
  windowStart: string;
  windowEnd: string;
  startUtc: string;
  endUtc: string;
  shiftIds: string[];
};

function makeWindow(mode: string, start: DateTime, end: DateTime, shiftIds: string[] = []): Window {
  return {
    mode,
    fromDate: start.setZone(TZ).toISODate() || "",
    toDate: end.setZone(TZ).toISODate() || "",
    windowStart: start.setZone(TZ).toFormat("yyyy-MM-dd HH:mm:ss"),
    windowEnd: end.setZone(TZ).toFormat("yyyy-MM-dd HH:mm:ss"),
    startUtc: start.toUTC().toISO() || "",
    endUtc: end.toUTC().toISO() || "",
    shiftIds,
  };
}

async function resolveWindow(q: Record<string, unknown>): Promise<Window | null> {
  const fd = validDate(q.fromDate);
  const ft = validTime(q.fromTime);
  const td = validDate(q.toDate);
  const tt = validTime(q.toTime);

  if (fd && ft && td && tt) {
    const start = DateTime.fromFormat(`${fd} ${ft}`, "yyyy-MM-dd HH:mm", { zone: TZ });
    const end = DateTime.fromFormat(`${td} ${tt}`, "yyyy-MM-dd HH:mm", { zone: TZ });
    if (!start.isValid || !end.isValid || end <= start) throw new Error("End date/time must be after start date/time");
    const shifts = await pool.query(
      `SELECT id FROM pos_shifts WHERE opened_at < $2::timestamptz AND COALESCE(closed_at,NOW()) > $1::timestamptz ORDER BY opened_at`,
      [start.toUTC().toISO(), end.toUTC().toISO()],
    );
    return { ...makeWindow("exact_datetime", start, end, shifts.rows.map((x) => String(x.id))), fromDate: fd, toDate: td };
  }

  const mode = s(q.mode || "last_completed_shift");
  if (mode === "current_shift") {
    const result = await pool.query(`SELECT id,opened_at,COALESCE(closed_at,NOW()) ended_at FROM pos_shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1`);
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return makeWindow(mode, bkk(row.opened_at), bkk(row.ended_at), [String(row.id)]);
  }

  if (mode === "custom" || q.shiftStartDate || q.from) {
    const from = validDate(q.shiftStartDate || q.from);
    const to = validDate(q.shiftEndDate || q.to) || from;
    if (!from || !to) throw new Error("Valid shift date required");
    const result = await pool.query(
      `SELECT id,opened_at,COALESCE(closed_at,NOW()) ended_at FROM pos_shifts WHERE (opened_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date ORDER BY opened_at`,
      [from, to],
    );
    if (!result.rowCount) return null;
    const first = result.rows[0];
    const last = result.rows[result.rows.length - 1];
    return makeWindow(from === to ? "shift_date" : "custom_shift_range", bkk(first.opened_at), bkk(last.ended_at), result.rows.map((x) => String(x.id)));
  }

  const limit = Math.min(Math.max(parseInt(s(q.limit), 10) || 1, 1), 90);
  const result = await pool.query(`SELECT id,opened_at,closed_at FROM pos_shifts WHERE status='closed' ORDER BY opened_at DESC LIMIT $1`, [limit]);
  if (!result.rowCount) return null;
  const rows = [...result.rows].reverse();
  return makeWindow(limit > 1 ? `last_${limit}_shifts` : "last_completed_shift", bkk(rows[0].opened_at), bkk(rows[rows.length - 1].closed_at), rows.map((x) => String(x.id)));
}

router.get("/shift-review", async (req, res) => {
  try {
    const w = await resolveWindow(req.query as Record<string, unknown>);
    if (!w || w.shiftIds.length !== 1) return res.status(400).json({ ok: false, source: "sbb_pos_core", error: "Select one POS shift for Shift Review" });
    const shiftResult = await pool.query(`SELECT id,staff_name,opened_at,closed_at,starting_float,closing_cash,cash_banked,status,(opened_at AT TIME ZONE 'Asia/Bangkok')::date::text shift_date FROM pos_shifts WHERE id=$1`, [w.shiftIds[0]]);
    const shift = shiftResult.rows[0];
    if (!shift) return res.status(404).json({ ok: false, source: "sbb_pos_core", error: "POS shift not found" });
    const posResult = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN order_mode='direct' AND payment_method='cash' THEN total ELSE 0 END),0) cash_sales,
              COALESCE(SUM(CASE WHEN order_mode='direct' AND payment_method='manual_qr_transfer' THEN total ELSE 0 END),0) qr_sales,
              COALESCE(SUM(CASE WHEN order_mode='grab' OR payment_method='grab' THEN total ELSE 0 END),0) grab_sales,
              COALESCE(SUM(CASE WHEN NOT((order_mode='direct' AND payment_method IN('cash','manual_qr_transfer')) OR order_mode='grab' OR payment_method='grab') THEN total ELSE 0 END),0) other_sales,
              COUNT(*)::int receipt_count,COALESCE(SUM(total),0) total_sales
       FROM ordering_orders
       WHERE payment_status='paid' AND status<>'cancelled' AND created_at >= $1 AND created_at < COALESCE($2,NOW())`,
      [shift.opened_at, shift.closed_at],
    );
    const dailyResult = await pool.query(`SELECT id,"shiftDate"::text shift_date,"completedBy" completed_by,"startingCash" starting_cash,"cashSales" cash_sales,"qrSales" qr_sales,"grabSales" grab_sales,"aroiSales" other_sales,"totalSales" total_sales,"endingCash" ending_cash,"cashBanked" cash_banked,"qrTransfer" qr_transfer FROM daily_sales_v2 WHERE COALESCE(shift_date,"shiftDate"::date)=$1::date ORDER BY "createdAt" DESC LIMIT 1`, [shift.shift_date]);
    const d = dailyResult.rows[0] || null;
    const p = posResult.rows[0] || {};
    const row = (key: string, label: string, pv: number, dv: unknown) => {
      const sv = d ? n(dv) : null;
      const delta = sv == null ? null : Number((pv - sv).toFixed(2));
      return { key, label, pos: Number(pv.toFixed(2)), dailySales: sv, delta, status: sv == null ? "missing" : Math.abs(delta) <= 0.01 ? "match" : "flag" };
    };
    const rows = [
      row("startingCash", "Starting Cash (฿)", n(shift.starting_float), d?.starting_cash),
      row("cashSales", "Cash Sales (฿)", n(p.cash_sales), d?.cash_sales),
      row("qrSales", "QR / Scan Sales (฿)", n(p.qr_sales), d?.qr_sales),
      row("grabSales", "Grab Sales (฿)", n(p.grab_sales), d?.grab_sales),
      row("otherSales", "Other Sales (฿)", n(p.other_sales), d?.other_sales),
    ];
    return res.json({ ok: true, source: "sbb_pos_core", shift: { ...shift, receiptCount: n(p.receipt_count), totalSales: n(p.total_sales) }, dailySales: d, rows, allMatched: rows.every((x) => x.status === "match"), filters: { ...w, timezone: TZ } });
  } catch (e: any) {
    console.error("[receiptAnalytics.shiftReview]", e);
    return res.status(500).json({ ok: false, source: "sbb_pos_core", error: e.message });
  }
});

router.get("/costing-coverage", async (_req, res) => {
  try {
    const [items, modifiers, recipes] = await Promise.all([
      pool.query(`
        SELECT i.id,i.name_en name,COALESCE(i.source_sku,'') sku,c.name_en category,
               COALESCE(cfg.costing_mode,'unconfigured') costing_mode,cfg.recipe_id,cfg.direct_unit_cost,
               r.name recipe_name,
               NULLIF(to_jsonb(r)->>'cost_per_serving','')::numeric recipe_cost,
               COALESCE(to_jsonb(r)->'ingredients','[]'::jsonb) recipe_ingredients,
               suggestion.id suggested_recipe_id,suggestion.name suggested_recipe_name,
               CASE
                 WHEN cfg.costing_mode='direct' AND cfg.direct_unit_cost IS NOT NULL THEN 'direct'
                 WHEN cfg.costing_mode='recipe' AND r.id IS NULL THEN 'missing'
                 WHEN cfg.costing_mode='recipe' AND (NULLIF(to_jsonb(r)->>'cost_per_serving','') IS NULL OR jsonb_array_length(COALESCE(to_jsonb(r)->'ingredients','[]'::jsonb))=0) THEN 'partial'
                 WHEN cfg.costing_mode='recipe' THEN 'complete'
                 ELSE 'missing'
               END costing_status
        FROM ordering_menu_items i
        JOIN ordering_menu_categories c ON c.id=i.category_id
        LEFT JOIN pos_item_costing_config cfg ON cfg.menu_item_id=i.id
        LEFT JOIN recipes r ON r.id=cfg.recipe_id
        LEFT JOIN LATERAL (SELECT id,name FROM recipes rr WHERE lower(trim(rr.name))=lower(trim(i.name_en)) ORDER BY id LIMIT 1) suggestion ON TRUE
        WHERE i.is_active AND i.pos_enabled AND lower(c.name_en)<>lower('Phase 1 Test Menu')
        ORDER BY c.sort_order,i.sort_order,i.name_en`),
      pool.query(`
        SELECT m.id,m.name_en name,g.name_en group_name,
               COALESCE(cfg.costing_mode,'unconfigured') costing_mode,cfg.recipe_id,cfg.direct_unit_cost,
               r.name recipe_name,NULLIF(to_jsonb(r)->>'cost_per_serving','')::numeric recipe_cost,
               CASE
                 WHEN cfg.costing_mode='direct' AND cfg.direct_unit_cost IS NOT NULL THEN 'direct'
                 WHEN cfg.costing_mode='recipe' AND r.id IS NULL THEN 'missing'
                 WHEN cfg.costing_mode='recipe' AND (NULLIF(to_jsonb(r)->>'cost_per_serving','') IS NULL OR jsonb_array_length(COALESCE(to_jsonb(r)->'ingredients','[]'::jsonb))=0) THEN 'partial'
                 WHEN cfg.costing_mode='recipe' THEN 'complete'
                 ELSE 'missing'
               END costing_status
        FROM ordering_item_modifiers m
        JOIN ordering_modifier_groups g ON g.id=m.modifier_group_id
        LEFT JOIN pos_modifier_costing_config cfg ON cfg.item_modifier_id=m.id
        LEFT JOIN recipes r ON r.id=cfg.recipe_id
        WHERE m.is_active AND g.is_active
        ORDER BY g.sort_order,m.sort_order,m.name_en`),
      pool.query(`SELECT id,name,NULLIF(to_jsonb(r)->>'cost_per_serving','')::numeric cost_per_serving,COALESCE(to_jsonb(r)->'ingredients','[]'::jsonb) ingredients,COALESCE((to_jsonb(r)->>'is_active')::boolean,true) is_active FROM recipes r ORDER BY name`),
    ]);
    const itemRows = items.rows.map((x) => ({ ...x, direct_unit_cost: x.direct_unit_cost == null ? null : n(x.direct_unit_cost), recipe_cost: x.recipe_cost == null ? null : n(x.recipe_cost) }));
    const modifierRows = modifiers.rows.map((x) => ({ ...x, direct_unit_cost: x.direct_unit_cost == null ? null : n(x.direct_unit_cost), recipe_cost: x.recipe_cost == null ? null : n(x.recipe_cost) }));
    const completeItems = itemRows.filter((x) => x.costing_status === "complete" || x.costing_status === "direct").length;
    const completeModifiers = modifierRows.filter((x) => x.costing_status === "complete" || x.costing_status === "direct").length;
    return res.json({
      ok: true,
      source: "sbb_pos_costing_phase2",
      items: itemRows,
      modifiers: modifierRows,
      recipes: recipes.rows.map((x) => ({ ...x, cost_per_serving: x.cost_per_serving == null ? null : n(x.cost_per_serving) })),
      summary: {
        itemsTotal: itemRows.length,
        itemsCosted: completeItems,
        itemsCoveragePct: itemRows.length ? Number((completeItems / itemRows.length * 100).toFixed(1)) : 100,
        modifiersTotal: modifierRows.length,
        modifiersCosted: completeModifiers,
        modifiersCoveragePct: modifierRows.length ? Number((completeModifiers / modifierRows.length * 100).toFixed(1)) : 100,
      },
      rules: { draftRecipeAllowedWhenCostComplete: true, missingCostNeverAssumedZero: true, changesApplyToFutureSalesOnly: true },
    });
  } catch (e: any) {
    console.error("[receiptAnalytics.costingCoverage]", e);
    return res.status(500).json({ ok: false, source: "sbb_pos_costing_phase2", error: e.message });
  }
});

router.put("/costing-coverage/items/:id", async (req, res) => {
  try {
    const mode = s(req.body?.costingMode || req.body?.costing_mode);
    if (!["recipe","direct","unconfigured"].includes(mode)) return res.status(400).json({ ok: false, error: "costingMode must be recipe, direct or unconfigured" });
    const recipeId = mode === "recipe" ? Number(req.body?.recipeId ?? req.body?.recipe_id) : null;
    const directCost = mode === "direct" ? Number(req.body?.directUnitCost ?? req.body?.direct_unit_cost) : null;
    if (mode === "recipe" && !Number.isInteger(recipeId)) return res.status(400).json({ ok: false, error: "recipeId is required for recipe costing" });
    if (mode === "direct" && (!Number.isFinite(directCost) || directCost < 0)) return res.status(400).json({ ok: false, error: "directUnitCost must be zero or greater" });
    if (mode === "recipe") {
      const recipe = await pool.query(`SELECT id FROM recipes WHERE id=$1`, [recipeId]);
      if (!recipe.rowCount) return res.status(400).json({ ok: false, error: "Recipe not found" });
    }
    const result = await pool.query(`INSERT INTO pos_item_costing_config(menu_item_id,costing_mode,recipe_id,direct_unit_cost,notes,updated_at)
      VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(menu_item_id) DO UPDATE SET costing_mode=EXCLUDED.costing_mode,recipe_id=EXCLUDED.recipe_id,direct_unit_cost=EXCLUDED.direct_unit_cost,notes=EXCLUDED.notes,updated_at=NOW() RETURNING *`,
      [req.params.id,mode,recipeId,directCost,req.body?.notes || null]);
    return res.json({ ok: true, data: result.rows[0], appliesToFutureSalesOnly: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.put("/costing-coverage/modifiers/:id", async (req, res) => {
  try {
    const mode = s(req.body?.costingMode || req.body?.costing_mode);
    if (!["recipe","direct","unconfigured"].includes(mode)) return res.status(400).json({ ok: false, error: "costingMode must be recipe, direct or unconfigured" });
    const recipeId = mode === "recipe" ? Number(req.body?.recipeId ?? req.body?.recipe_id) : null;
    const directCost = mode === "direct" ? Number(req.body?.directUnitCost ?? req.body?.direct_unit_cost) : null;
    if (mode === "recipe" && !Number.isInteger(recipeId)) return res.status(400).json({ ok: false, error: "recipeId is required for recipe costing" });
    if (mode === "direct" && (!Number.isFinite(directCost) || directCost < 0)) return res.status(400).json({ ok: false, error: "directUnitCost must be zero or greater" });
    if (mode === "recipe") {
      const recipe = await pool.query(`SELECT id FROM recipes WHERE id=$1`, [recipeId]);
      if (!recipe.rowCount) return res.status(400).json({ ok: false, error: "Recipe not found" });
    }
    const result = await pool.query(`INSERT INTO pos_modifier_costing_config(item_modifier_id,costing_mode,recipe_id,direct_unit_cost,notes,updated_at)
      VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(item_modifier_id) DO UPDATE SET costing_mode=EXCLUDED.costing_mode,recipe_id=EXCLUDED.recipe_id,direct_unit_cost=EXCLUDED.direct_unit_cost,notes=EXCLUDED.notes,updated_at=NOW() RETURNING *`,
      [req.params.id,mode,recipeId,directCost,req.body?.notes || null]);
    return res.json({ ok: true, data: result.rows[0], appliesToFutureSalesOnly: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const w = await resolveWindow(req.query as Record<string, unknown>);
    if (!w) return res.json({ ok: false, source: "sbb_pos_core", blockers: [{ code: "NO_POS_SHIFTS", message: "No POS shifts found" }], summary: { grossSales: 0, receiptCount: 0, averageReceiptValue: 0, lineItemCount: 0, modifierCount: 0 }, itemSales: [], componentSales: [], includedComponents: [], receipts: [], filters: { from: "", to: "", mode: "", timezone: TZ } });

    const requestedStart = DateTime.fromISO(w.startUtc);
    const requestedEnd = DateTime.fromISO(w.endUtc);
    const fullHistoricalArchive = requestedStart <= HISTORICAL_START && requestedEnd >= HISTORICAL_END;
    const partialHistoricalOverlap = requestedStart < HISTORICAL_END && requestedEnd > HISTORICAL_START && !fullHistoricalArchive;
    const liveStart = requestedStart > LIVE_CUTOVER ? requestedStart : LIVE_CUTOVER;
    const hasLiveWindow = requestedEnd > LIVE_CUTOVER && requestedEnd > liveStart;
    const liveStartUtc = liveStart.toUTC().toISO() || w.startUtc;

    const empty = { rows: [] as any[] };
    const liveBase = `SELECT o.* FROM ordering_orders o WHERE o.channel IN('pos_direct','grab') AND o.payment_status='paid' AND o.status<>'cancelled' AND o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz`;
    const liveParams = [liveStartUtc, w.endUtc];

    const [sumR, itemR, modR, compR, catR, hourR, payR, recR, historicalR] = await Promise.all([
      hasLiveWindow ? pool.query(`WITH receipts AS(${liveBase}) SELECT COUNT(*)::int receipt_count,COALESCE(SUM(total),0) gross_sales,COALESCE(AVG(total),0) avg_receipt FROM receipts`, liveParams) : Promise.resolve(empty),
      hasLiveWindow ? pool.query(`WITH receipts AS(${liveBase}),mods AS(SELECT order_item_id,COALESCE(SUM(price_delta*quantity),0) mod_total FROM ordering_order_item_modifiers GROUP BY order_item_id),costs AS(
        SELECT i.id,
          CASE WHEN s.costing_status IN('complete','direct')
             AND NOT EXISTS(SELECT 1 FROM ordering_order_item_modifiers m LEFT JOIN ordering_modifier_cost_snapshots ms ON ms.order_item_modifier_id=m.id WHERE m.order_item_id=i.id AND m.item_modifier_id IS NOT NULL AND COALESCE(ms.costing_status,'missing') NOT IN('complete','direct'))
             AND NOT EXISTS(SELECT 1 FROM ordering_order_items child LEFT JOIN ordering_order_item_cost_snapshots cs ON cs.order_item_id=child.id WHERE child.parent_order_item_id=i.id AND COALESCE(cs.costing_status,'missing') NOT IN('complete','direct'))
            THEN TRUE ELSE FALSE END costing_complete,
          COALESCE(s.total_cost,0)
          +COALESCE((SELECT SUM(ms.total_cost) FROM ordering_order_item_modifiers m JOIN ordering_modifier_cost_snapshots ms ON ms.order_item_modifier_id=m.id WHERE m.order_item_id=i.id AND m.item_modifier_id IS NOT NULL),0)
          +COALESCE((SELECT SUM(cs.total_cost) FROM ordering_order_items child JOIN ordering_order_item_cost_snapshots cs ON cs.order_item_id=child.id WHERE child.parent_order_item_id=i.id),0) known_cost
        FROM ordering_order_items i LEFT JOIN ordering_order_item_cost_snapshots s ON s.order_item_id=i.id
      ),sold AS(
        SELECT i.item_name_en name,COALESCE(i.source_sku,'') sku,${categoryCase} category,i.quantity,i.line_total,COALESCE(mods.mod_total,0) mod_total,
               COALESCE(r.subtotal,r.total,0) receipt_subtotal,COALESCE(r.total,0) receipt_total,cost_calc.costing_complete,cost_calc.known_cost
        FROM ordering_order_items i JOIN receipts r ON r.id=i.order_id LEFT JOIN mods ON mods.order_item_id=i.id LEFT JOIN costs cost_calc ON cost_calc.id=i.id
        LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id LEFT JOIN ordering_menu_categories ccat ON ccat.id=mi.category_id
        LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id
        WHERE COALESCE(i.is_set_component,false)=false
      ) SELECT name,sku,category,SUM(quantity)::int qty_sold,ROUND(SUM(line_total),2) gross_sales,
        ROUND(SUM(CASE WHEN receipt_subtotal>0 THEN line_total*GREATEST(receipt_subtotal-receipt_total,0)/receipt_subtotal ELSE 0 END),2) discounts,
        ROUND(SUM(line_total-CASE WHEN receipt_subtotal>0 THEN line_total*GREATEST(receipt_subtotal-receipt_total,0)/receipt_subtotal ELSE 0 END),2) net_sales,
        ROUND(SUM(line_total)/NULLIF(SUM(quantity),0),2) avg_price,ROUND(SUM(line_total-mod_total),2) base_revenue,
        BOOL_AND(COALESCE(costing_complete,false)) costing_complete,
        SUM(CASE WHEN costing_complete THEN quantity ELSE 0 END)::int costed_qty,
        ROUND(SUM(CASE WHEN costing_complete THEN known_cost ELSE 0 END),2) known_cogs
        FROM sold GROUP BY name,sku,category ORDER BY qty_sold DESC,net_sales DESC`, liveParams) : Promise.resolve(empty),
      hasLiveWindow ? pool.query(`WITH receipts AS(${liveBase}) SELECT ${modifierTypeCase} type,COALESCE(m.modifier_group_name_en,'Modifier') group_name,m.modifier_name_en name,SUM(m.quantity)::int qty_sold,ROUND(SUM(m.price_delta*m.quantity),2) revenue,
        BOOL_AND(CASE WHEN m.item_modifier_id IS NULL THEN TRUE ELSE COALESCE(ms.costing_status,'missing') IN('complete','direct') END) costing_complete,
        ROUND(SUM(CASE WHEN m.item_modifier_id IS NULL THEN 0 WHEN ms.costing_status IN('complete','direct') THEN COALESCE(ms.total_cost,0) ELSE 0 END),2) known_cogs
        FROM ordering_order_item_modifiers m JOIN ordering_order_items i ON i.id=m.order_item_id JOIN receipts r ON r.id=i.order_id LEFT JOIN ordering_modifier_cost_snapshots ms ON ms.order_item_modifier_id=m.id
        GROUP BY ${modifierTypeCase},group_name,m.modifier_name_en ORDER BY qty_sold DESC,name`, liveParams) : Promise.resolve(empty),
      hasLiveWindow ? pool.query(`WITH receipts AS(${liveBase}) SELECT i.item_name_en name,${categoryCase} category,SUM(i.quantity)::int qty_sold,
        BOOL_AND(COALESCE(cs.costing_status,'missing') IN('complete','direct')) costing_complete,ROUND(SUM(CASE WHEN cs.costing_status IN('complete','direct') THEN COALESCE(cs.total_cost,0) ELSE 0 END),2) known_cogs
        FROM ordering_order_items i JOIN receipts r ON r.id=i.order_id LEFT JOIN ordering_order_item_cost_snapshots cs ON cs.order_item_id=i.id LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id WHERE COALESCE(i.is_set_component,false)=true GROUP BY i.item_name_en,${categoryCase} ORDER BY qty_sold DESC`, liveParams) : Promise.resolve(empty),
      hasLiveWindow ? pool.query(`WITH receipts AS(${liveBase}) SELECT ${categoryCase} category,SUM(i.quantity)::int qty_sold,ROUND(SUM(i.line_total),2) revenue FROM ordering_order_items i JOIN receipts r ON r.id=i.order_id LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id WHERE COALESCE(i.is_set_component,false)=false GROUP BY ${categoryCase}`, liveParams) : Promise.resolve(empty),
      hasLiveWindow ? pool.query(`WITH receipts AS(${liveBase}) SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bangkok')::int bkk_hour,COUNT(*)::int receipt_count,ROUND(SUM(total),2) gross_sales FROM receipts GROUP BY bkk_hour ORDER BY bkk_hour`, liveParams) : Promise.resolve(empty),
      hasLiveWindow ? pool.query(`WITH receipts AS(${liveBase}) SELECT payment_method,order_mode,COUNT(*)::int receipt_count,ROUND(SUM(total),2) total FROM receipts GROUP BY payment_method,order_mode ORDER BY total DESC`, liveParams) : Promise.resolve(empty),
      hasLiveWindow ? pool.query(`WITH receipts AS(${liveBase}) SELECT r.id,r.order_number,LEFT(r.ticket_number,3) receipt_number,r.order_mode,r.channel,r.payment_method,r.subtotal,GREATEST(COALESCE(r.subtotal,r.total,0)-COALESCE(r.total,0),0) discount_amount,r.total,r.created_at,(r.created_at AT TIME ZONE 'Asia/Bangkok')::timestamp bkk_created_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.item_name_en,'quantity',i.quantity,'unitPrice',i.unit_price,'lineTotal',i.line_total,'isSetComponent',COALESCE(i.is_set_component,false),'costingStatus',cs.costing_status,'costSnapshotOrigin',cs.snapshot_origin,'unitCost',cs.unit_cost,'totalCost',cs.total_cost,'modifiers',COALESCE((SELECT jsonb_agg(jsonb_build_object('group',m.modifier_group_name_en,'name',m.modifier_name_en,'priceDelta',m.price_delta,'quantity',m.quantity,'type',${modifierTypeCase},'costingStatus',ms.costing_status,'unitCost',ms.unit_cost,'totalCost',ms.total_cost)) FROM ordering_order_item_modifiers m LEFT JOIN ordering_modifier_cost_snapshots ms ON ms.order_item_modifier_id=m.id WHERE m.order_item_id=i.id),'[]'::jsonb)) ORDER BY i.sort_order) FROM ordering_order_items i LEFT JOIN ordering_order_item_cost_snapshots cs ON cs.order_item_id=i.id WHERE i.order_id=r.id),'[]'::jsonb) items FROM receipts r ORDER BY r.created_at DESC LIMIT 1000`, liveParams) : Promise.resolve(empty),
      fullHistoricalArchive ? pool.query(`SELECT item_name,sku,category,items_sold,gross_sales,items_refunded,refunds,discounts,net_sales,taxes,source_file_sha256 FROM historical_item_sales WHERE source='loyverse_csv' AND source_file_sha256=$1 ORDER BY items_sold DESC,net_sales DESC`, [HISTORICAL_SHA]) : Promise.resolve(empty),
    ]);

    const sr = sumR.rows[0] || {};
    const liveItems = itemR.rows.map((x) => {
      const complete = x.costing_complete === true;
      const knownCogs = n(x.known_cogs);
      const netSales = n(x.net_sales);
      return {
        source: "SBB POS",
        name: x.name,
        sku: x.sku,
        category: x.category,
        qtySold: n(x.qty_sold),
        grossSales: n(x.gross_sales),
        itemsRefunded: 0,
        refunds: 0,
        discounts: n(x.discounts),
        netSales,
        avgPrice: n(x.avg_price),
        baseRevenue: n(x.base_revenue),
        costingStatus: complete ? "Complete" : n(x.costed_qty) > 0 ? "Partial" : "Missing",
        costedQty: n(x.costed_qty),
        costingCoveragePct: n(x.qty_sold) ? Number((n(x.costed_qty) / n(x.qty_sold) * 100).toFixed(1)) : 100,
        costOfGoods: complete ? knownCogs : null,
        grossProfit: complete ? Number((netSales - knownCogs).toFixed(2)) : null,
        marginPct: complete && netSales > 0 ? Number(((netSales - knownCogs) / netSales * 100).toFixed(2)) : null,
        taxes: 0,
      };
    });
    const historicalItems = historicalR.rows.map((x) => ({
      source: "Loyverse Historical",
      name: x.item_name,
      sku: x.sku,
      category: x.category,
      qtySold: n(x.items_sold),
      grossSales: n(x.gross_sales),
      itemsRefunded: n(x.items_refunded),
      refunds: n(x.refunds),
      discounts: n(x.discounts),
      netSales: n(x.net_sales),
      avgPrice: n(x.items_sold) ? Number((n(x.gross_sales) / n(x.items_sold)).toFixed(2)) : 0,
      baseRevenue: n(x.gross_sales),
      costingStatus: "Unavailable",
      costedQty: 0,
      costingCoveragePct: 0,
      costOfGoods: null,
      grossProfit: null,
      marginPct: null,
      taxes: n(x.taxes),
    }));
    const items = [...historicalItems, ...liveItems];
    const mods = modR.rows;
    const cats = catR.rows.map((x) => ({ category: x.category, qtySold: n(x.qty_sold), revenue: n(x.revenue) }));
    const liveItemQty = liveItems.reduce((a, x) => a + x.qtySold, 0);
    const historicalItemQty = historicalItems.reduce((a, x) => a + x.qtySold, 0);
    const liveCostedQty = liveItems.reduce((a, x) => a + x.costedQty, 0);
    const modQty = mods.reduce((a, x) => a + n(x.qty_sold), 0);
    const historicalNet = historicalItems.reduce((a, x) => a + x.netSales, 0);
    const liveCogsComplete = liveItems.length > 0 && liveItems.every((x) => x.costingStatus === "Complete");
    const liveCogs = liveCogsComplete ? liveItems.reduce((a, x) => a + n(x.costOfGoods), 0) : null;
    const liveNet = liveItems.reduce((a, x) => a + x.netSales, 0);
    const blockers = partialHistoricalOverlap ? [{ code: "HISTORICAL_AGGREGATE_PARTIAL_RANGE", message: "The Loyverse archive is a single aggregate for 1 Jan 17:00 through 8 Aug 03:00 and cannot be truthfully split into smaller historical date ranges. Select the full historical period to include it." }] : [];

    return res.json({
      ok: true,
      source: fullHistoricalArchive && hasLiveWindow ? "unified_item_sales" : fullHistoricalArchive ? "historical_loyverse_archive" : "sbb_pos_core",
      schemaVersion: "item-sales-v2.0",
      summary: {
        grossSales: n(sr.gross_sales) + historicalNet,
        receiptCount: n(sr.receipt_count),
        averageReceiptValue: n(sr.avg_receipt),
        lineItemCount: liveItemQty + historicalItemQty,
        modifierCount: modQty,
        historicalUnits: historicalItemQty,
        liveUnits: liveItemQty,
        liveCostedUnits: liveCostedQty,
        liveCostingCoveragePct: liveItemQty ? Number((liveCostedQty / liveItemQty * 100).toFixed(1)) : 100,
        liveCogs,
        liveGrossProfit: liveCogs == null ? null : Number((liveNet - liveCogs).toFixed(2)),
        liveMarginPct: liveCogs == null || liveNet <= 0 ? null : Number(((liveNet - liveCogs) / liveNet * 100).toFixed(2)),
      },
      itemSales: items,
      componentSales: mods.map((x) => ({ type: x.type, group: x.group_name, name: x.name, qtySold: n(x.qty_sold), revenue: n(x.revenue), source: "SBB POS", costingStatus: x.costing_complete ? "Complete" : "Missing", costOfGoods: x.costing_complete ? n(x.known_cogs) : null })),
      includedComponents: compR.rows.map((x) => ({ name: x.name, category: x.category, qtySold: n(x.qty_sold), source: "SBB POS", costingStatus: x.costing_complete ? "Complete" : "Missing", costOfGoods: x.costing_complete ? n(x.known_cogs) : null })),
      categoryMix: cats,
      hourlySales: hourR.rows.map((x) => ({ hour: n(x.bkk_hour), label: `${String(n(x.bkk_hour)).padStart(2, "0")}:00`, receiptCount: n(x.receipt_count), grossSales: n(x.gross_sales) })),
      paymentMix: payR.rows.map((x) => ({ paymentMethod: x.payment_method, orderMode: x.order_mode, receiptCount: n(x.receipt_count), total: n(x.total) })),
      receipts: recR.rows.map((x) => ({ ...x, total: n(x.total), subtotal: n(x.subtotal), discount_amount: n(x.discount_amount) })),
      blockers,
      reconciliation: {
        liveReceiptLinesMatch: liveItemQty === recR.rows.reduce((total, receipt) => total + (receipt.items || []).filter((item: any) => !item.isSetComponent).reduce((sum: number, item: any) => sum + n(item.quantity), 0), 0),
        historicalArchiveVerified: !fullHistoricalArchive || (historicalItems.length === 42 && historicalItemQty === 19377 && historicalNet === 3526909),
      },
      costing: {
        historicalCostingAvailable: false,
        historicalReason: "Loyverse ingredient costs were not maintained reliably; historical COGS, gross profit and margin are intentionally unavailable.",
        liveCostingBasis: "immutable sale-time snapshot",
        draftRecipeAllowedWhenCostComplete: true,
        missingCostNeverAssumedZero: true,
      },
      historicalArchive: {
        available: true,
        included: fullHistoricalArchive,
        aggregateOnly: true,
        periodStart: HISTORICAL_START.setZone(TZ).toISO(),
        periodEnd: HISTORICAL_END.setZone(TZ).toISO(),
        sourceFileSha256: HISTORICAL_SHA,
        expectedRows: 42,
        expectedItemsSold: 19377,
        expectedNetSales: 3526909,
      },
      cutover: {
        liveSource: "SBB POS",
        liveFrom: LIVE_CUTOVER.setZone(TZ).toISO(),
        historicalSource: "Loyverse CSV archive",
        liveLoyverseIntegration: false,
      },
      filters: { from: w.fromDate, to: w.toDate, mode: w.mode, timezone: TZ, windowStart: w.windowStart, windowEnd: w.windowEnd },
    });
  } catch (e: any) {
    console.error("[receiptAnalytics.itemSales]", e);
    return res.status(500).json({ ok: false, source: "sbb_pos_core", error: e.message });
  }
});

export default router;

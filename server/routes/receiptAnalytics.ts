import { Router } from "express";
import { DateTime } from "luxon";
import { pool } from "../db";

const router = Router();
const TZ = "Asia/Bangkok";
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

function scope(w: Window) {
  return { sql: `o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz`, params: [w.startUtc, w.endUtc] };
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

router.get("/", async (req, res) => {
  try {
    const w = await resolveWindow(req.query as Record<string, unknown>);
    if (!w) return res.json({ ok: false, source: "sbb_pos_core", blockers: [{ code: "NO_POS_SHIFTS", message: "No POS shifts found" }], summary: { grossSales: 0, receiptCount: 0, averageReceiptValue: 0, lineItemCount: 0, modifierCount: 0, burgersSold: 0, friesSold: 0, drinksSold: 0, chickenSold: 0 }, topProducts: [], itemSales: [], topModifiers: [], componentSales: [], includedComponents: [], categoryMix: [], dailyTrend: [], hourlySales: [], paymentMix: [], receipts: [], filters: { from: "", to: "", mode: "", timezone: TZ } });

    const sc = scope(w);
    const base = `SELECT o.* FROM ordering_orders o WHERE o.channel IN('pos_direct','grab') AND o.payment_status='paid' AND o.status<>'cancelled' AND ${sc.sql}`;
    const params = sc.params;

    const [sumR, itemR, modR, compR, catR, hourR, payR, recR] = await Promise.all([
      pool.query(`WITH receipts AS(${base}) SELECT COUNT(*)::int receipt_count,COALESCE(SUM(total),0) gross_sales,COALESCE(AVG(total),0) avg_receipt FROM receipts`, params),
      pool.query(`WITH receipts AS(${base}),mods AS(SELECT order_item_id,COALESCE(SUM(price_delta*quantity),0) mod_total FROM ordering_order_item_modifiers GROUP BY order_item_id),sold AS(SELECT i.item_name_en name,COALESCE(i.source_sku,'') sku,${categoryCase} category,i.quantity,i.line_total,COALESCE(mods.mod_total,0) mod_total,COALESCE(r.subtotal,r.total,0) receipt_subtotal,COALESCE(r.total,0) receipt_total FROM ordering_order_items i JOIN receipts r ON r.id=i.order_id LEFT JOIN mods ON mods.order_item_id=i.id LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id WHERE COALESCE(i.is_set_component,false)=false) SELECT name,sku,category,SUM(quantity)::int qty_sold,ROUND(SUM(line_total),2) gross_sales,ROUND(SUM(CASE WHEN receipt_subtotal>0 THEN line_total*GREATEST(receipt_subtotal-receipt_total,0)/receipt_subtotal ELSE 0 END),2) discounts,ROUND(SUM(line_total-CASE WHEN receipt_subtotal>0 THEN line_total*GREATEST(receipt_subtotal-receipt_total,0)/receipt_subtotal ELSE 0 END),2) net_sales,ROUND(SUM(line_total)/NULLIF(SUM(quantity),0),2) avg_price,ROUND(SUM(line_total-mod_total),2) base_revenue FROM sold GROUP BY name,sku,category ORDER BY qty_sold DESC,net_sales DESC`, params),
      pool.query(`WITH receipts AS(${base}) SELECT ${modifierTypeCase} type,COALESCE(m.modifier_group_name_en,'Modifier') group_name,m.modifier_name_en name,SUM(m.quantity)::int qty_sold,ROUND(SUM(m.price_delta*m.quantity),2) revenue FROM ordering_order_item_modifiers m JOIN ordering_order_items i ON i.id=m.order_item_id JOIN receipts r ON r.id=i.order_id GROUP BY ${modifierTypeCase},group_name,m.modifier_name_en ORDER BY qty_sold DESC,name`, params),
      pool.query(`WITH receipts AS(${base}) SELECT i.item_name_en name,${categoryCase} category,SUM(i.quantity)::int qty_sold FROM ordering_order_items i JOIN receipts r ON r.id=i.order_id LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id WHERE COALESCE(i.is_set_component,false)=true GROUP BY i.item_name_en,${categoryCase} ORDER BY qty_sold DESC`, params),
      pool.query(`WITH receipts AS(${base}) SELECT ${categoryCase} category,SUM(i.quantity)::int qty_sold,ROUND(SUM(i.line_total),2) revenue FROM ordering_order_items i JOIN receipts r ON r.id=i.order_id LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id WHERE COALESCE(i.is_set_component,false)=false GROUP BY ${categoryCase}`, params),
      pool.query(`WITH receipts AS(${base}) SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Bangkok')::int bkk_hour,COUNT(*)::int receipt_count,ROUND(SUM(total),2) gross_sales FROM receipts GROUP BY bkk_hour ORDER BY bkk_hour`, params),
      pool.query(`WITH receipts AS(${base}) SELECT payment_method,order_mode,COUNT(*)::int receipt_count,ROUND(SUM(total),2) total FROM receipts GROUP BY payment_method,order_mode ORDER BY total DESC`, params),
      pool.query(`WITH receipts AS(${base}) SELECT r.id,r.order_number,LEFT(r.ticket_number,3) receipt_number,r.order_mode,r.channel,r.payment_method,r.subtotal,GREATEST(COALESCE(r.subtotal,r.total,0)-COALESCE(r.total,0),0) discount_amount,r.total,r.created_at,(r.created_at AT TIME ZONE 'Asia/Bangkok')::timestamp bkk_created_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.item_name_en,'quantity',i.quantity,'unitPrice',i.unit_price,'lineTotal',i.line_total,'isSetComponent',COALESCE(i.is_set_component,false),'modifiers',COALESCE((SELECT jsonb_agg(jsonb_build_object('group',m.modifier_group_name_en,'name',m.modifier_name_en,'priceDelta',m.price_delta,'quantity',m.quantity,'type',${modifierTypeCase})) FROM ordering_order_item_modifiers m WHERE m.order_item_id=i.id),'[]'::jsonb)) ORDER BY i.sort_order) FROM ordering_order_items i WHERE i.order_id=r.id),'[]'::jsonb) items FROM receipts r ORDER BY r.created_at DESC LIMIT 1000`, params),
    ]);

    const sr = sumR.rows[0] || {};
    const items = itemR.rows;
    const mods = modR.rows;
    const cats = catR.rows.map((x) => ({ category: x.category, qtySold: n(x.qty_sold), revenue: n(x.revenue) }));
    const itemQty = items.reduce((a, x) => a + n(x.qty_sold), 0);
    const modQty = mods.reduce((a, x) => a + n(x.qty_sold), 0);
    const catQty = (name: string) => cats.find((x) => x.category === name)?.qtySold || 0;

    return res.json({
      ok: true,
      source: "sbb_pos_core",
      schemaVersion: "item-sales-v1.1",
      summary: { grossSales: n(sr.gross_sales), receiptCount: n(sr.receipt_count), averageReceiptValue: n(sr.avg_receipt), lineItemCount: itemQty, modifierCount: modQty, burgersSold: catQty("Burgers"), friesSold: catQty("Fries"), drinksSold: catQty("Drinks"), chickenSold: catQty("Chicken") },
      topProducts: items.slice(0, 50).map((x) => ({ name: x.name, sku: x.sku, category: x.category, qtySold: n(x.qty_sold), revenue: n(x.net_sales), pctOfTotal: Number((n(x.qty_sold) / Math.max(itemQty, 1) * 100).toFixed(1)) })),
      itemSales: items.map((x) => ({ name: x.name, sku: x.sku, category: x.category, qtySold: n(x.qty_sold), grossSales: n(x.gross_sales), discounts: n(x.discounts), netSales: n(x.net_sales), avgPrice: n(x.avg_price), baseRevenue: n(x.base_revenue) })),
      topModifiers: mods.map((x) => ({ name: `${x.group_name}: ${x.name}`, qtySold: n(x.qty_sold), pctOfTotal: Number((n(x.qty_sold) / Math.max(modQty, 1) * 100).toFixed(1)) })),
      componentSales: mods.map((x) => ({ type: x.type, group: x.group_name, name: x.name, qtySold: n(x.qty_sold), revenue: n(x.revenue) })),
      includedComponents: compR.rows.map((x) => ({ name: x.name, category: x.category, qtySold: n(x.qty_sold) })),
      categoryMix: cats,
      dailyTrend: [],
      hourlySales: hourR.rows.map((x) => ({ hour: n(x.bkk_hour), label: `${String(n(x.bkk_hour)).padStart(2, "0")}:00`, receiptCount: n(x.receipt_count), grossSales: n(x.gross_sales) })),
      paymentMix: payR.rows.map((x) => ({ paymentMethod: x.payment_method, orderMode: x.order_mode, receiptCount: n(x.receipt_count), total: n(x.total) })),
      receipts: recR.rows.map((x) => ({ ...x, total: n(x.total), subtotal: n(x.subtotal), discount_amount: n(x.discount_amount) })),
      filters: { from: w.fromDate, to: w.toDate, mode: w.mode, timezone: TZ, windowStart: w.windowStart, windowEnd: w.windowEnd },
    });
  } catch (e: any) {
    console.error("[receiptAnalytics.itemSales]", e);
    return res.status(500).json({ ok: false, source: "sbb_pos_core", error: e.message });
  }
});

export default router;

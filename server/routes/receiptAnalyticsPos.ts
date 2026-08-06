import { Router } from "express";
import { DateTime } from "luxon";
import { pool } from "../db";

const router = Router();
const REPORT_TZ = "Asia/Bangkok";
const toNum = (value: unknown) => Number(value ?? 0) || 0;
const toStr = (value: unknown) => String(value ?? "");
const validDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(toStr(value)) ? toStr(value) : null;

const categoryCase = `
  CASE
    WHEN lower(COALESCE(c.name_en,'')) LIKE '%chicken%' OR lower(i.item_name_en) LIKE '%chicken%'
      OR lower(i.item_name_en) LIKE '%nugget%' OR lower(i.item_name_en) LIKE '%karaage%' THEN 'Chicken'
    WHEN lower(COALESCE(c.name_en,'')) LIKE '%fries%' OR lower(i.item_name_en) LIKE '%fries%'
      OR lower(i.item_name_en) LIKE '%cajun%' OR lower(i.item_name_en) LIKE '%sweet potato%'
      OR lower(i.item_name_en) LIKE '%dirty%' OR lower(i.item_name_en) LIKE '%loaded%' THEN 'Fries'
    WHEN lower(COALESCE(c.name_en,'')) LIKE '%drink%' OR lower(i.item_name_en) LIKE '%coke%'
      OR lower(i.item_name_en) LIKE '%water%' OR lower(i.item_name_en) LIKE '%fanta%'
      OR lower(i.item_name_en) LIKE '%soda%' OR lower(i.item_name_en) LIKE '%schweppes%'
      OR lower(i.item_name_en) LIKE '%juice%' THEN 'Drinks'
    WHEN lower(COALESCE(c.name_en,'')) LIKE '%side%' OR lower(i.item_name_en) LIKE '%coleslaw%'
      OR lower(i.item_name_en) LIKE '%onion ring%' THEN 'Sides'
    WHEN lower(COALESCE(c.name_en,'')) LIKE '%burger%' OR lower(i.item_name_en) LIKE '%burger%'
      OR lower(i.item_name_en) LIKE '%smash%' THEN 'Burgers'
    ELSE 'Other'
  END`;

type ShiftWindow = {
  mode: string;
  shiftIds: string[];
  fromDate: string;
  toDate: string;
  windowStart: string;
  windowEnd: string;
};

async function resolveShiftWindow(query: Record<string, unknown>): Promise<ShiftWindow | null> {
  const mode = toStr(query.mode || query.preset || "last_completed_shift");

  if (mode === "current_shift") {
    const result = await pool.query(`SELECT id, opened_at, COALESCE(closed_at,NOW()) AS ended_at
      FROM pos_shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1`);
    if (!result.rowCount) return null;
    const row = result.rows[0];
    const localDate = DateTime.fromJSDate(new Date(row.opened_at)).setZone(REPORT_TZ).toISODate()!;
    return { mode, shiftIds:[String(row.id)], fromDate:localDate, toDate:localDate, windowStart:new Date(row.opened_at).toISOString(), windowEnd:new Date(row.ended_at).toISOString() };
  }

  if (mode === "custom" || (query.shiftStartDate && query.shiftEndDate)) {
    const from = validDate(query.shiftStartDate || query.from);
    const to = validDate(query.shiftEndDate || query.to);
    if (!from || !to) throw new Error("Custom shift range requires shiftStartDate and shiftEndDate as YYYY-MM-DD.");
    const result = await pool.query(`SELECT id, opened_at, COALESCE(closed_at,NOW()) AS ended_at
      FROM pos_shifts
      WHERE (opened_at AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $1::date AND $2::date
      ORDER BY opened_at`, [from,to]);
    if (!result.rowCount) return null;
    return { mode:"custom_shift_range", shiftIds:result.rows.map(r=>String(r.id)), fromDate:from, toDate:to, windowStart:new Date(result.rows[0].opened_at).toISOString(), windowEnd:new Date(result.rows.at(-1).ended_at).toISOString() };
  }

  const limitRaw = query.limit ? Math.min(Math.max(parseInt(toStr(query.limit),10) || 1,1),90) : 1;
  const result = await pool.query(`SELECT id, opened_at, closed_at
    FROM pos_shifts WHERE status='closed' ORDER BY opened_at DESC LIMIT $1`, [limitRaw]);
  if (!result.rowCount) return null;
  const ordered = [...result.rows].reverse();
  const first = ordered[0];
  const last = ordered.at(-1)!;
  const from = DateTime.fromJSDate(new Date(first.opened_at)).setZone(REPORT_TZ).toISODate()!;
  const to = DateTime.fromJSDate(new Date(last.opened_at)).setZone(REPORT_TZ).toISODate()!;
  return { mode:limitRaw > 1 ? `last_${limitRaw}_shifts` : "last_completed_shift", shiftIds:ordered.map(r=>String(r.id)), fromDate:from, toDate:to, windowStart:new Date(first.opened_at).toISOString(), windowEnd:new Date(last.closed_at).toISOString() };
}

router.get("/", async (req,res) => {
  try {
    const window = await resolveShiftWindow(req.query as Record<string,unknown>);
    if (!window) return res.json({
      ok:false,
      source:"sbb_pos_core",
      blockers:[{code:"NO_POS_SHIFTS",message:"No POS shifts found for selected shift window"}],
      summary:{grossSales:0,receiptCount:0,averageReceiptValue:0,lineItemCount:0,modifierCount:0,burgersSold:0,friesSold:0,drinksSold:0,chickenSold:0},
      topProducts:[],topModifiers:[],categoryMix:[],dailyTrend:[],hourlySales:[],paymentMix:[],receipts:[],
      filters:{from:"",to:"",mode:toStr(req.query.mode||"last_completed_shift"),timezone:REPORT_TZ}
    });

    const shiftIds = window.shiftIds;
    const search = req.query.search ? `%${toStr(req.query.search).toLowerCase()}%` : null;
    const category = req.query.category ? toStr(req.query.category) : null;

    const receiptBase = `
      SELECT o.id,o.order_number,LEFT(o.ticket_number,3) AS receipt_number,o.order_mode,o.channel,o.payment_method,
             o.subtotal,o.discount_amount,o.total,o.created_at,s.id AS shift_id,s.staff_name,s.opened_at,s.closed_at
        FROM ordering_orders o
        JOIN LATERAL (
          SELECT ps.* FROM pos_shifts ps
           WHERE ps.id = ANY($1::uuid[])
             AND o.created_at >= ps.opened_at
             AND o.created_at <= COALESCE(ps.closed_at,NOW())
           ORDER BY ps.opened_at DESC LIMIT 1
        ) s ON true
       WHERE o.channel IN ('pos_direct','grab')
         AND o.payment_status='paid'
         AND o.status <> 'cancelled'`;

    const [summaryRes, productsRes, modifiersRes, categoryRes, trendRes, hourlyRes, paymentRes, receiptRes] = await Promise.all([
      pool.query(`WITH receipts AS (${receiptBase}), item_stats AS (
        SELECT COALESCE(SUM(i.quantity),0)::int line_item_count,
               COALESCE(SUM(CASE WHEN ${categoryCase}='Burgers' THEN i.quantity ELSE 0 END),0)::int burgers_sold,
               COALESCE(SUM(CASE WHEN ${categoryCase}='Fries' THEN i.quantity ELSE 0 END),0)::int fries_sold,
               COALESCE(SUM(CASE WHEN ${categoryCase}='Drinks' THEN i.quantity ELSE 0 END),0)::int drinks_sold,
               COALESCE(SUM(CASE WHEN ${categoryCase}='Chicken' THEN i.quantity ELSE 0 END),0)::int chicken_sold
          FROM ordering_order_items i
          JOIN receipts r ON r.id=i.order_id
          LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id
          LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id
      ), modifier_stats AS (
        SELECT COALESCE(SUM(m.quantity),0)::int modifier_count
          FROM ordering_order_item_modifiers m
          JOIN ordering_order_items i ON i.id=m.order_item_id
          JOIN receipts r ON r.id=i.order_id)
      SELECT COUNT(*)::int receipt_count,COALESCE(SUM(total),0)::numeric gross_sales,
             COALESCE(AVG(total),0)::numeric avg_receipt,
             item_stats.line_item_count,modifier_stats.modifier_count,item_stats.burgers_sold,item_stats.fries_sold,item_stats.drinks_sold,item_stats.chicken_sold
        FROM receipts CROSS JOIN item_stats CROSS JOIN modifier_stats
       GROUP BY item_stats.line_item_count,modifier_stats.modifier_count,item_stats.burgers_sold,item_stats.fries_sold,item_stats.drinks_sold,item_stats.chicken_sold`, [shiftIds]),

      pool.query(`WITH receipts AS (${receiptBase})
        SELECT i.item_name_en AS name,COALESCE(i.source_sku,'') AS sku,${categoryCase} AS category,
               SUM(i.quantity)::int qty_sold,ROUND(SUM(i.line_total),2)::numeric revenue
          FROM ordering_order_items i JOIN receipts r ON r.id=i.order_id
          LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id
          LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id
         WHERE ($2::text IS NULL OR lower(i.item_name_en) LIKE $2)
           AND ($3::text IS NULL OR ${categoryCase}=$3)
         GROUP BY i.item_name_en,i.source_sku,${categoryCase}
         ORDER BY qty_sold DESC,revenue DESC LIMIT 50`, [shiftIds,search,category]),

      pool.query(`WITH receipts AS (${receiptBase})
        SELECT CASE WHEN m.modifier_group_name_en IS NULL OR m.modifier_group_name_en='' THEN m.modifier_name_en
                    ELSE m.modifier_group_name_en || ': ' || m.modifier_name_en END AS name,
               SUM(m.quantity)::int qty_sold
          FROM ordering_order_item_modifiers m
          JOIN ordering_order_items i ON i.id=m.order_item_id
          JOIN receipts r ON r.id=i.order_id
         WHERE ($2::text IS NULL OR lower(COALESCE(m.modifier_name_en,'')) LIKE $2 OR lower(COALESCE(m.modifier_group_name_en,'')) LIKE $2)
         GROUP BY name ORDER BY qty_sold DESC LIMIT 50`, [shiftIds,search]),

      pool.query(`WITH receipts AS (${receiptBase})
        SELECT ${categoryCase} AS category,SUM(i.quantity)::int qty_sold,ROUND(SUM(i.line_total),2)::numeric revenue
          FROM ordering_order_items i JOIN receipts r ON r.id=i.order_id
          LEFT JOIN ordering_menu_items mi ON mi.id=i.menu_item_id
          LEFT JOIN ordering_menu_categories c ON c.id=mi.category_id
         GROUP BY ${categoryCase} ORDER BY qty_sold DESC`, [shiftIds]),

      pool.query(`WITH receipts AS (${receiptBase})
        SELECT (s.opened_at AT TIME ZONE 'Asia/Bangkok')::date::text biz_date,
               ROUND(SUM(r.total),2)::numeric gross_sales,COUNT(*)::int receipt_count
          FROM receipts r JOIN pos_shifts s ON s.id=r.shift_id
         GROUP BY biz_date ORDER BY biz_date`, [shiftIds]),

      pool.query(`WITH receipts AS (${receiptBase})
        SELECT EXTRACT(HOUR FROM r.created_at AT TIME ZONE 'Asia/Bangkok')::int bkk_hour,
               COUNT(*)::int receipt_count,ROUND(SUM(r.total),2)::numeric gross_sales
          FROM receipts r GROUP BY bkk_hour ORDER BY bkk_hour`, [shiftIds]),

      pool.query(`WITH receipts AS (${receiptBase})
        SELECT payment_method,order_mode,COUNT(*)::int receipt_count,ROUND(SUM(total),2)::numeric total
          FROM receipts GROUP BY payment_method,order_mode ORDER BY total DESC`, [shiftIds]),

      pool.query(`WITH receipts AS (${receiptBase})
        SELECT r.*,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'id',i.id,'name',i.item_name_en,'quantity',i.quantity,'unitPrice',i.unit_price,'lineTotal',i.line_total,
            'isSetComponent',COALESCE(i.is_set_component,false),'parentOrderItemId',i.parent_order_item_id,
            'modifiers',COALESCE((SELECT jsonb_agg(jsonb_build_object('group',m.modifier_group_name_en,'name',m.modifier_name_en,'priceDelta',m.price_delta,'quantity',m.quantity) ORDER BY m.created_at)
              FROM ordering_order_item_modifiers m WHERE m.order_item_id=i.id),'[]'::jsonb)
          ) ORDER BY i.sort_order) FROM ordering_order_items i WHERE i.order_id=r.id),'[]'::jsonb) AS items
        FROM receipts r ORDER BY r.created_at DESC LIMIT 250`, [shiftIds]),
    ]);

    const summaryRow = summaryRes.rows[0] || {};
    const receiptCount = toNum(summaryRow.receipt_count);
    const topQty = productsRes.rows.reduce((sum,row)=>sum+toNum(row.qty_sold),0) || 1;
    const modifierQty = modifiersRes.rows.reduce((sum,row)=>sum+toNum(row.qty_sold),0) || 1;

    return res.json({
      ok:true,
      source:"sbb_pos_core",
      summary:{
        grossSales:toNum(summaryRow.gross_sales),receiptCount,averageReceiptValue:toNum(summaryRow.avg_receipt),
        lineItemCount:toNum(summaryRow.line_item_count),modifierCount:toNum(summaryRow.modifier_count),
        burgersSold:toNum(summaryRow.burgers_sold),friesSold:toNum(summaryRow.fries_sold),drinksSold:toNum(summaryRow.drinks_sold),chickenSold:toNum(summaryRow.chicken_sold)
      },
      topProducts:productsRes.rows.map(row=>({name:row.name,sku:row.sku,category:row.category,qtySold:toNum(row.qty_sold),revenue:toNum(row.revenue),pctOfTotal:Number(((toNum(row.qty_sold)/topQty)*100).toFixed(1))})),
      topModifiers:modifiersRes.rows.map(row=>({name:row.name,qtySold:toNum(row.qty_sold),pctOfTotal:Number(((toNum(row.qty_sold)/modifierQty)*100).toFixed(1))})),
      categoryMix:categoryRes.rows.map(row=>({category:row.category,qtySold:toNum(row.qty_sold),revenue:toNum(row.revenue)})),
      dailyTrend:trendRes.rows.map(row=>({bizDate:row.biz_date,grossSales:toNum(row.gross_sales),receiptCount:toNum(row.receipt_count),burgers:0,fries:0,drinks:0})),
      hourlySales:hourlyRes.rows.map(row=>({hour:toNum(row.bkk_hour),label:`${String(toNum(row.bkk_hour)).padStart(2,'0')}:00`,receiptCount:toNum(row.receipt_count),grossSales:toNum(row.gross_sales)})),
      paymentMix:paymentRes.rows.map(row=>({paymentMethod:row.payment_method,orderMode:row.order_mode,receiptCount:toNum(row.receipt_count),total:toNum(row.total)})),
      receipts:receiptRes.rows,
      filters:{from:window.fromDate,to:window.toDate,mode:window.mode,timezone:REPORT_TZ,windowStart:window.windowStart,windowEnd:window.windowEnd,shiftStartDate:window.fromDate,shiftEndDate:window.toDate}
    });
  } catch(error:any) {
    console.error('[receipt-analytics-pos]',error);
    return res.status(500).json({ok:false,source:'sbb_pos_core',blockers:[{code:'POS_RECEIPT_ANALYTICS_FAILED',message:error?.message||'Could not load POS receipt analytics'}]});
  }
});

export default router;

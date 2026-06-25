// RECEIPT ANALYTICS — READ ONLY
// Source: lv_receipt, lv_line_item, lv_modifier
// Business window: 17:00–03:00 Asia/Bangkok

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { DateTime } from "luxon";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
const REPORT_TZ = "Asia/Bangkok";
const DEFAULT_SHIFT_START_TIME = "17:00";
const DEFAULT_SHIFT_END_TIME = "03:00";

const toNum = (v: unknown): number => (v == null ? 0 : Number(v));
const toStr = (v: unknown): string => (v == null ? "" : String(v));
const validDate = (v: unknown): string | null => /^\d{4}-\d{2}-\d{2}$/.test(toStr(v)) ? toStr(v) : null;
const validTime = (v: unknown, fallback: string): string => /^\d{2}:\d{2}$/.test(toStr(v)) ? toStr(v) : fallback;

function shiftEndDateFor(startDate: string, startTime: string, endTime: string): string {
  return endTime <= startTime
    ? DateTime.fromISO(startDate, { zone: REPORT_TZ }).plus({ days: 1 }).toISODate()!
    : startDate;
}

function shiftWindow(startDate: string, startTime: string, endTime: string) {
  const endDate = shiftEndDateFor(startDate, startTime, endTime);
  return {
    startDate,
    endDate,
    startLocal: `${startDate} ${startTime}:00`,
    endLocal: `${endDate} ${endTime}:00`,
  };
}

function getCurrentShiftStart(now = DateTime.now().setZone(REPORT_TZ), startTime = DEFAULT_SHIFT_START_TIME, endTime = DEFAULT_SHIFT_END_TIME): string {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startToday = now.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
  const endToday = now.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
  if (endTime <= startTime && now < endToday) return now.minus({ days: 1 }).toISODate()!;
  if (now >= startToday) return now.toISODate()!;
  return now.minus({ days: 1 }).toISODate()!;
}

function resolveWindow(query: Record<string, unknown>) {
  const shiftStartTime = validTime(query.shiftStartTime, DEFAULT_SHIFT_START_TIME);
  const shiftEndTime = validTime(query.shiftEndTime, DEFAULT_SHIFT_END_TIME);
  const mode = toStr(query.mode || query.preset || "last_completed_shift");
  const now = DateTime.now().setZone(REPORT_TZ);
  const currentShiftStart = getCurrentShiftStart(now, shiftStartTime, shiftEndTime);

  if (mode === "custom" || (query.shiftStartDate && query.shiftEndDate)) {
    const startDate = validDate(query.shiftStartDate || query.from);
    const endDate = validDate(query.shiftEndDate || query.to);
    if (!startDate || !endDate) throw new Error("Custom shift range requires shiftStartDate and shiftEndDate as YYYY-MM-DD.");
    const first = shiftWindow(startDate, shiftStartTime, shiftEndTime);
    const last = shiftWindow(endDate, shiftStartTime, shiftEndTime);
    return { mode: "custom_shift_range", fromDate: startDate, toDate: endDate, startLocal: first.startLocal, endLocal: last.endLocal, shiftStartTime, shiftEndTime };
  }

  if (mode === "current_shift") {
    const w = shiftWindow(currentShiftStart, shiftStartTime, shiftEndTime);
    return { mode: "current_shift", fromDate: w.startDate, toDate: w.startDate, startLocal: w.startLocal, endLocal: w.endLocal, shiftStartTime, shiftEndTime };
  }

  const limitRaw = query.limit ? parseInt(toStr(query.limit), 10) : null;
  if (limitRaw && limitRaw > 1) {
    const limitN = Math.min(Math.max(limitRaw, 1), 90);
    const lastCompleted = DateTime.fromISO(currentShiftStart, { zone: REPORT_TZ }).minus({ days: 1 });
    const first = lastCompleted.minus({ days: limitN - 1 }).toISODate()!;
    const last = lastCompleted.toISODate()!;
    return { mode: `last_${limitN}_shifts`, fromDate: first, toDate: last, startLocal: shiftWindow(first, shiftStartTime, shiftEndTime).startLocal, endLocal: shiftWindow(last, shiftStartTime, shiftEndTime).endLocal, shiftStartTime, shiftEndTime };
  }

  const lastCompleted = DateTime.fromISO(currentShiftStart, { zone: REPORT_TZ }).minus({ days: 1 }).toISODate()!;
  const w = shiftWindow(lastCompleted, shiftStartTime, shiftEndTime);
  return { mode: "last_completed_shift", fromDate: w.startDate, toDate: w.startDate, startLocal: w.startLocal, endLocal: w.endLocal, shiftStartTime, shiftEndTime };
}

const RECEIPT_WINDOW_FILTER = (startLocal: string, endLocal: string) => sql`
  (r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= ${startLocal}::timestamp
  AND (r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') < ${endLocal}::timestamp
`;

const RECEIPT_WINDOW_FILTER_UNALIASED = (startLocal: string, endLocal: string) => sql`
  (datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= ${startLocal}::timestamp
  AND (datetime_bkk AT TIME ZONE 'Asia/Bangkok') < ${endLocal}::timestamp
`;

// Category mapping — order matters (Chicken > Fries > Drinks > Sides > Burgers)
const CAT_CASE = sql`
  CASE
    WHEN lower(li.name) LIKE '%chicken%' OR lower(li.name) LIKE '%rooster%'
      OR lower(li.name) LIKE '%nugget%' OR lower(li.name) LIKE '%karaage%' THEN 'Chicken'
    WHEN lower(li.name) LIKE '%fries%' OR lower(li.name) LIKE '%cajun%'
      OR lower(li.name) LIKE '%sweet potato%' OR lower(li.name) LIKE '%dirty%'
      OR lower(li.name) LIKE '%loaded%' THEN 'Fries'
    WHEN lower(li.name) LIKE '%coke%' OR lower(li.name) LIKE '%sprite%'
      OR lower(li.name) LIKE '%water%' OR lower(li.name) LIKE '%fanta%'
      OR lower(li.name) LIKE '%soda%' OR lower(li.name) LIKE '%schweppes%'
      OR lower(li.name) LIKE '%lemon%' OR lower(li.name) LIKE '%juice%'
      OR lower(li.name) LIKE '%can%' THEN 'Drinks'
    WHEN lower(li.name) LIKE '%onion ring%' OR lower(li.name) LIKE '%tots%'
      OR lower(li.name) LIKE '%coleslaw%' THEN 'Sides'
    WHEN lower(li.name) LIKE '%burger%' OR lower(li.name) LIKE '%smash%'
      OR lower(li.name) LIKE '%single%' OR lower(li.name) LIKE '%double%'
      OR lower(li.name) LIKE '%triple%' OR lower(li.name) LIKE '%ultimate%' THEN 'Burgers'
    ELSE 'Other'
  END
`;

// ── main route ────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  if (!db) return res.json({ ok: false, blockers: [{ code: "DB_UNAVAILABLE", message: "Database not available." }] });

  try {
    const window = resolveWindow(req.query as Record<string, unknown>);
    const { fromDate, toDate, startLocal, endLocal, shiftStartTime, shiftEndTime } = window;
    const shiftStartHour = Number(shiftStartTime.slice(0, 2));
    const hoursAfterMidnightOffset = 24 - shiftStartHour;

    const businessDates: string[] = [];
    for (let cursor = DateTime.fromISO(fromDate, { zone: REPORT_TZ }); cursor <= DateTime.fromISO(toDate, { zone: REPORT_TZ }); cursor = cursor.plus({ days: 1 })) {
      businessDates.push(cursor.toISODate()!);
    }

    const searchFilter = req.query.search ? `%${String(req.query.search).toLowerCase()}%` : null;
    const catFilter = req.query.category ? String(req.query.category) : null;

    // ── Run all queries in parallel ──────────────────────────────────────────
    const [summaryRes, productsRes, modifiersRes, categoryRes, trendRes, hourlyRes] = await Promise.all([

      // 1. Summary
      db.execute(sql`
        WITH biz AS (
          SELECT r.receipt_id, r.total_amount
          FROM lv_receipt r
          WHERE ${RECEIPT_WINDOW_FILTER(startLocal, endLocal)}
        )
        SELECT
          COUNT(DISTINCT b.receipt_id)::int AS receipt_count,
          ROUND(SUM(b.total_amount), 0)::numeric AS gross_sales,
          ROUND(AVG(b.total_amount), 0)::numeric AS avg_receipt,
          COALESCE(SUM(li.qty), 0)::int AS line_item_count,
          COALESCE((SELECT SUM(m.qty) FROM lv_modifier m WHERE m.receipt_id IN (SELECT receipt_id FROM biz)), 0)::int AS modifier_count,
          COALESCE(SUM(CASE WHEN lower(li.name) LIKE '%chicken%' OR lower(li.name) LIKE '%rooster%' OR lower(li.name) LIKE '%nugget%' OR lower(li.name) LIKE '%karaage%' THEN li.qty ELSE 0 END), 0)::int AS chicken_sold,
          COALESCE(SUM(CASE WHEN lower(li.name) LIKE '%fries%' OR lower(li.name) LIKE '%cajun%' OR lower(li.name) LIKE '%sweet potato%' OR lower(li.name) LIKE '%dirty%' OR lower(li.name) LIKE '%loaded%' THEN li.qty ELSE 0 END), 0)::int AS fries_sold,
          COALESCE(SUM(CASE WHEN lower(li.name) LIKE '%coke%' OR lower(li.name) LIKE '%sprite%' OR lower(li.name) LIKE '%water%' OR lower(li.name) LIKE '%fanta%' OR lower(li.name) LIKE '%soda%' OR lower(li.name) LIKE '%schweppes%' OR lower(li.name) LIKE '%can%' THEN li.qty ELSE 0 END), 0)::int AS drinks_sold,
          COALESCE(SUM(CASE
            WHEN lower(li.name) LIKE '%chicken%' OR lower(li.name) LIKE '%rooster%' OR lower(li.name) LIKE '%nugget%' OR lower(li.name) LIKE '%karaage%' THEN 0
            WHEN lower(li.name) LIKE '%burger%' OR lower(li.name) LIKE '%smash%' OR lower(li.name) LIKE '%single%' OR lower(li.name) LIKE '%double%' OR lower(li.name) LIKE '%triple%' OR lower(li.name) LIKE '%ultimate%' THEN li.qty
            ELSE 0
          END), 0)::int AS burgers_sold
        FROM biz b
        LEFT JOIN lv_line_item li ON li.receipt_id = b.receipt_id
      `),

      // 2. Top products
      db.execute(sql`
        WITH biz AS (
          SELECT receipt_id
          FROM lv_receipt
          WHERE ${RECEIPT_WINDOW_FILTER_UNALIASED(startLocal, endLocal)}
        ),
        items AS (
          SELECT li.name, li.sku,
            ${CAT_CASE} AS category,
            SUM(li.qty)::int AS qty_sold,
            ROUND(SUM(li.qty * li.unit_price), 0)::numeric AS revenue,
            COUNT(DISTINCT li.receipt_id)::int AS receipt_appearances
          FROM lv_line_item li
          WHERE li.receipt_id IN (SELECT receipt_id FROM biz)
            ${searchFilter ? sql`AND lower(li.name) LIKE ${searchFilter}` : sql``}
            ${catFilter ? sql`AND ${CAT_CASE} = ${catFilter}` : sql``}
          GROUP BY li.name, li.sku
        ),
        total AS (SELECT SUM(qty_sold) AS total_qty FROM items)
        SELECT i.name, i.sku, i.category, i.qty_sold, i.revenue, i.receipt_appearances,
          ROUND(i.qty_sold * 100.0 / NULLIF(t.total_qty, 0), 1)::numeric AS pct_of_total
        FROM items i CROSS JOIN total t
        ORDER BY i.qty_sold DESC
        LIMIT 50
      `),

      // 3. Top modifiers
      db.execute(sql`
        WITH biz AS (
          SELECT receipt_id
          FROM lv_receipt
          WHERE ${RECEIPT_WINDOW_FILTER_UNALIASED(startLocal, endLocal)}
        ),
        mods AS (
          SELECT m.name, SUM(m.qty)::int AS qty_sold
          FROM lv_modifier m
          WHERE m.receipt_id IN (SELECT receipt_id FROM biz)
            ${searchFilter ? sql`AND lower(m.name) LIKE ${searchFilter}` : sql``}
          GROUP BY m.name
        ),
        total AS (SELECT SUM(qty_sold) AS total_qty FROM mods)
        SELECT md.name, md.qty_sold,
          ROUND(md.qty_sold * 100.0 / NULLIF(t.total_qty, 0), 1)::numeric AS pct_of_total
        FROM mods md CROSS JOIN total t
        ORDER BY md.qty_sold DESC
        LIMIT 50
      `),

      // 4. Category mix
      db.execute(sql`
        WITH biz AS (
          SELECT receipt_id
          FROM lv_receipt
          WHERE ${RECEIPT_WINDOW_FILTER_UNALIASED(startLocal, endLocal)}
        )
        SELECT
          ${CAT_CASE} AS category,
          SUM(li.qty)::int AS qty_sold,
          ROUND(SUM(li.qty * li.unit_price), 0)::numeric AS revenue
        FROM lv_line_item li
        WHERE li.receipt_id IN (SELECT receipt_id FROM biz)
        GROUP BY ${CAT_CASE}
        ORDER BY qty_sold DESC
      `),

      // 5. Daily trend — JOIN approach (avoids per-receipt correlated subqueries)
      db.execute(sql`
        WITH biz AS (
          SELECT r.receipt_id, r.total_amount,
            CASE WHEN EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= ${shiftStartHour}
              THEN (r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
              ELSE ((r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - 1)
            END AS biz_date
          FROM lv_receipt r
          WHERE ${RECEIPT_WINDOW_FILTER(startLocal, endLocal)}
        )
        SELECT
          b.biz_date::text,
          ROUND(SUM(b.total_amount), 0)::numeric AS gross_sales,
          COUNT(DISTINCT b.receipt_id)::int AS receipt_count,
          COALESCE(SUM(CASE
            WHEN lower(li.name) LIKE '%chicken%' OR lower(li.name) LIKE '%rooster%' OR lower(li.name) LIKE '%nugget%' OR lower(li.name) LIKE '%karaage%' THEN 0
            WHEN lower(li.name) LIKE '%burger%' OR lower(li.name) LIKE '%smash%' OR lower(li.name) LIKE '%single%' OR lower(li.name) LIKE '%double%' OR lower(li.name) LIKE '%triple%' OR lower(li.name) LIKE '%ultimate%' THEN li.qty
            ELSE 0 END), 0)::int AS burgers,
          COALESCE(SUM(CASE WHEN lower(li.name) LIKE '%fries%' OR lower(li.name) LIKE '%cajun%' OR lower(li.name) LIKE '%sweet potato%' OR lower(li.name) LIKE '%dirty%' OR lower(li.name) LIKE '%loaded%' THEN li.qty ELSE 0 END), 0)::int AS fries,
          COALESCE(SUM(CASE WHEN lower(li.name) LIKE '%coke%' OR lower(li.name) LIKE '%sprite%' OR lower(li.name) LIKE '%water%' OR lower(li.name) LIKE '%fanta%' OR lower(li.name) LIKE '%soda%' OR lower(li.name) LIKE '%schweppes%' OR lower(li.name) LIKE '%can%' THEN li.qty ELSE 0 END), 0)::int AS drinks
        FROM biz b
        LEFT JOIN lv_line_item li ON li.receipt_id = b.receipt_id
        GROUP BY b.biz_date
        ORDER BY b.biz_date ASC
      `),

      // 6. Hourly sales — full expressions in GROUP BY / ORDER BY (avoids alias issue)
      db.execute(sql`
        SELECT
          EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::int AS bkk_hour,
          COUNT(DISTINCT r.receipt_id)::int AS receipt_count,
          ROUND(SUM(r.total_amount), 0)::numeric AS gross_sales,
          COALESCE(SUM(li.qty), 0)::int AS items_sold
        FROM lv_receipt r
        LEFT JOIN lv_line_item li ON li.receipt_id = r.receipt_id
        WHERE ${RECEIPT_WINDOW_FILTER(startLocal, endLocal)}
        GROUP BY EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::int
        ORDER BY CASE
          WHEN EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::int >= ${shiftStartHour}
          THEN EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::int - ${shiftStartHour}
          ELSE EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::int + ${hoursAfterMidnightOffset}
        END
      `),
    ]);

    // ── Parse results ────────────────────────────────────────────────────────
    const s = (summaryRes.rows as any[])[0] ?? {};
    if (toNum(s.receipt_count) === 0) {
      return res.json({
        ok: false,
        source: { receipts: "lv_receipt", lineItems: "lv_line_item", modifiers: "lv_modifier", window: `${shiftStartTime}–${shiftEndTime} ${REPORT_TZ}` },
        filters: { from: fromDate, to: toDate, businessDates, mode: window.mode, shiftStartDate: fromDate, shiftEndDate: toDate, shiftStartTime, shiftEndTime, timezone: REPORT_TZ, windowStart: startLocal, windowEnd: endLocal },
        blockers: [{ code: "NO_RECEIPTS", message: "No receipts found for selected shift window" }],
      });
    }
    const burgersSold = toNum(s.burgers_sold);
    const friesSold = toNum(s.fries_sold);
    const drinksSold = toNum(s.drinks_sold);

    const products = (productsRes.rows as any[]).map((r) => ({
      name: toStr(r.name),
      sku: toStr(r.sku),
      category: toStr(r.category),
      qtySold: toNum(r.qty_sold),
      revenue: toNum(r.revenue),
      pctOfTotal: toNum(r.pct_of_total),
    }));

    const trendRows = (trendRes.rows as any[]).map((r) => ({
      bizDate: toStr(r.biz_date).slice(0, 10),
      grossSales: toNum(r.gross_sales),
      receiptCount: toNum(r.receipt_count),
      burgers: toNum(r.burgers),
      fries: toNum(r.fries),
      drinks: toNum(r.drinks),
    }));

    // Hourly: fix the correlated sub-query (simplify — just return receipt+gross per hour)
    const hourlyRows = (hourlyRes.rows as any[]).map((r) => ({
      hour: toNum(r.bkk_hour),
      label: `${String(toNum(r.bkk_hour)).padStart(2, "0")}:00`,
      receiptCount: toNum(r.receipt_count),
      grossSales: toNum(r.gross_sales),
    }));

    return res.json({
      ok: true,
      source: {
        receipts: "lv_receipt",
        lineItems: "lv_line_item",
        modifiers: "lv_modifier",
        window: `${shiftStartTime}–${shiftEndTime} ${REPORT_TZ}`,
      },
      filters: { from: fromDate, to: toDate, businessDates, mode: window.mode, shiftStartDate: fromDate, shiftEndDate: toDate, shiftStartTime, shiftEndTime, timezone: REPORT_TZ, windowStart: startLocal, windowEnd: endLocal },
      summary: {
        grossSales: toNum(s.gross_sales),
        receiptCount: toNum(s.receipt_count),
        averageReceiptValue: toNum(s.avg_receipt),
        lineItemCount: toNum(s.line_item_count),
        modifierCount: toNum(s.modifier_count),
        burgersSold,
        friesSold,
        drinksSold,
        chickenSold: toNum(s.chicken_sold),
      },
      topProducts: products,
      topModifiers: (modifiersRes.rows as any[]).map((r) => ({
        name: toStr(r.name),
        qtySold: toNum(r.qty_sold),
        pctOfTotal: toNum(r.pct_of_total),
      })),
      categoryMix: (categoryRes.rows as any[]).map((r) => ({
        category: toStr(r.category),
        qtySold: toNum(r.qty_sold),
        revenue: toNum(r.revenue),
      })),
      dailyTrend: trendRows,
      hourlySales: hourlyRows,
      blockers: [],
    });
  } catch (err: any) {
    console.error("[receipt-analytics]", err?.message);
    return res.json({
      ok: false,
      blockers: [{ code: "QUERY_FAILED", message: err?.message ?? "Query failed" }],
    });
  }
});

export default router;

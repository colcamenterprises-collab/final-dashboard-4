// RECEIPT ANALYTICS — READ ONLY
// Source: lv_receipt, lv_line_item, lv_modifier
// Business window: 18:00–03:00 Asia/Bangkok

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
const toNum = (v: unknown): number => (v == null ? 0 : Number(v));
const toStr = (v: unknown): string => (v == null ? "" : String(v));

// Business date CTE — used in every query
const BIZ_FILTER = (from: string, to: string) => sql`
  CASE WHEN EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
    THEN (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
    ELSE ((datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - 1)
  END BETWEEN ${from}::date AND ${to}::date
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

// Patty count per line item (beef burgers only — excludes chicken)
const PATTY_CASE = sql`
  CASE
    WHEN lower(li.name) LIKE '%chicken%' OR lower(li.name) LIKE '%rooster%'
      OR lower(li.name) LIKE '%nugget%' OR lower(li.name) LIKE '%karaage%' THEN 0
    WHEN lower(li.name) LIKE '%triple%' THEN li.qty * 3
    WHEN lower(li.name) LIKE '%super double%' OR lower(li.name) LIKE '%ultimate%'
      OR lower(li.name) LIKE '%double%' THEN li.qty * 2
    WHEN lower(li.name) LIKE '%burger%' OR lower(li.name) LIKE '%smash%'
      OR lower(li.name) LIKE '%single%' THEN li.qty * 1
    ELSE 0
  END
`;

// ── main route ────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  if (!db) return res.json({ ok: false, blockers: [{ code: "DB_UNAVAILABLE", message: "Database not available." }] });

  try {
    let fromDate: string, toDate: string;
    const businessDates: string[] = [];

    if (req.query.from && req.query.to) {
      fromDate = String(req.query.from);
      toDate = String(req.query.to);
    } else {
      // Last N completed business shifts (limit param, default 7, max 90)
      const limitN = Math.min(Math.max(parseInt(String(req.query.limit ?? "7")) || 7, 1), 90);
      const { rows: dateRows } = await db.execute(sql`
        SELECT DISTINCT
          CASE WHEN EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
            THEN (datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
            ELSE ((datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - 1)
          END AS biz_date
        FROM lv_receipt
        WHERE EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
           OR EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3
        ORDER BY biz_date DESC
        LIMIT ${sql.raw(String(limitN))}
      `);
      if (dateRows.length === 0) {
        return res.json({ ok: false, blockers: [{ code: "NO_RECEIPTS", message: "No POS receipts found for this period." }] });
      }
      const sorted = dateRows.map((r: any) => String(r.biz_date).slice(0, 10)).sort();
      fromDate = sorted[0];
      toDate = sorted[sorted.length - 1];
      businessDates.push(...sorted.reverse());
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
          WHERE (EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
              OR EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3)
            AND ${BIZ_FILTER(fromDate, toDate)}
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
          WHERE (EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
              OR EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3)
            AND ${BIZ_FILTER(fromDate, toDate)}
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
          WHERE (EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
              OR EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3)
            AND ${BIZ_FILTER(fromDate, toDate)}
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
          WHERE (EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
              OR EXTRACT(HOUR FROM datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3)
            AND ${BIZ_FILTER(fromDate, toDate)}
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
            CASE WHEN EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
              THEN (r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date
              ELSE ((r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::date - 1)
            END AS biz_date
          FROM lv_receipt r
          WHERE (EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
              OR EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3)
            AND ${BIZ_FILTER(fromDate, toDate)}
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
        WHERE (EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') >= 18
            OR EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok') < 3)
          AND ${BIZ_FILTER(fromDate, toDate)}
        GROUP BY EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::int
        ORDER BY CASE
          WHEN EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::int >= 18
          THEN EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::int - 18
          ELSE EXTRACT(HOUR FROM r.datetime_bkk AT TIME ZONE 'Asia/Bangkok')::int + 6
        END
      `),
    ]);

    // ── Parse results ────────────────────────────────────────────────────────
    const s = (summaryRes.rows as any[])[0] ?? {};
    const burgersSold = toNum(s.burgers_sold);
    const friesSold = toNum(s.fries_sold);
    const drinksSold = toNum(s.drinks_sold);

    // Stock usage estimates from products data
    const products = (productsRes.rows as any[]).map((r) => ({
      name: toStr(r.name),
      sku: toStr(r.sku),
      category: toStr(r.category),
      qtySold: toNum(r.qty_sold),
      revenue: toNum(r.revenue),
      pctOfTotal: toNum(r.pct_of_total),
    }));

    let pattiesEstimate = 0;
    let nuggetsEstimate = 0;
    let friesPortions = 0;
    for (const p of products) {
      const n = p.name.toLowerCase();
      const qty = p.qtySold;
      if (n.includes("nugget")) { nuggetsEstimate += qty; continue; }
      if (n.includes("chicken") || n.includes("rooster") || n.includes("karaage")) continue;
      if (n.includes("triple")) { pattiesEstimate += qty * 3; continue; }
      if (n.includes("super double") || n.includes("ultimate") || n.includes("double")) { pattiesEstimate += qty * 2; continue; }
      if (n.includes("burger") || n.includes("smash") || n.includes("single")) { pattiesEstimate += qty * 1; }
      if (n.includes("fries") || n.includes("cajun") || n.includes("sweet potato") || n.includes("dirty") || n.includes("loaded")) { friesPortions += qty; }
    }

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
        window: "18:00–03:00 Asia/Bangkok",
      },
      filters: { from: fromDate, to: toDate, businessDates },
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
      stockUsage: [
        { item: "Beef Patties", qty: pattiesEstimate, unit: "patties", detail: `${pattiesEstimate * 95}g meat` },
        { item: "Burger Buns", qty: burgersSold, unit: "buns", detail: "1 bun per burger" },
        { item: "Fries Portions", qty: friesPortions, unit: "portions", detail: `~${friesPortions * 130}g total` },
        { item: "Drinks", qty: drinksSold, unit: "units", detail: "POS drink items" },
        { item: "Nuggets", qty: nuggetsEstimate, unit: "portions", detail: "From nugget items" },
      ],
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

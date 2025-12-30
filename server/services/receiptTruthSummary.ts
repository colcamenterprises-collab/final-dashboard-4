import axios from 'axios';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const LOYVERSE_API = 'https://api.loyverse.com/v1.0';
const LOYVERSE_TOKEN = process.env.LOYVERSE_TOKEN;

export interface ReceiptTruthSummary {
  allReceipts: number;
  salesReceipts: number;
  refundReceipts: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  source: string;
  builtAt?: string;
}

// 🔒 RECEIPT TRUTH — STEP 2 (LOCKED)
interface LoyverseLineModifier {
  name?: string;
  option?: string;
  quantity?: number;
  money_amount?: number;
}

interface LoyverseLineItem {
  item_name: string;
  sku?: string;
  category_name?: string;
  quantity: number;
  price?: number;
  total_money?: number;
  total_discount?: number;
  line_modifiers?: LoyverseLineModifier[];
}

interface LoyverseReceipt {
  receipt_number: string;
  receipt_date: string;
  total_money: number;
  total_discount?: number;
  refund_for?: string | null;
  line_items?: LoyverseLineItem[];
}

export interface ReceiptTruthLine {
  receiptDate: string;
  receiptId: string;
  receiptType: 'SALE' | 'REFUND';
  sku: string | null;
  itemName: string;
  category: string | null;
  quantity: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  modifiers?: { name: string; quantity: number; priceImpact: number }[];
}

function getShiftWindowUTC(businessDate: string): { start: string; end: string } {
  const [year, month, day] = businessDate.split('-').map(Number);
  const startBangkok = new Date(Date.UTC(year, month - 1, day, 10, 0, 0));
  const endBangkok = new Date(Date.UTC(year, month - 1, day, 20, 0, 0));
  return {
    start: startBangkok.toISOString(),
    end: endBangkok.toISOString(),
  };
}

async function fetchReceiptsFromLoyverse(startISO: string, endISO: string): Promise<LoyverseReceipt[]> {
  if (!LOYVERSE_TOKEN) {
    throw new Error('[RECEIPT_TRUTH_FAIL] LOYVERSE_TOKEN not configured');
  }

  const allReceipts: LoyverseReceipt[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  do {
    const params = new URLSearchParams();
    params.append('created_at_min', startISO);
    params.append('created_at_max', endISO);
    params.append('limit', '250');
    if (cursor) params.append('cursor', cursor);

    const url = `${LOYVERSE_API}/receipts?${params.toString()}`;
    console.log(`[RECEIPT_TRUTH] Fetching page ${pageCount + 1}...`);

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${LOYVERSE_TOKEN}` },
      timeout: 30000,
    });

    const data = response.data;
    if (Array.isArray(data?.receipts)) {
      allReceipts.push(...data.receipts);
    }

    cursor = data?.cursor;
    pageCount++;

    if (pageCount > 100) {
      console.warn('[RECEIPT_TRUTH] Hit page limit (100), stopping pagination');
      break;
    }
  } while (cursor);

  console.log(`[RECEIPT_TRUTH] Fetched ${allReceipts.length} receipts from Loyverse API`);
  return allReceipts;
}

function filterToShiftWindow(receipts: LoyverseReceipt[], startISO: string, endISO: string): LoyverseReceipt[] {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  
  return receipts.filter(r => {
    const receiptTime = new Date(r.receipt_date).getTime();
    return receiptTime >= start && receiptTime < end;
  });
}

export async function rebuildReceiptTruth(businessDate: string): Promise<ReceiptTruthSummary> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[RECEIPT_TRUTH_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  console.log(`[RECEIPT_TRUTH] Rebuilding for ${businessDate}`);
  const { start, end } = getShiftWindowUTC(businessDate);
  console.log(`[RECEIPT_TRUTH] Shift window UTC: ${start} to ${end}`);

  const rawReceipts = await fetchReceiptsFromLoyverse(start, end);
  const receipts = filterToShiftWindow(rawReceipts, start, end);

  if (receipts.length === 0) {
    throw new Error(`[RECEIPT_TRUTH_FAIL] NO_POS_RECEIPTS for ${businessDate}`);
  }

  const sales = receipts.filter(r => !r.refund_for);
  const refundReceipts = receipts.filter(r => !!r.refund_for);

  const allReceiptsCount = receipts.length;
  const salesReceiptsCount = sales.length;
  const refundReceiptsCount = refundReceipts.length;

  const grossSales = sales.reduce((sum, r) => sum + (Number(r.total_money) || 0), 0);
  const discountsTotal = sales.reduce((sum, r) => sum + (Number(r.total_discount) || 0), 0);
  const refundsTotal = refundReceipts.reduce((sum, r) => sum + (Number(r.total_money) || 0), 0);
  const netSales = grossSales - discountsTotal - refundsTotal;

  console.log(`[RECEIPT_TRUTH] All: ${allReceiptsCount}, Sales: ${salesReceiptsCount}, Refunds: ${refundReceiptsCount}`);
  console.log(`[RECEIPT_TRUTH] Gross: ${grossSales}, Discounts: ${discountsTotal}, Refunds: ${refundsTotal}, Net: ${netSales}`);

  await db.execute(sql`
    INSERT INTO receipt_truth_summary 
      (business_date, all_receipts, sales_receipts, refund_receipts, gross_sales, discounts, refunds, net_sales, source, built_at)
    VALUES 
      (${businessDate}::date, ${allReceiptsCount}, ${salesReceiptsCount}, ${refundReceiptsCount}, 
       ${grossSales}, ${discountsTotal}, ${refundsTotal}, ${netSales}, 'LOYVERSE_API', NOW())
    ON CONFLICT (business_date) DO UPDATE SET
      all_receipts = EXCLUDED.all_receipts,
      sales_receipts = EXCLUDED.sales_receipts,
      refund_receipts = EXCLUDED.refund_receipts,
      gross_sales = EXCLUDED.gross_sales,
      discounts = EXCLUDED.discounts,
      refunds = EXCLUDED.refunds,
      net_sales = EXCLUDED.net_sales,
      source = EXCLUDED.source,
      built_at = NOW()
  `);

  // 🔒 RECEIPT TRUTH — STEP 2: Write line items and modifiers
  await db.execute(sql`DELETE FROM receipt_truth_line WHERE receipt_date = ${businessDate}::date`);
  await db.execute(sql`
    DELETE FROM receipt_truth_modifier 
    WHERE receipt_id IN (
      SELECT DISTINCT receipt_id FROM receipt_truth_line WHERE receipt_date = ${businessDate}::date
    )
  `);

  let lineCount = 0;
  let modifierCount = 0;

  for (const receipt of receipts) {
    const receiptType = receipt.refund_for ? 'REFUND' : 'SALE';
    const lineItems = receipt.line_items || [];

    for (const line of lineItems) {
      const grossAmount = Number(line.total_money || 0);
      const discountAmount = Number(line.total_discount || 0);
      const netAmount = grossAmount - discountAmount;

      await db.execute(sql`
        INSERT INTO receipt_truth_line 
          (receipt_date, receipt_id, receipt_type, sku, item_name, category, quantity, gross_amount, discount_amount, net_amount)
        VALUES 
          (${businessDate}::date, ${receipt.receipt_number}, ${receiptType}, ${line.sku || null}, 
           ${line.item_name || 'UNKNOWN'}, ${line.category_name || null}, ${Number(line.quantity || 0)},
           ${grossAmount}, ${discountAmount}, ${netAmount})
      `);
      lineCount++;

      for (const mod of line.line_modifiers || []) {
        const modName = mod.option || mod.name || 'MODIFIER';
        const priceImpact = Number(mod.money_amount || 0);
        
        await db.execute(sql`
          INSERT INTO receipt_truth_modifier 
            (receipt_id, line_sku, modifier_name, quantity, price_impact)
          VALUES 
            (${receipt.receipt_number}, ${line.sku || null}, ${modName}, ${Number(mod.quantity || 1)}, ${priceImpact})
        `);
        modifierCount++;
      }
    }
  }

  console.log(`[RECEIPT_TRUTH] Lines: ${lineCount}, Modifiers: ${modifierCount}`);

  return {
    allReceipts: allReceiptsCount,
    salesReceipts: salesReceiptsCount,
    refundReceipts: refundReceiptsCount,
    grossSales,
    discounts: discountsTotal,
    refunds: refundsTotal,
    netSales,
    source: 'LOYVERSE_API',
  };
}

export async function getReceiptTruth(businessDate: string): Promise<ReceiptTruthSummary | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[RECEIPT_TRUTH_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  const result = await db.execute(sql`
    SELECT 
      all_receipts, sales_receipts, refund_receipts,
      gross_sales, discounts, refunds, net_sales,
      source, built_at
    FROM receipt_truth_summary
    WHERE business_date = ${businessDate}::date
  `);

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as any;
  return {
    allReceipts: Number(row.all_receipts),
    salesReceipts: Number(row.sales_receipts),
    refundReceipts: Number(row.refund_receipts),
    grossSales: Number(row.gross_sales),
    discounts: Number(row.discounts),
    refunds: Number(row.refunds),
    netSales: Number(row.net_sales),
    source: row.source,
    builtAt: row.built_at?.toISOString?.() || String(row.built_at),
  };
}

// 🔒 RECEIPT TRUTH — STEP 2: Get line-level truth
export async function getReceiptTruthLines(businessDate: string): Promise<ReceiptTruthLine[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw new Error('[RECEIPT_TRUTH_FAIL] Invalid date format. Use YYYY-MM-DD');
  }

  const linesResult = await db.execute(sql`
    SELECT 
      l.receipt_date, l.receipt_id, l.receipt_type, l.sku, l.item_name, l.category,
      l.quantity, l.gross_amount, l.discount_amount, l.net_amount
    FROM receipt_truth_line l
    WHERE l.receipt_date = ${businessDate}::date
    ORDER BY l.receipt_id, l.item_name
  `);

  const modifiersResult = await db.execute(sql`
    SELECT 
      m.receipt_id, m.line_sku, m.modifier_name, m.quantity, m.price_impact
    FROM receipt_truth_modifier m
    WHERE m.receipt_id IN (
      SELECT DISTINCT receipt_id FROM receipt_truth_line WHERE receipt_date = ${businessDate}::date
    )
  `);

  const modifiersByReceipt = new Map<string, Map<string, { name: string; quantity: number; priceImpact: number }[]>>();
  for (const mod of modifiersResult.rows as any[]) {
    const receiptId = mod.receipt_id;
    const lineSku = mod.line_sku || '';
    
    if (!modifiersByReceipt.has(receiptId)) {
      modifiersByReceipt.set(receiptId, new Map());
    }
    const receiptMods = modifiersByReceipt.get(receiptId)!;
    if (!receiptMods.has(lineSku)) {
      receiptMods.set(lineSku, []);
    }
    receiptMods.get(lineSku)!.push({
      name: mod.modifier_name,
      quantity: Number(mod.quantity),
      priceImpact: Number(mod.price_impact),
    });
  }

  return (linesResult.rows as any[]).map(row => ({
    receiptDate: row.receipt_date,
    receiptId: row.receipt_id,
    receiptType: row.receipt_type as 'SALE' | 'REFUND',
    sku: row.sku,
    itemName: row.item_name,
    category: row.category,
    quantity: Number(row.quantity),
    grossAmount: Number(row.gross_amount),
    discountAmount: Number(row.discount_amount),
    netAmount: Number(row.net_amount),
    modifiers: modifiersByReceipt.get(row.receipt_id)?.get(row.sku || '') || [],
  }));
}

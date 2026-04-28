import { Router } from 'express';
import { pool } from '../db';
import { getDailyAnalysis } from '../services/dataAnalystService';

const router = Router();

router.get('/v2', async (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date query parameter required (YYYY-MM-DD)' });
  }

  const analysis = await getDailyAnalysis(date);

  res.json({
    ...analysis,
    tables: {
      drinks: analysis.data.drinks,
      burgersAndSets: analysis.data.burgers,
      sideOrders: analysis.data.sides,
      modifiers: analysis.data.modifiers,
    },
  });
});

// ─── /v2/financial-summary — Isolated POS Financial Summary ─────────────────
/**
 * GET /api/analysis/v2/financial-summary?date=YYYY-MM-DD
 *
 * Returns POS-authoritative financial data for a shift.
 * Sales figures: Loyverse/POS only (pos_shift_report → lv_receipt fallback).
 * Staff form: starting cash, closing cash, receipt counts, cash/QR banked, refunds.
 * No staff-entered sales totals.
 */
router.get('/v2/financial-summary', async (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date required (YYYY-MM-DD)' });
  }

  const startUtc = `${date}T10:00:00.000Z`;
  const endUtc   = `${date}T20:00:00.000Z`;
  const warnings: string[] = [];
  const n  = (v: any): number | null => { if (v == null || v === '') return null; const x = Number(v); return isNaN(x) ? null : x; };
  const nz = (v: any): number => n(v) ?? 0;

  // ── 1. POS Shift Report ───────────────────────────────────────────────────
  let pos: Record<string, any> | null = null;
  let posAvailable = false;
  try {
    const r = await pool.query(
      `SELECT * FROM pos_shift_report WHERE "businessDate"::date = $1::date LIMIT 1`,
      [date],
    );
    if (r.rows.length > 0) { pos = r.rows[0]; posAvailable = true; }
    else warnings.push('POS shift report not available for this date — showing receipt aggregates');
  } catch (e: any) { warnings.push(`POS shift report query failed: ${e.message}`); }

  // ── 2. Staff Daily Sales Form ─────────────────────────────────────────────
  let form: Record<string, any> | null = null;
  let formAvailable = false;
  try {
    const r = await pool.query(
      `SELECT payload FROM daily_sales_v2
       WHERE "shiftDate" = $1
       ORDER BY (payload->>'rollsEnd') IS NOT NULL DESC, "createdAt" DESC
       LIMIT 1`,
      [date],
    );
    if (r.rows.length > 0) { form = r.rows[0].payload; formAvailable = true; }
    else warnings.push('Staff daily sales form not found for this date');
  } catch (e: any) { warnings.push(`Staff form query failed: ${e.message}`); }

  // ── 3. lv_receipt by channel (fallback + POS receipt counts) ─────────────
  type ChannelRow = { pay_name: string; cnt: string; total: string };
  let receiptRows: ChannelRow[] = [];
  try {
    const r = await pool.query<ChannelRow>(
      `SELECT pj->>'name' AS pay_name,
              COUNT(*)::text AS cnt,
              COALESCE(SUM((pj->>'money_amount')::numeric), 0)::text AS total
       FROM lv_receipt,
       LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(payment_json) = 'array'
              THEN payment_json
              ELSE jsonb_build_array(payment_json)
         END
       ) AS pj
       WHERE datetime_bkk >= $1::timestamptz AT TIME ZONE 'UTC'
         AND datetime_bkk <  $2::timestamptz AT TIME ZONE 'UTC'
       GROUP BY pay_name ORDER BY cnt DESC`,
      [startUtc, endUtc],
    );
    receiptRows = r.rows;
  } catch (e: any) { warnings.push(`Receipt query failed: ${e.message}`); }

  // ── lv_receipt channel aggregation ───────────────────────────────────────
  const chan = { cash: { cnt: 0, amt: 0 }, qr: { cnt: 0, amt: 0 }, grab: { cnt: 0, amt: 0 }, other: { cnt: 0, amt: 0 } };
  for (const row of receiptRows) {
    const name = (row.pay_name || '').toLowerCase();
    const cnt  = parseInt(row.cnt, 10);
    const amt  = parseFloat(row.total);
    if      (name === 'cash')                          { chan.cash.cnt  += cnt; chan.cash.amt  += amt; }
    else if (name.includes('qr') || name.includes('scan')) { chan.qr.cnt   += cnt; chan.qr.amt   += amt; }
    else if (name === 'grab')                          { chan.grab.cnt  += cnt; chan.grab.amt  += amt; }
    else                                               { chan.other.cnt += cnt; chan.other.amt += amt; }
  }
  const lvReceiptTotal = chan.cash.cnt + chan.qr.cnt + chan.grab.cnt + chan.other.cnt;

  // ── Sales (POS as truth; lv_receipt fallback) ─────────────────────────────
  const refundAmt = n(form?.refundAmount);
  const source = posAvailable ? 'pos_shift_report' : (receiptRows.length > 0 ? 'lv_receipt_aggregated' : 'none');

  const sales = {
    grossSales:  pos ? n(pos.grossSales)  : null,
    netSales:    pos ? n(pos.netSales)    : null,
    cashSales:   pos ? nz(pos.cashTotal)  : chan.cash.amt,
    qrSales:     pos ? nz(pos.qrTotal)    : chan.qr.amt,
    grabSales:   pos ? nz(pos.grabTotal)  : chan.grab.amt,
    otherSales:  pos ? nz(pos.otherTotal) : chan.other.amt,
    refunds:     refundAmt,  // from staff form
  };

  // ── POS receipt counts ────────────────────────────────────────────────────
  const receipts = pos
    ? {
        total: nz(pos.receiptCount),
        cash:  chan.cash.cnt,    // lv_receipt channel split (pos_shift_report lacks per-channel count)
        qr:    chan.qr.cnt,
        grab:  chan.grab.cnt,
        other: chan.other.cnt,
      }
    : {
        total: lvReceiptTotal,
        cash:  chan.cash.cnt,
        qr:    chan.qr.cnt,
        grab:  chan.grab.cnt,
        other: chan.other.cnt,
      };

  // ── Staff receipt counts ──────────────────────────────────────────────────
  const staffCash  = n(form?.cashReceiptCount);
  const staffQr    = n(form?.qrReceiptCount);
  const staffGrab  = n(form?.grabReceiptCount);
  const staffTotal = staffCash != null && staffQr != null && staffGrab != null
    ? staffCash + staffQr + staffGrab : null;
  const staffReceipts = { total: staffTotal, cash: staffCash, qr: staffQr, grab: staffGrab };

  // ── Register Cash Position ────────────────────────────────────────────────
  const startingCash = nz(form?.startingCash);
  const closingCash  = n(form?.closingCash);
  const payIns       = 0;
  const payOuts      = posAvailable
    ? nz(pos!.shoppingTotal) + nz(pos!.wagesTotal) + nz(pos!.otherExpense)
    : null;
  const posCashSales = sales.cashSales;
  const expectedCash = payOuts != null
    ? Math.round(startingCash + posCashSales + payIns - payOuts - nz(refundAmt))
    : null;
  const cashVariance = expectedCash != null && closingCash != null
    ? Math.round(closingCash - expectedCash) : null;

  const register = { startingCash, payIns, payOuts, expectedCash, closingCash, cashVariance };

  // ── Banking Position ──────────────────────────────────────────────────────
  const cashBanked = n(form?.cashBanked);
  const qrBanked   = n(form?.qrTransfer);
  const cashInDrw  = pos ? n(pos.cashInDrawer) : null;
  const expectedCashBanked = cashInDrw != null
    ? Math.round(cashInDrw - startingCash)
    : payOuts != null
      ? Math.round(posCashSales - payOuts - nz(refundAmt))
      : null;
  const expectedQrBanked = Math.round(sales.qrSales);
  const cashBankingVariance = expectedCashBanked != null && cashBanked != null
    ? Math.round(cashBanked - expectedCashBanked) : null;
  const qrBankingVariance = qrBanked != null
    ? Math.round(qrBanked - expectedQrBanked) : null;

  const banking = { cashBanked, qrBanked, expectedCashBanked, expectedQrBanked, cashBankingVariance, qrBankingVariance };

  // ── Pay In / Pay Out Control ──────────────────────────────────────────────
  const staffExpenses = nz(form?.totalExpenses);
  const payInPayOut = {
    posPayIns:     payIns,
    posPayOuts:    payOuts,
    staffExpenses,
    difference:    payOuts != null ? Math.round(staffExpenses - payOuts) : null,
  };

  return res.json({
    ok: true,
    shiftDate: date,
    posAvailable,
    formAvailable,
    source,
    sales,
    receipts,
    staffReceipts,
    register,
    banking,
    payInPayOut,
    warnings,
  });
});

// ─── Financial Control ────────────────────────────────────────────────────────

router.get('/financial-control', async (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ ok: false, error: 'date required (YYYY-MM-DD)' });
  }

  // Shift UTC window: shift_date 10:00 UTC → 20:00 UTC  (= 17:00–03:00 BKK)
  const startUtc = `${date}T10:00:00.000Z`;
  const endUtc   = `${date}T20:00:00.000Z`;

  const warnings: string[] = [];

  // ── 1. POS Shift Report ──────────────────────────────────────────────────
  let pos: Record<string, any> | null = null;
  let posAvailable = false;
  try {
    const r = await pool.query(
      `SELECT * FROM pos_shift_report WHERE "businessDate"::date = $1::date LIMIT 1`,
      [date],
    );
    if (r.rows.length > 0) {
      pos = r.rows[0];
      posAvailable = true;
    } else {
      warnings.push('POS shift report not available for this date');
    }
  } catch (e: any) {
    warnings.push(`POS shift report query failed: ${e.message}`);
  }

  // ── 2. Daily Sales Form (daily_sales_v2) ─────────────────────────────────
  let form: Record<string, any> | null = null;
  let formAvailable = false;
  try {
    const r = await pool.query(
      `SELECT payload FROM daily_sales_v2
       WHERE "shiftDate" = $1
       ORDER BY (payload->>'rollsEnd') IS NOT NULL DESC, "createdAt" DESC
       LIMIT 1`,
      [date],
    );
    if (r.rows.length > 0) {
      form = r.rows[0].payload;
      formAvailable = true;
    } else {
      warnings.push('Staff daily sales form not found for this date');
    }
  } catch (e: any) {
    warnings.push(`Daily sales form query failed: ${e.message}`);
  }

  // ── 3. lv_receipt per-channel ────────────────────────────────────────────
  type ChannelRow = { pay_name: string; cnt: string; total: string };
  let receiptRows: ChannelRow[] = [];
  try {
    const r = await pool.query<ChannelRow>(
      `SELECT pj->>'name' AS pay_name,
              COUNT(*)::text AS cnt,
              COALESCE(SUM((pj->>'money_amount')::numeric), 0)::text AS total
       FROM lv_receipt,
       LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(payment_json) = 'array'
              THEN payment_json
              ELSE jsonb_build_array(payment_json)
         END
       ) AS pj
       WHERE datetime_bkk >= $1::timestamptz AT TIME ZONE 'UTC'
         AND datetime_bkk <  $2::timestamptz AT TIME ZONE 'UTC'
       GROUP BY pay_name
       ORDER BY cnt DESC`,
      [startUtc, endUtc],
    );
    receiptRows = r.rows;
  } catch (e: any) {
    warnings.push(`POS receipt query failed: ${e.message}`);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const n = (v: any): number | null => {
    if (v == null || v === '') return null;
    const x = Number(v);
    return isNaN(x) ? null : x;
  };
  const nz = (v: any): number => n(v) ?? 0;

  // Receipt channel sums from lv_receipt
  const posReceiptByChan = {
    cash:  { count: 0, amount: 0 },
    qr:    { count: 0, amount: 0 },
    grab:  { count: 0, amount: 0 },
    other: { count: 0, amount: 0 },
  };
  for (const row of receiptRows) {
    const name = (row.pay_name || '').toLowerCase();
    const cnt  = parseInt(row.cnt, 10);
    const amt  = parseFloat(row.total);
    if (name === 'cash') {
      posReceiptByChan.cash.count  += cnt;
      posReceiptByChan.cash.amount += amt;
    } else if (name.includes('qr') || name.includes('scan')) {
      posReceiptByChan.qr.count  += cnt;
      posReceiptByChan.qr.amount += amt;
    } else if (name === 'grab') {
      posReceiptByChan.grab.count  += cnt;
      posReceiptByChan.grab.amount += amt;
    } else {
      posReceiptByChan.other.count  += cnt;
      posReceiptByChan.other.amount += amt;
    }
  }
  const posReceiptTotal = receiptRows.reduce((a, r) => a + parseInt(r.cnt, 10), 0);

  // Staff receipt counts
  const staffCash  = n(form?.cashReceiptCount);
  const staffQr    = n(form?.qrReceiptCount);
  const staffGrab  = n(form?.grabReceiptCount);
  const staffTotal = staffCash != null && staffQr != null && staffGrab != null
    ? staffCash + staffQr + staffGrab
    : null;

  // Receipt count variances
  const rcVariance = (staff: number | null, posCnt: number) =>
    staff != null ? staff - posCnt : null;

  const receiptCounts = {
    staff: { cash: staffCash, qr: staffQr, grab: staffGrab, total: staffTotal },
    pos:   {
      cash:  posReceiptByChan.cash.count,
      qr:    posReceiptByChan.qr.count,
      grab:  posReceiptByChan.grab.count,
      other: posReceiptByChan.other.count,
      total: posReceiptTotal,
    },
    variances: {
      cash:  rcVariance(staffCash,  posReceiptByChan.cash.count),
      qr:    rcVariance(staffQr,    posReceiptByChan.qr.count),
      grab:  rcVariance(staffGrab,  posReceiptByChan.grab.count),
      total: rcVariance(staffTotal, posReceiptTotal),
    },
  };

  // ── Sales Summary (POS as truth) ─────────────────────────────────────────
  // Prefer pos_shift_report totals; fall back to lv_receipt aggregates
  const salesSummary = {
    grossSales:   pos ? n(pos.grossSales)  : null,
    discounts:    pos ? n(pos.discounts)   : null,
    netSales:     pos ? n(pos.netSales)    : null,
    cashSales:    pos ? nz(pos.cashTotal)  : posReceiptByChan.cash.amount,
    qrSales:      pos ? nz(pos.qrTotal)    : posReceiptByChan.qr.amount,
    grabSales:    pos ? nz(pos.grabTotal)  : posReceiptByChan.grab.amount,
    otherSales:   pos ? nz(pos.otherTotal) : posReceiptByChan.other.amount,
    receiptCount: pos ? n(pos.receiptCount): posReceiptTotal,
    source:       pos ? 'pos_shift_report' : 'lv_receipt_aggregated',
  };

  // ── Register Cash Position ────────────────────────────────────────────────
  const startingCash    = nz(form?.startingCash);
  const staffClosing    = n(form?.closingCash);
  const cashBanked      = nz(form?.cashBanked);

  // Cash refund: only if refundChannel includes Cash
  const refundObj       = form?.refunds ?? {};
  const refundChannel   = String(refundObj.refundChannel || '').toLowerCase();
  const refundAmount    = refundChannel.includes('cash') ? nz(form?.refundAmount) : 0;

  // POS cash sales (prefer pos_shift_report, fallback to lv_receipt)
  const posCashSales    = pos ? nz(pos.cashTotal) : posReceiptByChan.cash.amount;

  // POS pay-ins / pay-outs
  const posPayIns       = 0; // Loyverse doesn't separately track pay-ins in this view
  const posPayOuts      = pos
    ? nz(pos.shoppingTotal) + nz(pos.wagesTotal) + nz(pos.otherExpense)
    : null;

  // Expected closing cash = amount in the register at end of shift, BEFORE banking
  // = startingCash + posCashSales + payIns - payOuts - cashRefunds
  // (cashBanked is NOT subtracted here — staff count closingCash before banking)
  const expectedClosingCash = posPayOuts != null
    ? Math.round(startingCash + posCashSales + posPayIns - posPayOuts - refundAmount)
    : null;

  const cashVariance = expectedClosingCash != null && staffClosing != null
    ? staffClosing - expectedClosingCash
    : null;

  const cashPosition = {
    startingCash,
    posCashSales,
    posPayIns,
    posPayOuts,
    refundAmount,
    cashBanked,
    expectedClosingCash,
    staffClosingCash: staffClosing,
    variance: cashVariance,
  };

  // ── Banking Position ──────────────────────────────────────────────────────
  // Expected cash to bank = POS cashInDrawer - startingCash
  // (cashInDrawer = what POS says is in register; subtract float = what should go to bank)
  const posCashInDrawer    = pos ? n(pos.cashInDrawer) : null;
  const expectedCashToBank = posCashInDrawer != null
    ? Math.round(posCashInDrawer - startingCash)
    : posPayOuts != null
      ? Math.round(posCashSales - posPayOuts - refundAmount)
      : null;

  const staffCashBanked    = n(form?.cashBanked);
  const cashBankingVariance = expectedCashToBank != null && staffCashBanked != null
    ? staffCashBanked - expectedCashToBank
    : null;

  const expectedQR         = pos ? nz(pos.qrTotal) : posReceiptByChan.qr.amount;
  const staffQRBanked      = n(form?.qrTransfer);
  const qrVariance         = staffQRBanked != null ? Math.round(staffQRBanked - expectedQR) : null;

  const bankingPosition = {
    expectedCashToBank,
    staffCashBanked,
    cashVariance: cashBankingVariance,
    expectedQR: Math.round(expectedQR),
    staffQRBanked,
    qrVariance,
  };

  // ── Pay In / Pay Out Control ──────────────────────────────────────────────
  const staffExpenses = nz(form?.totalExpenses);
  const payInPayOut = {
    posPayIns,
    posPayOuts,
    staffExpenses,
    difference: posPayOuts != null ? Math.round(staffExpenses - posPayOuts) : null,
    posSource: pos ? 'pos_shift_report' : null,
  };

  return res.json({
    ok: true,
    shiftDate: date,
    posAvailable,
    formAvailable,
    receiptCounts,
    salesSummary,
    cashPosition,
    bankingPosition,
    payInPayOut,
    warnings,
  });
});

export default router;

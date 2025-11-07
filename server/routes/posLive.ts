// server/routes/posLive.ts
import express from 'express';
import axios from 'axios';

const router = express.Router();
const BASE = process.env.LOYVERSE_BASE_URL || 'https://api.loyverse.com/v1.0';

// robust token resolution (supports both names)
const TOKEN =
  process.env.LOYVERSE_API_TOKEN ||
  process.env.LOYVERSE_ACCESS_TOKEN;

if (!TOKEN) {
  console.warn('[pos-live] Missing Loyverse token env (LOYVERSE_API_TOKEN or LOYVERSE_ACCESS_TOKEN)');
}

// util — THB -> cents (handles number|string)
function toCents(v: any): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'string' ? Number(v.replace(/[^\d.-]/g, '')) : Number(v);
  return Math.round(n * 100);
}

function bkkLastShiftBoundsUTC(): { startUTC: string; endUTC: string } {
  // BKK = UTC+7
  const BKK_OFFSET = 7 * 3600 * 1000;
  const nowUTC = Date.now();

  // end = today 03:00 BKK
  const endBkk = new Date(nowUTC + BKK_OFFSET);
  endBkk.setHours(3, 0, 0, 0);

  // start = yesterday 17:00 BKK
  const startBkk = new Date(endBkk);
  startBkk.setDate(startBkk.getDate() - 1);
  startBkk.setHours(17, 0, 0, 0);

  return {
    startUTC: new Date(startBkk.getTime() - BKK_OFFSET).toISOString(),
    endUTC: new Date(endBkk.getTime() - BKK_OFFSET).toISOString(),
  };
}

// Map POS payment labels to stable keys
function mapPayment(method: string): string {
  const m = (method || '').toUpperCase();
  if (m.includes('CASH')) return 'CASH';
  if (m.includes('GRAB')) return 'GRAB';
  if (m.includes('SCAN') || m.includes('QR') || m.includes('PROMPT')) return 'SCAN_QR';
  if (m.includes('CARD')) return 'CARD';
  if (m.includes('MOMO') || m.includes('LINE')) return 'WALLET';
  return m || 'OTHER';
}

// Live fetch of receipts within a window (hard-loop pagination)
async function fetchReceiptsWindow({
  startISO,
  endISO,
  storeId,
}: {
  startISO: string;
  endISO: string;
  storeId?: string;
}) {
  const client = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${TOKEN}` },
    timeout: 30000,
  });

  let pageToken: string | null = null;
  const all: any[] = [];
  let page = 0;

  while (true) {
    const params: any = {
      created_at_min: startISO,
      created_at_max: endISO,
      limit: 250,
    };
    if (storeId) params.store_id = storeId;
    if (pageToken) params.page_token = pageToken;

    const r = await client.get('/receipts', { params });
    const receipts = Array.isArray(r.data?.receipts) ? r.data.receipts : [];
    all.push(...receipts);
    pageToken = r.data?.next_page_token || r.data?.nextPageToken || null;
    page++;
    if (!pageToken || receipts.length === 0) break;
    if (page > 200) break; // safety
  }

  return all;
}

// GET /api/pos/live-shift?restaurantId=...&storeId=optional&from=ISO&to=ISO
router.get('/live-shift', async (req, res) => {
  try {
    if (!TOKEN) return res.status(500).json({ error: 'Missing Loyverse access token' });

    const restaurantId = String(req.query.restaurantId || '').trim();
    const storeId = String(req.query.storeId || process.env.LOYVERSE_STORE_ID || '').trim() || undefined;

    // window: explicit or default last shift
    const bounds = (() => {
      const from = req.query.from ? String(req.query.from) : null;
      const to   = req.query.to   ? String(req.query.to)   : null;
      if (from && to) return { startUTC: from, endUTC: to, mode: 'custom' as const };
      const b = bkkLastShiftBoundsUTC();
      return { ...b, mode: 'bkk_last_shift' as const };
    })();

    const raw = await fetchReceiptsWindow({ startISO: bounds.startUTC, endISO: bounds.endUTC, storeId });

    // filter out refunds/voids if present
    const salesOnly = raw.filter((r) => {
      const neg = (r.total_money ?? r.total ?? 0) < 0;
      const type = (r.type || r.status || '').toString().toLowerCase();
      const voided = String(r.voided || r.is_void || '').toLowerCase() === 'true';
      return !neg && !type.includes('refund') && !voided;
    });

    // aggregate
    let grossCents = 0;
    let discountsCents = 0;
    const payments: Record<string, number> = {};
    const byItem: Record<string, { name: string; qty: number; revenueCents: number }> = {};

    for (const r of salesOnly) {
      const total = toCents(r.total_money ?? r.total);
      const discount = toCents(r.discount_money ?? r.discount ?? 0);
      grossCents += total;
      discountsCents += discount;

      // payments
      const tenders = Array.isArray(r.payments) ? r.payments : (Array.isArray(r.tenders) ? r.tenders : []);
      for (const p of tenders) {
        const key = mapPayment(String(p.method || p.type || p.payment_type));
        payments[key] = (payments[key] || 0) + toCents(p.amount ?? p.money_amount ?? p.value ?? 0);
      }

      // items
      const items = Array.isArray(r.line_items) ? r.line_items :
                    Array.isArray(r.items) ? r.items : [];
      for (const it of items) {
        const name = String(it.name || it.item_name || it.title || 'Unknown');
        const qty = Number(it.quantity ?? it.qty ?? 0);
        const revenue = toCents(it.total_money ?? it.total ?? (it.price_money ?? it.price ?? 0) * qty);
        const k = name; // or `${it.sku || name}`
        if (!byItem[k]) byItem[k] = { name, qty: 0, revenueCents: 0 };
        byItem[k].qty += qty;
        byItem[k].revenueCents += revenue;
      }
    }

    const topItems = Object.values(byItem)
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5);

    res.json({
      source: 'pos_live',
      restaurantId,
      storeId: storeId || null,
      window: { startUTC: bounds.startUTC, endUTC: bounds.endUTC, mode: bounds.mode },
      count: salesOnly.length,
      grossCents,
      discountsCents,
      netCents: grossCents - discountsCents,
      payments,
      topItems,
      // helpful for debugging
      debug: { fetched: raw.length },
    });
  } catch (e: any) {
    console.error('[pos-live] error', e?.response?.status, e?.response?.data || e?.message);
    res.status(500).json({ error: 'pos_live_failed', detail: e?.message || String(e) });
  }
});

export default router;
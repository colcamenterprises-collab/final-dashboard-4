import express from 'express';
import axios from 'axios';

const router = express.Router();
const BASE = process.env.LOYVERSE_BASE_URL || 'https://api.loyverse.com/v1.0';
const TOKEN = process.env.LOYVERSE_API_TOKEN || process.env.LOYVERSE_ACCESS_TOKEN;
const STORE_ID = process.env.LOYVERSE_STORE_ID;

if (!TOKEN) console.warn('[pos-live] Missing Loyverse token');

const toCents = (v: any) => Math.round((Number(String(v).replace(/[^\d.-]/g, '')) || 0) * 100);

function bkkBounds() {
  const off = 7 * 3600_000;
  const now = Date.now();
  const endB = new Date(now); endB.setHours(3, 0, 0, 0);
  const startB = new Date(endB); startB.setDate(startB.getDate() - 1); startB.setHours(17, 0, 0, 0);
  return { from: new Date(startB.getTime() - off).toISOString(), to: new Date(endB.getTime() - off).toISOString() };
}

async function fetchReceipts(from: string, to: string, storeId?: string) {
  const cli = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${TOKEN}` }, timeout: 30000 });
  let page: string | null = null;
  const out: any[] = [];
  while (true) {
    const params: any = { created_at_min: from, created_at_max: to, limit: 250 };
    if (storeId) params.store_id = storeId;
    if (page) params.page_token = page;
    const r = await cli.get('/receipts', { params });
    const rec = r.data?.receipts || [];
    out.push(...rec);
    page = r.data?.next_page_token || null;
    if (!page || !rec.length) break;
  }
  return out;
}

router.get('/live-items', async (req, res) => {
  try {
    if (!TOKEN) return res.status(500).json({ error: 'missing_token' });
    const from = (req.query.from as string) || bkkBounds().from;
    const to   = (req.query.to as string)   || bkkBounds().to;
    const store = (req.query.storeId as string) || STORE_ID;

    const raw = await fetchReceipts(from, to, store);

    const sales = raw.filter((r: any) => {
      const neg = (r.total_money ?? r.total ?? 0) < 0;
      const type = String(r.status || r.type || '').toLowerCase();
      const voided = String(r.voided || r.is_void || '').toLowerCase() === 'true';
      return !neg && !type.includes('refund') && !voided;
    });

    const itemsMap = new Map<string, { name: string; sku?: string; qty: number; revenueCents: number }>();
    const modsMap  = new Map<string, { name: string; qty: number }>();

    for (const r of sales) {
      const items = Array.isArray(r.line_items) ? r.line_items : (Array.isArray(r.items) ? r.items : []);
      for (const it of items) {
        const name = String(it.name || it.item_name || it.title || 'Unknown');
        const sku  = it.sku || it.item_id || undefined;
        const qty  = Number(it.quantity ?? it.qty ?? 0);
        const rev  = toCents(it.total_money ?? it.total ?? (it.price_money ?? it.price ?? 0) * qty);
        const key  = sku ? sku : name;
        const cur  = itemsMap.get(key) || { name, sku, qty: 0, revenueCents: 0 };
        cur.qty += qty; cur.revenueCents += rev; itemsMap.set(key, cur);

        const mods = Array.isArray(it.modifiers) ? it.modifiers : (Array.isArray(it.option_modifiers) ? it.option_modifiers : []);
        for (const m of mods) {
          const mname = String(m.name || m.title || m.modifier_name || 'Modifier');
          const mqty  = Number(m.quantity ?? m.qty ?? 1) * qty;
          const cm = modsMap.get(mname) || { name: mname, qty: 0 };
          cm.qty += mqty; modsMap.set(mname, cm);
        }
      }
    }

    res.json({
      source: 'pos_live',
      window: { startUTC: from, endUTC: to },
      count: sales.length,
      items: Array.from(itemsMap.values()).sort((a, b) => b.revenueCents - a.revenueCents),
      modifiers: Array.from(modsMap.values()).sort((a, b) => b.qty - a.qty)
    });
  } catch (e: any) {
    console.error('[live-items]', e?.message || e);
    res.status(500).json({ error: 'live_items_failed', detail: String(e?.message || e) });
  }
});

export default router;
import express from 'express';
import fetch from 'node-fetch';
import { RECIPES, MODIFIERS, mapItemKey } from '../services/recipes/bom';

const router = express.Router();

// Reuse live-items (no DB)
router.get('/ingredient-usage', async (req, res) => {
  try {
    const base = req.protocol + '://' + req.get('host');
    const url  = new URL(base + '/api/pos/live-items');
    ['from','to','storeId'].forEach(k => { if (req.query[k]) url.searchParams.set(k, String(req.query[k])) });

    const r = await fetch(url.toString());
    if (!r.ok) throw new Error(`live-items ${r.status}`);
    const data: any = await r.json();

    const usage: Record<string, number> = {};
    
    // items → recipe
    for (const it of data.items as Array<{ name: string; sku?: string; qty: number }>) {
      const key = mapItemKey(it.name, it.sku);
      const rec = RECIPES.find(x => x.key === key);
      
      if (!rec) continue;
      for (const [ing, amt] of Object.entries(rec.ingredients)) {
        usage[ing] = (usage[ing] || 0) + (amt * it.qty);
      }
    }
    // modifiers → deltas
    for (const m of data.modifiers as Array<{ name: string; qty: number }>) {
      const mod = MODIFIERS.find(x => x.name.toLowerCase() === m.name.toLowerCase());
      if (!mod) continue;
      for (const [ing, delta] of Object.entries(mod.delta)) {
        usage[ing] = (usage[ing] || 0) + (delta * m.qty);
      }
    }

    res.json({ 
      source: 'pos_live', 
      window: data.window, 
      usage, 
      itemsCount: data.items.length, 
      receipts: data.count
    });
  } catch (e: any) {
    res.status(500).json({ error: 'usage_failed', detail: String(e?.message || e) });
  }
});

export default router;
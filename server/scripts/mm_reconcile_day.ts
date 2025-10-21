/* eslint-disable no-console */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse as parseCsv } from 'csv-parse/sync';
import fetch from 'node-fetch';

function loadCsv(p: string) {
  const raw = fs.readFileSync(p, 'utf8');
  return parseCsv(raw, { columns: true, skip_empty_lines: true });
}

function num(x: any) {
  if (x == null) return 0;
  const s = String(x).replace(/,/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const date = process.env.MM_DAY || process.argv[2];
  const csvPath = process.env.MM_CSV || process.argv[3];
  if (!date || !csvPath) {
    console.error('Usage: MM_DAY=YYYY-MM-DD MM_CSV=/path/to/file.csv tsx server/scripts/mm_reconcile_day.ts');
    process.exit(1);
  }

  const csv = loadCsv(csvPath);
  // Expect headers: SKU, Item, Category, Qty, Patties, Beef (g), Chicken (g), Rolls
  const posMap = new Map<string, { sku: string; name: string; qty: number }>();
  for (const r of csv) {
    const sku = String(r['SKU'] || '').trim();
    const name = String(r['Item'] || '').trim();
    if (!sku) continue;
    const qty = num(r['Qty']);
    posMap.set(sku, { sku, name, qty: (posMap.get(sku)?.qty ?? 0) + qty });
  }

  const api = await (await fetch(`http://localhost:5000/api/analysis/shift/items?date=${date}`)).json();
  const mm = new Map<string, { sku: string; name: string; qty: number }>();
  for (const it of api.items || []) {
    const sku = it.sku || '';
    if (!sku) continue; // compare only SKU rows
    const name = it.name;
    const qty = it.qty || 0;
    mm.set(sku, { sku, name, qty: (mm.get(sku)?.qty ?? 0) + qty });
  }

  const skus = new Set([...posMap.keys(), ...mm.keys()]);
  const rows = [];
  for (const sku of skus) {
    const p = posMap.get(sku);
    const m = mm.get(sku);
    const posQty = p?.qty ?? 0;
    const mmQty = m?.qty ?? 0;
    if (posQty !== mmQty) {
      rows.push({
        sku,
        posQty,
        mmQty,
        diff: mmQty - posQty,
        posName: p?.name ?? '',
        mmName: m?.name ?? ''
      });
    }
  }

  if (rows.length === 0) {
    console.log(`✅ ${date}: POS vs MM v1.0 match for all SKUs.`);
  } else {
    console.log(`⚠️ ${date}: Found ${rows.length} SKU differences:`);
    for (const r of rows.sort((a, b) => a.sku.localeCompare(b.sku))) {
      console.log(`${r.sku}\tPOS=${r.posQty}\tMM=${r.mmQty}\tΔ=${r.diff}\tPOS:"${r.posName}"  MM:"${r.mmName}"`);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

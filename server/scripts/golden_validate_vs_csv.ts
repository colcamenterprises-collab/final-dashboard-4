import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import fetch from 'node-fetch';

const SERVER = process.env.SERVER_URL || 'http://localhost:5000';
const DAY = process.env.GH_DAY || '2025-10-18';
const CSV = process.env.GH_CSV || path.resolve('item-sales-summary-2025-10-18-2025-10-18.csv');

const burgers = [
  { re:/single smash/i, patties:1, kind:'beef' },
  { re:/super double bacon/i, patties:2, kind:'beef' },
  { re:/triple smash/i, patties:3, kind:'beef' },
  { re:/ultimate double/i, patties:2, kind:'beef' },
  { re:/crispy chicken/i, patties:0, kind:'chicken' },
  { re:/karaage chicken/i, patties:0, kind:'chicken' },
  { re:/rooster|sriracha/i, patties:0, kind:'chicken' },
  { re:/smasho|grande chicken/i, patties:0, kind:'chicken' },
];

function match(name:string){ const n=name.toLowerCase(); return burgers.find(b=>b.re.test(n)); }

(async () => {
  const raw = fs.readFileSync(CSV, 'utf8');
  const recs = parse(raw, { columns: true, skip_empty_lines: true });
  let burgersSold=0, patties=0, chicken=0;
  for (const r of recs) {
    const name = r['Item name'] ?? r['item name'] ?? r['item_name'];
    const qty  = Number(r['Items sold'] ?? r['items sold'] ?? r['items_sold'] ?? 0);
    if (!name || !qty) continue;
    const m = match(String(name));
    if (!m) continue;
    burgersSold += qty;
    if (m.kind==='beef') patties += qty * m.patties;
    else chicken += qty * 100;
  }
  const red = patties * 95;
  console.log('POS CSV totals:', { burgers:burgersSold, patties, redMeatGrams:red, chickenGrams:chicken, rolls:burgersSold });

  const live = await (await fetch(`${SERVER}/api/receipts/shift/burgers?date=${DAY}&source=live`)).json();
  if (!live.ok) throw new Error('API live failed');
  console.log('API live totals:', live.data.totals);
})();

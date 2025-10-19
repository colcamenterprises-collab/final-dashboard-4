import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const INPUT_PATH = process.env.CATALOG_PATH || './Item and SKU List - Latest';
const DEFAULT_BURGER_CHICKEN_GRAMS = 100;

type Row = {
  SKU: string;
  'Item name'?: string; 
  Name?: string;
  Category?: string;
  Kind?: string;
  PattiesPer?: string;
  GramsPer?: string;
  RollsPer?: string;
};

function loadRows(p: string): Row[] {
  const ext = path.extname(p).toLowerCase();
  if (!fs.existsSync(p)) throw new Error(`Catalog file not found at: ${p}`);
  
  if (ext === '.csv') {
    const raw = fs.readFileSync(p, 'utf8');
    return parseCsv(raw, { columns: true, skip_empty_lines: true }) as Row[];
  }
  
  const wb = XLSX.read(fs.readFileSync(p));
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '' });
}

function normCategory(x?: string): 'burger'|'drink'|'side'|'modifier'|'bundle' {
  const v = (x || '').toLowerCase().trim();
  if (['burger','burgers'].includes(v)) return 'burger';
  if (['drink','drinks','beverage','beverages'].includes(v)) return 'drink';
  if (['side','sides'].includes(v)) return 'side';
  if (['modifier','modifiers','add-on','addon','add on'].includes(v)) return 'modifier';
  if (['bundle','deal','set','meal','combo','mix and match'].includes(v)) return 'bundle';
  return 'side';
}

function inferBurgerKind(name: string): 'beef'|'chicken'|null {
  const n = name.toLowerCase();
  if (/(chicken|karaage|rooster|grande|ไก่|คาราอาเกะ)/i.test(n)) return 'chicken';
  if (/burger|smash|double|triple|ซิงเกิ้ล|ดับเบิ้ล|ทริเปิล|คู่/i.test(n)) return 'beef';
  return null;
}

(async () => {
  const rows = loadRows(INPUT_PATH);
  console.log(`Loaded ${rows.length} catalog rows from: ${INPUT_PATH}`);

  let upserts = 0;
  for (const r of rows) {
    const sku = String(r.SKU || '').trim();
    const name = String(r['Item name'] ?? r.Name ?? '').trim();
    if (!sku || !name) continue;

    const category = normCategory(r.Category);
    let kind: 'beef'|'chicken'|null = r.Kind ? (r.Kind.toLowerCase() as any) : null;
    let patties = r.PattiesPer ? Number(r.PattiesPer) : null;
    let grams   = r.GramsPer ? Number(r.GramsPer) : null;
    const rolls = r.RollsPer ? Number(r.RollsPer) : 1;

    if (category === 'burger') {
      if (!kind) kind = inferBurgerKind(name);
      if (kind === 'chicken' && !grams) grams = DEFAULT_BURGER_CHICKEN_GRAMS;
      if (kind === 'beef' && !patties) {
        const n = name.toLowerCase();
        patties = /triple|สาม/i.test(n) ? 3 : /double|คู่/i.test(n) ? 2 : 1;
      }
    } else {
      kind = null; 
      patties = null; 
      grams = null;
    }

    await db.$executeRaw`
      INSERT INTO item_catalog (sku, name, category, kind, patties_per, grams_per, rolls_per)
      VALUES (${sku}, ${name}, ${category}, ${kind}, ${patties}, ${grams}, ${rolls})
      ON CONFLICT (sku)
      DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, kind=EXCLUDED.kind,
                    patties_per=EXCLUDED.patties_per, grams_per=EXCLUDED.grams_per,
                    rolls_per=EXCLUDED.rolls_per, updated_at=now()`;
    upserts++;
  }

  console.log(`Catalog upsert complete: ${upserts} items.`);
  await db.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

// server/scripts/backfillIngredientPurchasing.ts
import { db } from '../lib/prisma';
import dayjs from 'dayjs';
import * as modImport from '../data/foodCostings.js';
const mod: any = modImport;
const foodCostings: any[] = Array.isArray(mod?.foodCostings) ? mod.foodCostings : (Array.isArray(mod?.default) ? mod.default : []);

type Unit = 'kg'|'g'|'L'|'ml'|'each';

const prisma = db();

function parseCostTHB(raw?: string): number {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  return isFinite(n) ? n : 0;
}
function parsePackagingQty(raw?: string): { purchaseUnit: Unit, purchaseQty: number } {
  if (!raw) return { purchaseUnit: 'each', purchaseQty: 1 };
  const lower = String(raw).trim().toLowerCase();
  const multi = lower.match(/(\d+)\s*x\s*(\d*\.?\d+)\s*(kg|g|l|ml|each|pc|piece|pieces|unit|can|bottle)/);
  if (multi) {
    const packs = Number(multi[1]);
    const eachQty = Number(multi[2]);
    let u = multi[3];
    if (u === 'l') u = 'L';
    if (['pc','piece','pieces','unit','can','bottle','each'].includes(u)) return { purchaseUnit: 'each', purchaseQty: packs * eachQty };
    return { purchaseUnit: u as Unit, purchaseQty: packs * eachQty };
  }
  const per = lower.match(/per\s+(kg|g|l|ml|each|piece|pc|unit)/);
  if (per) {
    let u = per[1]; if (u === 'l') u = 'L'; if (['piece','pc','unit'].includes(u)) u = 'each';
    return { purchaseUnit: u as Unit, purchaseQty: 1 };
  }
  const simple = lower.match(/(\d*\.?\d+)\s*(kg|g|l|ml|each|piece|pc|unit)/);
  if (simple) {
    const qty = Number(simple[1]);
    let u = simple[2]; if (u === 'l') u = 'L'; if (['piece','pc','unit'].includes(u)) u = 'each';
    return { purchaseUnit: u as Unit, purchaseQty: qty };
  }
  return { purchaseUnit: 'each', purchaseQty: 1 };
}
function parsePortion(raw?: string) {
  if (!raw) return {};
  const m = String(raw).toLowerCase().match(/(\d*\.?\d+)\s*(g|gr|gram|kg|ml|l|each|piece|pc|unit)/);
  if (!m) return {};
  const qty = Number(m[1]);
  let u = m[2]; if (u === 'gr' || u === 'gram') u = 'g'; if (u === 'l') u = 'L';
  if (['piece','pc','unit'].includes(u)) u = 'each';
  if (u === 'kg') return { portionQty: qty * 1000, portionUnit: 'g' as const };
  return { portionQty: qty, portionUnit: u as Unit };
}
const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const ALSO_SET_PORTION_IF_MISSING = args.has('--portion');

async function upsertByName(item: any) {
  const name = (item.item || item.name || '').trim();
  if (!name) return { skip: true };
  const costTHB = parseCostTHB(item.cost);
  const { purchaseUnit, purchaseQty } = parsePackagingQty(item.packagingQty);
  const { portionQty, portionUnit } = parsePortion(item.averageMenuPortion);
  const lastReview = item.lastReviewDate ? dayjs(item.lastReviewDate, ['DD.MM.YY','DD/MM/YY','YYYY-MM-DD']).toDate() : null;

  const existing = await prisma.ingredientV2.findFirst({ where: { name } });
  if (!existing) {
    if (!APPLY) return { created: true, name, purchaseUnit, purchaseQty, packageCost: costTHB };
    const created = await prisma.ingredientV2.create({
      data: {
        name,
        category: item.category ?? null,
        brand: item.brand ?? null,
        supplier: item.supplier ?? null,
        purchaseUnit,
        purchaseQty: purchaseQty as any,
        packageCost: costTHB as any,
        portionUnit: ALSO_SET_PORTION_IF_MISSING ? (portionUnit ?? null) : null,
        portionQty: ALSO_SET_PORTION_IF_MISSING ? (portionQty as any ?? null) : null,
        lastReview: lastReview ?? undefined,
      }
    });
    await prisma.ingredientPriceV2.create({
      data: {
        ingredientId: created.id,
        effectiveFrom: new Date(),
        purchaseUnit,
        purchaseQty: purchaseQty as any,
        packageCost: costTHB as any,
      }
    });
    return { created: true, name };
  }

  // update only purchasing (and portions if missing + flag)
  const updates: any = {};
  let changed = false;

  if (String(existing.purchaseUnit) !== String(purchaseUnit)) { updates.purchaseUnit = purchaseUnit; changed = true; }
  if (Number(existing.purchaseQty) !== Number(purchaseQty))   { updates.purchaseQty = purchaseQty as any; changed = true; }
  if (Number(existing.packageCost) !== Number(costTHB))       { updates.packageCost = costTHB as any; changed = true; }

  if (ALSO_SET_PORTION_IF_MISSING) {
    if (!existing.portionUnit && portionUnit) { updates.portionUnit = portionUnit; changed = true; }
    if ((existing.portionQty == null || Number(existing.portionQty) === 0) && portionQty) {
      updates.portionQty = portionQty as any; changed = true;
    }
  }

  if (!changed) return { unchanged: true, name };

  if (!APPLY) return { updated: true, name, updates };

  const updated = await prisma.ingredientV2.update({
    where: { id: existing.id },
    data: {
      ...updates,
      lastReview: (lastReview && !isNaN(lastReview.getTime())) ? lastReview : (existing.lastReview ?? undefined),
      supplier: item.supplier ?? existing.supplier ?? undefined,
      brand: item.brand ?? existing.brand ?? undefined,
      category: item.category ?? existing.category ?? undefined,
    }
  });
  if (updates.packageCost != null) {
    await prisma.ingredientPriceV2.create({
      data: {
        ingredientId: updated.id,
        effectiveFrom: new Date(),
        purchaseUnit,
        purchaseQty: purchaseQty as any,
        packageCost: costTHB as any,
      }
    });
  }
  return { updated: true, name };
}

async function main() {
  if (!foodCostings || !Array.isArray(foodCostings) || foodCostings.length === 0) {
    console.error('ERROR: Could not load server/data/foodCostings.ts');
    process.exit(1);
  }
  let created = 0, updated = 0, unchanged = 0;
  for (const row of foodCostings) {
    const r = await upsertByName(row);
    if (!r) continue;
    if ((r as any).created) created++;
    else if ((r as any).updated) updated++;
    else if ((r as any).unchanged) unchanged++;
  }
  console.log(`Backfill ${APPLY ? 'APPLIED' : 'DRY-RUN'} — created:${created} updated:${updated} unchanged:${unchanged}`);
}
main().catch(e => (console.error(e), process.exit(1)));

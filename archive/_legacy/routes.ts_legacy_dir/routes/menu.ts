import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { parse as parseCSV } from "csv-parse/sync";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();
export const menuRouter = Router();

/** ---------- helpers ---------- **/
const n = (v: any) => {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/[^\d.\-]/g, "");
  const num = Number(s);
  return isFinite(num) ? num : 0;
};
const norm = (s?: string) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ");

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    if (obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  }
  return undefined;
}

/** map a generic row to MenuItem + modifiers */
function mapRow(row: any) {
  const name = String(pick(row, ["name", "item", "item name", "menu_item", "product"]) || "").trim();
  const category = pick(row, ["category", "group"]);
  const price = pick(row, ["price", "baseprice", "base_price", "amount", "list price"]);
  const description = pick(row, ["description", "desc", "item description", "long description"]);
  const externalId = pick(row, ["id", "sku", "external_id", "partner_id"]);

  // modifiers as JSON array or delimited
  let modifiersRaw =
    pick(row, ["modifiers", "modifier", "options"]) ||
    pick(row, ["variant", "variants"]);

  const modifiers: Array<{ name: string; price: number; groupName?: string }> = [];
  if (Array.isArray(modifiersRaw)) {
    for (const m of modifiersRaw) {
      if (!m) continue;
      const mname = String(m.name ?? m).trim();
      const mprice = n(m.price ?? 0);
      modifiers.push({ name: mname, price: mprice, groupName: m.group ?? undefined });
    }
  } else if (typeof modifiersRaw === "string") {
    // e.g. "Cheese:+15|Bacon:+25; Size:Large:+30,Small:+0"
    const groups = modifiersRaw.split(";"); // groups ;
    for (const g of groups) {
      const [gname, rest] = g.split(":");
      const items = (rest ?? gname).split(/[|,]/);
      for (const it of items) {
        const [mn, mp] = it.split(/[+]/);
        const mname = String(mn || "").trim();
        if (!mname) continue;
        modifiers.push({ name: mname, price: n(mp), groupName: rest ? gname?.trim() : undefined });
      }
    }
  }

  return {
    name,
    category: category ? String(category).trim() : null,
    basePrice: n(price),
    description: description ? String(description).trim() : null,
    externalId: externalId ? String(externalId).trim() : null,
    modifiers,
  };
}

/** ---------- import ---------- **/
/**
 * POST /api/menus/import
 * body: {
 *   name: string,
 *   source: 'house'|'pos'|'grab'|'foodpanda'|'other',
 *   filename: string,
 *   fileType?: 'csv'|'xlsx'|'json',
 *   text?: string   // CSV or JSON
 *   base64?: string // for xlsx if you prefer
 *   version?: string
 * }
 */
menuRouter.post("/import", async (req, res) => {
  try {
    const { name, source, filename, fileType, text, base64, version } = req.body || {};
    if (!name || !source) return res.status(400).json({ ok: false, error: "name/source required" });

    // parse rows
    let rows: any[] = [];

    const ft = (fileType || (filename?.split(".").pop() ?? "")).toLowerCase();

    if (ft === "csv") {
      if (!text) return res.status(400).json({ ok: false, error: "CSV text missing" });
      rows = parseCSV(text, { columns: true, skip_empty_lines: true, trim: true });
    } else if (ft === "json") {
      if (!text) return res.status(400).json({ ok: false, error: "JSON text missing" });
      const j = JSON.parse(text);
      rows = Array.isArray(j) ? j : j.rows ?? [];
    } else if (ft === "xlsx" || ft === "xls") {
      const b64 = base64 ?? text; // allow both
      if (!b64) return res.status(400).json({ ok: false, error: "XLSX base64 missing" });
      const buf = Buffer.from(b64, "base64");
      const wb = XLSX.read(buf, { type: "buffer" });
      const sh = wb.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], { raw: false });
    } else {
      return res.status(400).json({ ok: false, error: `Unsupported fileType ${ft}` });
    }

    const menu = await prisma.menuV2.create({
      data: { name, source, fileType: ft, version: version ?? null },
    });

    let imported = 0;
    for (const r of rows) {
      const mapped = mapRow(r);
      if (!mapped.name) continue;

      const item = await prisma.menuItemV2.create({
        data: {
          menuId: menu.id,
          externalId: mapped.externalId,
          name: mapped.name,
          category: mapped.category,
          basePrice: mapped.basePrice,
          description: mapped.description,
        },
      });
      if (mapped.modifiers?.length) {
        await prisma.menuModifierV2.createMany({
          data: mapped.modifiers.map((m) => ({
            itemId: item.id,
            name: m.name,
            price: m.price,
            groupName: m.groupName ?? null,
          })),
        });
      }
      imported++;
    }

    return res.json({ ok: true, menuId: menu.id, imported });
  } catch (e: any) {
    console.error("[/menus/import] error", e);
    return res.status(500).json({ ok: false, error: "Import failed" });
  }
});

/** ---------- list & details ---------- **/
menuRouter.get("/", async (_req, res) => {
  const menus = await prisma.menuV2.findMany({
    orderBy: { importedAt: "desc" },
    select: { id: true, name: true, source: true, fileType: true, importedAt: true, version: true },
  });
  res.json({ menus });
});

menuRouter.get("/:id/details", async (req, res) => {
  const m = await prisma.menuV2.findUnique({
    where: { id: String(req.params.id) },
    include: { items: { include: { modifiers: true } } },
  });
  if (!m) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ menu: m });
});

/** ---------- compare ---------- **/
/**
 * POST /api/menus/:id/compare
 * body: { otherMenuId: string }
 */
menuRouter.post("/:id/compare", async (req, res) => {
  const baseId = String(req.params.id);
  const otherId = String(req.body?.otherMenuId ?? "");
  if (!otherId) return res.status(400).json({ ok: false, error: "otherMenuId required" });

  const [A, B] = await Promise.all([
    prisma.menuV2.findUnique({ where: { id: baseId }, include: { items: { include: { modifiers: true } } } }),
    prisma.menuV2.findUnique({ where: { id: otherId }, include: { items: { include: { modifiers: true } } } }),
  ]);
  if (!A || !B) return res.status(404).json({ ok: false, error: "Menu not found" });

  const mapByName = (items: any[]) => {
    const m = new Map<string, any>();
    for (const it of items) m.set(norm(it.name), it);
    return m;
  };
  const a = mapByName(A.items);
  const b = mapByName(B.items);

  const missingInB: any[] = [];
  const missingInA: any[] = [];
  const priceMismatches: any[] = [];
  const descDiffs: any[] = [];

  // find missing + mismatches
  for (const [k, v] of a) {
    if (!b.has(k)) missingInB.push({ name: v.name, price: v.basePrice });
    else {
      const x = b.get(k);
      if (Number(v.basePrice) !== Number(x.basePrice)) {
        priceMismatches.push({ name: v.name, A: Number(v.basePrice), B: Number(x.basePrice) });
      }
      if ((v.description || "").trim() !== (x.description || "").trim()) {
        descDiffs.push({ name: v.name });
      }
    }
  }
  for (const [k, v] of b) if (!a.has(k)) missingInA.push({ name: v.name, price: v.basePrice });

  res.json({ ok: true, A: A.name, B: B.name, missingInB, missingInA, priceMismatches, descDiffs });
});

/** ---------- Chef Ramsay Review (heuristic, data-backed) ---------- **/
/**
 * POST /api/menus/:id/review
 * Uses IngredientV2 + RecipeV2 (if present) to suggest margin fixes, cuts, upsells, and promos.
 */
menuRouter.post("/:id/review", async (req, res) => {
  const menu = await prisma.menuV2.findUnique({
    where: { id: String(req.params.id) },
    include: { items: { include: { modifiers: true } } },
  });
  if (!menu) return res.status(404).json({ ok: false, error: "Menu not found" });

  // very simple linkage: match RecipeV2 by exact item name (can extend with aliases)
  const recipes = await prisma.recipeV2.findMany({
    include: { items: { include: { ingredient: true } } },
  });
  const recipeMap = new Map(recipes.map(r => [norm(r.name), r]));

  const findings: any[] = [];
  let promoIdeas: string[] = [];
  let costCuts: string[] = [];
  let upsells: string[] = [];

  for (const it of menu.items) {
    const r = recipeMap.get(norm(it.name));
    let foodCost = 0;
    if (r) {
      for (const ri of r.items) foodCost += Number(ri.qty) * Number(ri.ingredient.unitCost);
    }
    const price = Number(it.basePrice);
    const margin = price > 0 ? (price - foodCost) / price : 0;

    if (r) {
      if (margin < 0.55) {
        findings.push({ item: it.name, issue: "Low margin", price, foodCost, margin: +margin.toFixed(2) });
        costCuts.push(`Review portion/costs for ${it.name} (margin ${Math.round(margin*100)}%).`);
      } else if (margin > 0.80) {
        findings.push({ item: it.name, issue: "High margin", price, foodCost, margin: +margin.toFixed(2) });
      }
    } else {
      findings.push({ item: it.name, issue: "No cost model (RecipeV2 not found)" });
    }

    // simple upsell: if no modifiers, propose add-ons
    if (!it.modifiers?.length) {
      upsells.push(`Add modifiers to ${it.name} (cheese, bacon, double patty).`);
    }
    // simple promo: pair burgers with fries/drink combos
    if (/burger|smash/i.test(it.name)) {
      promoIdeas.push(`Create combo for ${it.name} + fries + drink at ~15% discount.`);
    }
  }

  // dedupe / trim
  promoIdeas = Array.from(new Set(promoIdeas)).slice(0, 10);
  costCuts = Array.from(new Set(costCuts)).slice(0, 10);
  upsells = Array.from(new Set(upsells)).slice(0, 10);

  res.json({
    ok: true,
    summary: {
      itemsReviewed: menu.items.length,
      lowMarginCount: findings.filter(f => f.issue === "Low margin").length,
      uncostedCount: findings.filter(f => f.issue.startsWith("No cost")).length,
    },
    findings,
    recommendations: {
      costCuts,
      promoIdeas,
      upsells,
      tone: "Direct and helpful — like Chef Ramsay, minus the shouting.",
    },
  });
});

/** ---------- mind map JSON (tree) ---------- **/
menuRouter.get("/:id/mindmap", async (req, res) => {
  const m = await prisma.menuV2.findUnique({
    where: { id: String(req.params.id) },
    include: { items: { include: { modifiers: true } } },
  });
  if (!m) return res.status(404).json({ ok: false, error: "Menu not found" });

  // Very simple tree structure
  const nodes = [
    { id: `menu:${m.id}`, label: m.name, type: "menu" },
    ...m.items.map(it => ({ id: `item:${it.id}`, label: it.name, type: "item" })),
    ...m.items.flatMap(it => it.modifiers.map(mm => ({
      id: `mod:${mm.id}`, label: `${mm.name} (+฿${Number(mm.price).toFixed(0)})`, type: "modifier", itemId: it.id
    }))),
  ];
  const edges = [
    ...m.items.map(it => ({ from: `menu:${m.id}`, to: `item:${it.id}` })),
    ...m.items.flatMap(it => it.modifiers.map(mm => ({ from: `item:${it.id}`, to: `mod:${mm.id}` }))),
  ];

  res.json({ ok: true, nodes, edges });
});

/** ---------- Delivery-partner Description Generator ---------- **/
/**
 * POST /api/menus/description/generate
 * body: { itemName, basePrice?, modifiers?:string[], tone?:'grab'|'foodpanda'|'default', maxLen?:number }
 */
menuRouter.post("/description/generate", async (req, res) => {
  const { itemName, basePrice, modifiers = [], tone = "default", maxLen = 220 } = req.body || {};
  if (!itemName) return res.status(400).json({ ok: false, error: "itemName required" });

  const base = String(itemName).trim();
  const upsell = modifiers?.length ? ` Add ${modifiers.slice(0,3).join(", ")}.` : "";
  const priceLine = basePrice ? ` Only ฿${Number(basePrice).toFixed(0)}.` : "";

  let desc = "";
  if (tone === "grab") {
    desc = `${base} — juicy, smash-seared, and stacked with flavor.${upsell}${priceLine}`;
  } else if (tone === "foodpanda") {
    desc = `${base}. Crowd-favorite with bold taste and quick prep.${upsell}${priceLine}`;
  } else {
    desc = `${base}: house recipe, cooked fresh for every order.${upsell}${priceLine}`;
  }

  // produce two sizes
  const short = desc.slice(0, Math.min(120, maxLen)).trim();
  const long = (desc + " Perfect with fries and a cold drink.").slice(0, maxLen).trim();

  res.json({ ok: true, short, long });
});
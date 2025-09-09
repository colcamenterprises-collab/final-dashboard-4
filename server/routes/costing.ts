import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { loadCatalogFromCSV } from "../lib/stockCatalog";

const prisma = new PrismaClient();
export const costingRouter = Router();

/** Helpers */
function cleanMoney(v: any) {
  if (v == null) return 0;
  // remove currency symbols, commas, spaces
  const s = String(v).replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
function norm(s?: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return undefined;
}

/**
 * CSV import:
 * We auto-detect common column names:
 *   name: ["name","item","ingredient","product"]
 *   unit: ["unit","unit measurement","uom"]
 *   unitCost: ["unitcost","cost","price","unit price","unit_price"]
 *   supplier: ["supplier","brand","vendor"]
 *
 * Body: { csv: "raw text" }
 */
costingRouter.post("/ingredients/import", async (req, res) => {
  try {
    const csv = req.body?.csv as string;
    if (!csv) return res.status(400).json({ ok: false, error: "CSV missing" });

    const rows: any[] = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let imported = 0;

    for (const r of rows) {
      // flexible column mapping
      const nameRaw = pick(r, ["name", "item", "ingredient", "product"]);
      const unitRaw = pick(r, ["unit", "unit measurement", "uom"]);
      const costRaw = pick(r, ["unitcost", "cost", "price", "unit price", "unit_price"]);
      const supplierRaw = pick(r, ["supplier", "brand", "vendor"]);

      const name = String(nameRaw || "").trim();
      if (!name) continue;

      let unit = String(unitRaw || "").trim() || "unit";
      // normalize common units like "kg", "g", "ml", "piece"
      const u = norm(unit);
      if (u.includes("kg")) unit = "kg";
      else if (u === "g" || u.includes("gram")) unit = "g";
      else if (u.includes("ml")) unit = "ml";
      else if (u.includes("pcs") || u.includes("piece")) unit = "pc";

      const unitCost = cleanMoney(costRaw);
      const supplier = supplierRaw ? String(supplierRaw).trim() : null;

      await prisma.ingredientV2.upsert({
        where: { name },
        update: { unit, unitCost, supplier },
        create: { name, unit, unitCost, supplier },
      });
      imported++;
    }

    return res.json({ ok: true, imported });
  } catch (err: any) {
    console.error("[ingredients/import] failed:", err);
    return res.status(500).json({ ok: false, error: "Import failed" });
  }
});

// /api/costing/ingredients - CSV-driven ingredient data with proper format
costingRouter.get("/ingredients", async (req: Request, res: Response) => {
  try {
    const catalogItems = loadCatalogFromCSV();
    
    // Transform catalog items to match frontend expectations
    const ingredients = catalogItems.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.raw?.averageMenuPortion || "each",
      cost: parseFloat(item.raw?.cost?.replace(/[฿,]/g, '') || "0") || 0,
      supplier: item.raw?.supplier || "Unknown",
      brand: item.raw?.brand || "",
      packageSize: item.raw?.packagingQty || "",
      portionSize: item.raw?.averageMenuPortion || "",
      lastReview: item.raw?.lastReviewDate || "",
      portions: 1  // Default portions for compatibility
    }));

    console.log(`[costing/ingredients] Returning ${ingredients.length} ingredients across categories:`,
      [...new Set(ingredients.map(i => i.category))].join(", "));

    res.json({ list: ingredients });
  } catch (err) {
    console.error('[costing/ingredients] Error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load ingredients' });
  }
});

costingRouter.post("/recipes", async (req, res) => {
  const { name, yield: yl = 1, targetMargin = 0, items = [] } = req.body || {};
  const recipe = await prisma.recipeV2.upsert({
    where: { name },
    update: {
      yield: Number(yl), targetMargin: Number(targetMargin),
      items: { deleteMany: {}, create: items.map((i: any) => ({ ingredientId: i.ingredientId, qty: Number(i.qty || 0) })) }
    },
    create: {
      name, yield: Number(yl), targetMargin: Number(targetMargin),
      items: { create: items.map((i: any) => ({ ingredientId: i.ingredientId, qty: Number(i.qty || 0) })) }
    },
    include: { items: { include: { ingredient: true } } }
  });
  res.json({ recipe });
});

costingRouter.get("/recipes/:name/calc", async (req, res) => {
  const recipe = await prisma.recipeV2.findUnique({
    where: { name: String(req.params.name) },
    include: { items: { include: { ingredient: true } } }
  });
  if (!recipe) return res.status(404).send("Not found");
  const totalCost = recipe.items.reduce((s, it) => s + Number(it.qty) * Number(it.ingredient.unitCost), 0);
  const costPerServe = totalCost / Number(recipe.yield || 1);
  const m = Number(recipe.targetMargin || 0);
  const suggestedPrice = m > 0 ? costPerServe / (1 - m) : costPerServe;
  res.json({
    name: recipe.name, yield: recipe.yield, targetMargin: m, totalCost, costPerServe, suggestedPrice,
    lines: recipe.items.map(it => ({
      ingredient: it.ingredient.name, unit: it.ingredient.unit, qty: it.qty,
      unitCost: it.ingredient.unitCost, lineCost: Number(it.qty) * Number(it.ingredient.unitCost)
    }))
  });
});
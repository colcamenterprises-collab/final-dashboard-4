import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();
export const costingRouter = Router();

// CSV import (name,unit,unitCost,supplier)
costingRouter.post("/ingredients/import", async (req, res) => {
  const csv = req.body?.csv as string;
  if (!csv) return res.status(400).send("CSV missing");
  const rows: any[] = parse(csv, { columns: true, trim: true, skip_empty_lines: true });
  for (const r of rows) {
    const name = (r.name || "").trim();
    if (!name) continue;
    await prisma.ingredientV2.upsert({
      where: { name },
      update: { unit: r.unit || "g", unitCost: Number(r.unitCost || 0), supplier: r.supplier || null },
      create: { name, unit: r.unit || "g", unitCost: Number(r.unitCost || 0), supplier: r.supplier || null }
    });
  }
  res.json({ ok: true, count: rows.length });
});

costingRouter.get("/ingredients", async (_req, res) => {
  const list = await prisma.ingredientV2.findMany({ orderBy: { name: "asc" } });
  res.json({ list });
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
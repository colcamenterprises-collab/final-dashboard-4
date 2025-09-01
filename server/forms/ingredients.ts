// Do not do this:
// – Do not rename, move, or split this file
// – Do not drop or recreate the ingredients table
// – Only apply exactly what is written below

import { Request, Response } from "express";
import { pool } from "../db";
import csvParser from "csv-parser";
import fs from "fs";

// Helper functions
const toCents = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
};

// CSV Upload → bulk update Ingredients
export async function uploadIngredientsCSV(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });

    const rows: any[] = [];
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on("data", (row) => rows.push(row))
      .on("end", async () => {
        for (const r of rows) {
          const name = r["Item"]?.trim();
          const category = r["Category"]?.trim() || "Uncategorized";
          const unit = r["Unit"]?.trim() || "";
          const packageCost = toCents(parseFloat(r["Package Price"] || "0"));

          if (!name) continue;

          await pool.query(
            `INSERT INTO ingredients (name, category, unit, package_cost)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (name) DO UPDATE SET
               category = EXCLUDED.category,
               unit = EXCLUDED.unit,
               package_cost = EXCLUDED.package_cost`,
            [name, category, unit, packageCost]
          );
        }
        res.json({ ok: true, updated: rows.length });
      });
  } catch (err) {
    console.error("CSV upload error", err);
    res.status(500).json({ ok: false, error: "Failed to upload CSV" });
  }
}

// Shopping List by Date
export async function getShoppingListByDate(req: Request, res: Response) {
  try {
    const { date } = req.params;
    const result = await pool.query(
      `SELECT payload FROM daily_sales_v2 WHERE DATE("createdAt") = $1 LIMIT 1`,
      [date]
    );

    if (result.rows.length === 0) {
      return res.json({ ok: true, items: [] });
    }

    const p = result.rows[0].payload || {};
    const requisition = (p.requisition || []).filter((i: any) => (i.qty || 0) > 0);

    const items: any[] = [];
    for (const r of requisition) {
      const ingredientRes = await pool.query(
        `SELECT package_cost, category, unit FROM ingredients WHERE name = $1 LIMIT 1`,
        [r.name]
      );
      const ingredient = ingredientRes.rows[0] || {};
      const cost = (ingredient.package_cost || 0) * (r.qty || 0);
      items.push({
        name: r.name,
        qty: r.qty,
        unit: r.unit || ingredient.unit || "",
        category: ingredient.category || "Uncategorized",
        cost,
      });
    }

    res.json({ ok: true, items });
  } catch (err) {
    console.error("Shopping list fetch error", err);
    res.status(500).json({ ok: false, error: "Failed to fetch shopping list" });
  }
}
import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.post("/save", async (req, res) => {
  try {
    const { recipeName, note, wastePct, portions, menuPrice, lines, totals, description } = req.body || {};
    if (!recipeName || !Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ error: "Recipe name and at least one ingredient required." });
    }

    // Check if recipes table exists, if not create it
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        note TEXT,
        waste_pct NUMERIC DEFAULT 0,
        portions INT DEFAULT 1,
        menu_price_thb NUMERIC DEFAULT 0,
        totals_json JSONB,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS recipe_lines (
        id BIGSERIAL PRIMARY KEY,
        recipe_id BIGINT REFERENCES recipes(id) ON DELETE CASCADE,
        ingredient_id TEXT,
        ingredient_name TEXT NOT NULL,
        qty NUMERIC NOT NULL DEFAULT 0,
        unit TEXT NOT NULL,
        unit_cost_thb NUMERIC NOT NULL DEFAULT 0,
        cost_thb NUMERIC NOT NULL DEFAULT 0,
        supplier TEXT
      )
    `);

    // Insert recipe
    const { rows } = await pool.query(
      `INSERT INTO recipes (name, note, waste_pct, portions, menu_price_thb, totals_json, description, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now()) RETURNING id`,
      [recipeName, note||"", wastePct||0, portions||1, menuPrice||0, JSON.stringify(totals||{}), description||""]
    );
    const recipeId = rows[0].id;

    // Insert recipe lines
    const values:any[] = [];
    const vals = lines.map((l:any, i:number)=>{
      values.push(recipeId, l.ingredientId, l.name, l.qty, l.unit, l.unitCostTHB, l.costTHB, l.supplier||"");
      const p = i*8;
      return `($${p+1}, $${p+2}, $${p+3}, $${p+4}, $${p+5}, $${p+6}, $${p+7}, $${p+8})`;
    }).join(",");

    await pool.query(
      `INSERT INTO recipe_lines (recipe_id, ingredient_id, ingredient_name, qty, unit, unit_cost_thb, cost_thb, supplier) VALUES ${vals}`,
      values
    );

    res.json({ ok:true, id: recipeId });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ error: e.message || "Failed to save" });
  }
});

export default router;
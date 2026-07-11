import { Router } from "express";
import { pool } from "../db";

const router = Router();

async function ensureSchema() {
  if (!pool) throw new Error("Database unavailable");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipes (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Uncategorised',
      description TEXT,
      image_url TEXT,
      yield_quantity NUMERIC NOT NULL DEFAULT 1,
      yield_unit TEXT NOT NULL DEFAULT 'servings',
      prep_time_minutes INTEGER NOT NULL DEFAULT 0,
      cook_time_minutes INTEGER NOT NULL DEFAULT 0,
      difficulty TEXT NOT NULL DEFAULT 'Standard',
      ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT,
      total_cost NUMERIC NOT NULL DEFAULT 0,
      cost_per_serving NUMERIC NOT NULL DEFAULT 0,
      selling_price NUMERIC,
      suggested_price NUMERIC,
      food_cost_percent NUMERIC,
      delivery_food_cost_percent NUMERIC,
      status TEXT NOT NULL DEFAULT 'Draft',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const additions = [
    ["category", "TEXT NOT NULL DEFAULT 'Uncategorised'"],
    ["description", "TEXT"],
    ["image_url", "TEXT"],
    ["yield_quantity", "NUMERIC NOT NULL DEFAULT 1"],
    ["yield_unit", "TEXT NOT NULL DEFAULT 'servings'"],
    ["prep_time_minutes", "INTEGER NOT NULL DEFAULT 0"],
    ["cook_time_minutes", "INTEGER NOT NULL DEFAULT 0"],
    ["difficulty", "TEXT NOT NULL DEFAULT 'Standard'"],
    ["ingredients", "JSONB NOT NULL DEFAULT '[]'::jsonb"],
    ["steps", "JSONB NOT NULL DEFAULT '[]'::jsonb"],
    ["notes", "TEXT"],
    ["total_cost", "NUMERIC NOT NULL DEFAULT 0"],
    ["cost_per_serving", "NUMERIC NOT NULL DEFAULT 0"],
    ["selling_price", "NUMERIC"],
    ["suggested_price", "NUMERIC"],
    ["food_cost_percent", "NUMERIC"],
    ["delivery_food_cost_percent", "NUMERIC"],
    ["status", "TEXT NOT NULL DEFAULT 'Draft'"],
    ["version", "INTEGER NOT NULL DEFAULT 1"],
    ["created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"],
    ["updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"],
  ];
  for (const [column, definition] of additions) {
    await pool.query(`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  }
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normaliseIngredient(row: any, index: number) {
  const quantity = Math.max(0, Number(row?.quantity || 0));
  const unitCost = Math.max(0, Number(row?.unitCost || 0));
  return {
    id: String(row?.id || `ingredient-${index + 1}`),
    name: String(row?.name || "").trim(),
    quantity,
    unit: String(row?.unit || "g").trim(),
    unitCost,
    lineCost: Number((quantity * unitCost).toFixed(4)),
    notes: String(row?.notes || "").trim(),
  };
}

function normaliseStep(row: any, index: number) {
  return {
    id: String(row?.id || `step-${index + 1}`),
    title: String(row?.title || `Step ${index + 1}`).trim(),
    instruction: String(row?.instruction || "").trim(),
    timerMinutes: Math.max(0, Number(row?.timerMinutes || 0)),
    imageUrl: row?.imageUrl ? String(row.imageUrl) : null,
  };
}

function calculate(body: any) {
  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients.map(normaliseIngredient).filter((row: any) => row.name)
    : [];
  const steps = Array.isArray(body.steps)
    ? body.steps.map(normaliseStep).filter((row: any) => row.instruction)
    : [];
  const yieldQuantity = Math.max(0.0001, Number(body.yieldQuantity || 1));
  const totalCost = Number(ingredients.reduce((sum: number, row: any) => sum + row.lineCost, 0).toFixed(4));
  const costPerServing = Number((totalCost / yieldQuantity).toFixed(4));
  const restaurantPrice = numberOrNull(body.sellingPrice);
  const deliveryPrice = numberOrNull(body.suggestedPrice);
  const foodCostPercent = restaurantPrice && restaurantPrice > 0 ? Number(((costPerServing / restaurantPrice) * 100).toFixed(2)) : null;
  const deliveryFoodCostPercent = deliveryPrice && deliveryPrice > 0 ? Number(((costPerServing / deliveryPrice) * 100).toFixed(2)) : null;
  return { ingredients, steps, yieldQuantity, totalCost, costPerServing, restaurantPrice, deliveryPrice, foodCostPercent, deliveryFoodCostPercent };
}

const selectSql = `
  SELECT id, name, category, description,
         image_url AS "imageUrl",
         yield_quantity AS "yieldQuantity",
         yield_unit AS "yieldUnit",
         prep_time_minutes AS "prepTimeMinutes",
         cook_time_minutes AS "cookTimeMinutes",
         difficulty, ingredients, steps, notes,
         total_cost AS "totalCost",
         cost_per_serving AS "costPerServing",
         selling_price AS "sellingPrice",
         suggested_price AS "suggestedPrice",
         food_cost_percent AS "foodCostPercent",
         delivery_food_cost_percent AS "deliveryFoodCostPercent",
         status, version,
         created_at AS "createdAt",
         updated_at AS "updatedAt"
  FROM recipes
`;

router.get("/", async (req, res) => {
  try {
    await ensureSchema();
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const values: any[] = [];
    const where: string[] = [];
    if (search) {
      values.push(`%${search}%`);
      where.push(`(name ILIKE $${values.length} OR category ILIKE $${values.length} OR COALESCE(description, '') ILIKE $${values.length})`);
    }
    if (status && status !== "All") {
      values.push(status);
      where.push(`status = $${values.length}`);
    }
    const result = await pool.query(`${selectSql} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC, name ASC`, values);
    res.json(result.rows);
  } catch (error: any) {
    console.error("[RECIPE_STUDIO_LIST_FAILED]", error);
    res.status(500).json({ error: error.message || "Unable to load recipes" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid recipe id" });
    const result = await pool.query(`${selectSql} WHERE id = $1 LIMIT 1`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: "Recipe not found" });
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to load recipe" });
  }
});

router.post("/", async (req, res) => {
  try {
    await ensureSchema();
    if (!String(req.body?.name || "").trim()) return res.status(400).json({ error: "Recipe name is required" });
    const c = calculate(req.body);
    const result = await pool.query(`
      INSERT INTO recipes (
        name, category, description, image_url, yield_quantity, yield_unit,
        prep_time_minutes, cook_time_minutes, difficulty, ingredients, steps, notes,
        total_cost, cost_per_serving, selling_price, suggested_price,
        food_cost_percent, delivery_food_cost_percent, status, version, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,1,NOW())
      RETURNING id
    `, [
      String(req.body.name).trim(), String(req.body.category || "Uncategorised").trim(), req.body.description || null,
      req.body.imageUrl || null, c.yieldQuantity, String(req.body.yieldUnit || "servings"),
      Math.max(0, Number(req.body.prepTimeMinutes || 0)), Math.max(0, Number(req.body.cookTimeMinutes || 0)),
      String(req.body.difficulty || "Standard"), JSON.stringify(c.ingredients), JSON.stringify(c.steps), req.body.notes || null,
      c.totalCost, c.costPerServing, c.restaurantPrice, c.deliveryPrice, c.foodCostPercent, c.deliveryFoodCostPercent,
      String(req.body.status || "Draft")
    ]);
    const created = await pool.query(`${selectSql} WHERE id = $1`, [result.rows[0].id]);
    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error("[RECIPE_STUDIO_CREATE_FAILED]", error);
    res.status(500).json({ error: error.message || "Unable to create recipe" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid recipe id" });
    if (!String(req.body?.name || "").trim()) return res.status(400).json({ error: "Recipe name is required" });
    const c = calculate(req.body);
    const result = await pool.query(`
      UPDATE recipes SET
        name=$2, category=$3, description=$4, image_url=$5, yield_quantity=$6, yield_unit=$7,
        prep_time_minutes=$8, cook_time_minutes=$9, difficulty=$10, ingredients=$11::jsonb, steps=$12::jsonb,
        notes=$13, total_cost=$14, cost_per_serving=$15, selling_price=$16, suggested_price=$17,
        food_cost_percent=$18, delivery_food_cost_percent=$19, status=$20, version=COALESCE(version,1)+1, updated_at=NOW()
      WHERE id=$1 RETURNING id
    `, [
      id, String(req.body.name).trim(), String(req.body.category || "Uncategorised").trim(), req.body.description || null,
      req.body.imageUrl || null, c.yieldQuantity, String(req.body.yieldUnit || "servings"),
      Math.max(0, Number(req.body.prepTimeMinutes || 0)), Math.max(0, Number(req.body.cookTimeMinutes || 0)),
      String(req.body.difficulty || "Standard"), JSON.stringify(c.ingredients), JSON.stringify(c.steps), req.body.notes || null,
      c.totalCost, c.costPerServing, c.restaurantPrice, c.deliveryPrice, c.foodCostPercent, c.deliveryFoodCostPercent,
      String(req.body.status || "Draft")
    ]);
    if (!result.rows.length) return res.status(404).json({ error: "Recipe not found" });
    const updated = await pool.query(`${selectSql} WHERE id = $1`, [id]);
    res.json(updated.rows[0]);
  } catch (error: any) {
    console.error("[RECIPE_STUDIO_UPDATE_FAILED]", error);
    res.status(500).json({ error: error.message || "Unable to update recipe" });
  }
});

router.post("/:id/duplicate", async (req, res) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id);
    const source = await pool.query(`${selectSql} WHERE id = $1`, [id]);
    if (!source.rows.length) return res.status(404).json({ error: "Recipe not found" });
    const r = source.rows[0];
    const created = await pool.query(`
      INSERT INTO recipes (name, category, description, image_url, yield_quantity, yield_unit, prep_time_minutes,
        cook_time_minutes, difficulty, ingredients, steps, notes, total_cost, cost_per_serving, selling_price,
        suggested_price, food_cost_percent, delivery_food_cost_percent, status, version, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,'Draft',1,NOW()) RETURNING id
    `, [`${r.name} Copy`, r.category, r.description, r.imageUrl, r.yieldQuantity, r.yieldUnit, r.prepTimeMinutes,
      r.cookTimeMinutes, r.difficulty, JSON.stringify(r.ingredients || []), JSON.stringify(r.steps || []), r.notes,
      r.totalCost, r.costPerServing, r.sellingPrice, r.suggestedPrice, r.foodCostPercent, r.deliveryFoodCostPercent]);
    const copy = await pool.query(`${selectSql} WHERE id = $1`, [created.rows[0].id]);
    res.status(201).json(copy.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to duplicate recipe" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id);
    const result = await pool.query(`UPDATE recipes SET status='Archived', updated_at=NOW() WHERE id=$1 RETURNING id`, [id]);
    if (!result.rows.length) return res.status(404).json({ error: "Recipe not found" });
    res.json({ ok: true, id, status: "Archived" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Unable to archive recipe" });
  }
});

export default router;

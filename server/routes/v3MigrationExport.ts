import { Router } from "express";
import { pool } from "../db";
import { requireSessionAuth } from "../middleware/sessionAuth";

const router = Router();
router.use(requireSessionAuth);

const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csv = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";

function sendCsv(res: any, name: string, headers: string[], rows: unknown[][]) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="sbb-${name}.csv"`);
  res.send(csv(headers, rows));
}

router.get("/menu.csv", async (_req, res) => {
  try {
    const result = await pool!.query(`
      SELECT i.id, i.name_en AS name, i.description_en AS description, c.name_en AS category,
             COALESCE(i.direct_price,i.price) AS direct_price,
             COALESCE(i.grab_price,i.direct_price,i.price) AS delivery_partner_price,
             i.image_url, i.is_active
      FROM ordering_menu_items i
      JOIN ordering_menu_categories c ON c.id=i.category_id
      ORDER BY c.sort_order, i.sort_order, i.name_en
    `);
    sendCsv(res, "menu", ["external_id","name","description","category","direct_price","delivery_partner_price","sku","image_url","availability"],
      result.rows.map((r: any) => [r.id,r.name,r.description,r.category,r.direct_price,r.delivery_partner_price,"",r.image_url,r.is_active]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/modifiers.csv", async (_req, res) => {
  try {
    const result = await pool!.query(`
      SELECT m.id, g.name_en AS group_name, m.name_en AS name, i.name_en AS product_name, m.price_delta,
             COALESCE(g.min_selections,0) AS min_select, g.max_selections AS max_select,
             (COALESCE(g.min_selections,0) > 0) AS is_required
      FROM ordering_item_modifiers m
      JOIN ordering_modifier_groups g ON g.id=m.modifier_group_id
      JOIN ordering_modifier_group_items a ON a.modifier_group_id=g.id
      JOIN ordering_menu_items i ON i.id=a.menu_item_id
      ORDER BY i.name_en, g.sort_order, m.sort_order, m.name_en
    `);
    sendCsv(res, "modifiers", ["external_id","group_name","name","menu_item","price_adjustment","min_select","max_select","required"],
      result.rows.map((r: any) => [r.id,r.group_name,r.name,r.product_name,r.price_delta,r.min_select,r.max_select,r.is_required]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/recipes-costings.csv", async (_req, res) => {
  try {
    const result = await pool!.query(`
      SELECT r.id, r.name, r.yield_quantity, r.yield_unit, r.total_cost, r.cost_per_serving,
             r.ingredients, mi.name AS menu_item
      FROM recipes r
      LEFT JOIN menu_item_recipe mir ON mir.recipe_id=r.id
      LEFT JOIN menu_item_v3 mi ON mi.id=mir.menu_item_id
      ORDER BY r.name
    `);
    const rows: unknown[][] = [];
    for (const r of result.rows as any[]) {
      const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
      if (!ingredients.length) {
        rows.push([r.id,r.name,r.menu_item,"","","",r.yield_quantity,r.yield_unit,r.total_cost,r.cost_per_serving]);
        continue;
      }
      for (const ingredient of ingredients) {
        rows.push([
          r.id,r.name,r.menu_item,
          ingredient.name ?? ingredient.ingredientName ?? "",
          ingredient.quantityUsed ?? ingredient.quantity ?? ingredient.qty ?? ingredient.amount ?? "",
          ingredient.unitUsed ?? ingredient.unit ?? ingredient.purchaseUnit ?? "",
          r.yield_quantity,r.yield_unit,
          ingredient.purchaseCost ?? ingredient.packCost ?? r.total_cost ?? "",
          r.cost_per_serving,
        ]);
      }
    }
    sendCsv(res, "recipes-costings",
      ["external_id","recipe_name","menu_item","ingredient","quantity","unit","yield_quantity","yield_unit","ingredient_cost","cost_per_serving"], rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/expenses.csv", async (_req, res) => {
  try {
    const result = await pool!.query(`
      SELECT e.id, e.date, COALESCE(t.name,e.type_id) AS category, e.label,
             COALESCE(s.name,e.supplier_id) AS supplier, e.amount, e.method, e.reference, e.category_note
      FROM expense_entry e
      LEFT JOIN expense_type_lkp t ON t.id=e.type_id
      LEFT JOIN supplier_lkp s ON s.id=e.supplier_id
      ORDER BY e.date, e.created_at
    `);
    sendCsv(res, "expenses", ["external_id","date","category","description","supplier","amount","payment_method","reference","notes"],
      result.rows.map((r: any) => [r.id,r.date?.toISOString?.() ?? r.date,r.category,r.label,r.supplier,r.amount,r.method,r.reference,r.category_note]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/purchasing.csv", async (_req, res) => {
  try {
    const result = await pool!.query(`
      SELECT id, item, category, COALESCE("supplierName",supplier) AS supplier, brand,
             "supplierSku" AS supplier_sku, COALESCE(base_unit,"orderUnit") AS order_unit,
             COALESCE(purchase_cost_thb,pack_cost,"unitCost") AS unit_price,
             COALESCE(purchase_quantity,purchase_unit_qty) AS purchase_unit_qty,
             purchase_unit_label, active
      FROM purchasing_items ORDER BY category NULLS LAST, item
    `);
    sendCsv(res, "purchasing", ["external_id","item","category","supplier","brand","supplier_sku","unit","unit_price","pack_quantity","pack_description","status"],
      result.rows.map((r: any) => [r.id,r.item,r.category,r.supplier,r.brand,r.supplier_sku,r.order_unit,r.unit_price,r.purchase_unit_qty,r.purchase_unit_label,r.active ? "active" : "inactive"]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/manifest", (_req, res) => res.json({
  format: "customli-standard-csv",
  source: "SBB Dashboard",
  datasets: ["menu","modifiers","recipes-costings","expenses","purchasing"],
  note: "These are standard customer CSV exports. Upload them through Customli V3 Import Data and review the column mapping before commit."
}));

export default router;

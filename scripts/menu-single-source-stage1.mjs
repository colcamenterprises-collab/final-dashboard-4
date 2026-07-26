import fs from "node:fs";

const path = "server/routes/pos.ts";
const source = fs.readFileSync(path, "utf8");
let next = source;

function replaceRequired(search, replacement, label) {
  if (next.includes(replacement)) return;
  if (!next.includes(search)) throw new Error(`Could not apply ${label}: source block not found`);
  next = next.replace(search, replacement);
}

replaceRequired(
  'import { getPinSessionUser } from "./pinAuth";',
  'import { getPinSessionUser } from "./pinAuth";\nimport { getAllCategories } from "../services/menu/categoryService";\nimport { getAllItems, createItem, updateItem } from "../services/menu/itemService";',
  "canonical menu service imports",
);

replaceRequired(
  `// The POS catalogue is the current menu source of truth.  It intentionally
// reads/writes ordering_* tables and does not depend on the unfinished Menu V3.`,
  `// Menu V3 services are the canonical menu write path. The legacy POS catalogue
// endpoints remain as compatibility aliases, but they now delegate to the same
// services used by Menu > Products so product edits cannot diverge.`,
  "source-of-truth comment",
);

const oldCatalog = `router.get("/catalog", staffDevice, async (_req, res) => {
  try {
    const [categories, items] = await Promise.all([
      db().query(\`SELECT id, name_en, name_th, sort_order, is_active FROM ordering_menu_categories ORDER BY sort_order, name_en\`),
      db().query(\`SELECT i.*, c.name_en AS category_name FROM ordering_menu_items i JOIN ordering_menu_categories c ON c.id = i.category_id ORDER BY c.sort_order, i.sort_order, i.name_en\`),
    ]);
    res.json({ ok: true, source: "sbb_pos_core", categories: categories.rows, items: items.rows });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});`;

const newCatalog = `router.get("/catalog", staffDevice, async (_req, res) => {
  try {
    const [categories, items] = await Promise.all([getAllCategories(), getAllItems()]);
    res.json({
      ok: true,
      source: "menu_v3_canonical",
      deprecated: true,
      replacement: "/api/menu-v3/items",
      categories,
      items,
    });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});`;
replaceRequired(oldCatalog, newCatalog, "legacy catalogue read delegation");

const oldCreate = `router.post("/catalog/items", staffDevice, async (req, res) => {
  const { category_id, name_en, description_en, price, direct_price, grab_price, image_url, sort_order } = req.body || {};
  if (!category_id || !String(name_en || "").trim()) return fail(res, "Category and item name are required");
  const amount = Number(price ?? direct_price ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return fail(res, "A valid price is required");
  try {
    const created = await db().query(
      \`INSERT INTO ordering_menu_items(category_id, name_en, description_en, price, direct_price, grab_price, image_url, is_active, is_sold_out, pos_enabled, sort_order)
       VALUES($1,$2,$3,$4,$5,$6,$7,true,false,true,$8) RETURNING *\`,
      [category_id, String(name_en).trim(), description_en || null, amount, Number(direct_price ?? amount), Number(grab_price ?? amount), image_url || null, Number(sort_order ?? 0)],
    );
    res.status(201).json({ ok: true, item: created.rows[0] });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});`;

const newCreate = `router.post("/catalog/items", staffDevice, async (req, res) => {
  try {
    const item = await createItem(req.body || {});
    res.status(201).json({
      ok: true,
      source: "menu_v3_canonical",
      deprecated: true,
      replacement: "/api/menu-v3/items/create",
      item,
    });
  } catch (e: any) {
    fail(res, e.message, 400);
  }
});`;
replaceRequired(oldCreate, newCreate, "legacy catalogue create delegation");

const oldUpdate = `router.patch("/catalog/items/:id", staffDevice, async (req, res) => {
  const { category_id, name_en, description_en, price, direct_price, grab_price, image_url, is_active, is_sold_out, pos_enabled, sort_order } = req.body || {};
  try {
    const updated = await db().query(
      \`UPDATE ordering_menu_items SET
        category_id=COALESCE($2, category_id), name_en=COALESCE($3, name_en), description_en=$4,
        price=COALESCE($5, price), direct_price=COALESCE($6, direct_price), grab_price=COALESCE($7, grab_price),
        image_url=$8, is_active=COALESCE($9, is_active), is_sold_out=COALESCE($10, is_sold_out),
        pos_enabled=COALESCE($11, pos_enabled), sort_order=COALESCE($12, sort_order), updated_at=NOW()
       WHERE id=$1 RETURNING *\`,
      [req.params.id, category_id || null, name_en?.trim() || null, description_en || null, price === undefined ? null : Number(price), direct_price === undefined ? null : Number(direct_price), grab_price === undefined ? null : Number(grab_price), image_url || null, typeof is_active === "boolean" ? is_active : null, typeof is_sold_out === "boolean" ? is_sold_out : null, typeof pos_enabled === "boolean" ? pos_enabled : null, sort_order === undefined ? null : Number(sort_order)],
    );
    if (!updated.rowCount) return fail(res, "POS item was not found", 404);
    res.json({ ok: true, item: updated.rows[0] });
  } catch (e: any) {
    fail(res, e.message, 500);
  }
});`;

const newUpdate = `router.patch("/catalog/items/:id", staffDevice, async (req, res) => {
  try {
    const item = await updateItem(String(req.params.id), req.body || {});
    res.json({
      ok: true,
      source: "menu_v3_canonical",
      deprecated: true,
      replacement: "/api/menu-v3/items/update",
      item,
    });
  } catch (e: any) {
    const status = String(e?.message || "").includes("not found") ? 404 : 400;
    fail(res, e.message, status);
  }
});`;
replaceRequired(oldUpdate, newUpdate, "legacy catalogue update delegation");

if (next === source) {
  console.log("Menu single-source Stage 1 already applied.");
  process.exit(0);
}

fs.writeFileSync(path, next);
console.log("Menu single-source Stage 1 applied.");
console.log("Legacy POS catalogue reads/writes now delegate to canonical Menu V3 services.");

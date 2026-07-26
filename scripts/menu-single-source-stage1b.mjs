import fs from "node:fs";

const filePath = "server/routes/pos.ts";
if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`);

let source = fs.readFileSync(filePath, "utf8");

const importLine = 'import { getAllItems, createItem, updateItem } from "../services/menu/itemService";\nimport { getAllCategories } from "../services/menu/categoryService";';
if (!source.includes('from "../services/menu/itemService"')) {
  const anchor = 'import { getPinSessionUser } from "./pinAuth";';
  if (!source.includes(anchor)) throw new Error("Could not find POS import anchor");
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not apply ${label}: route boundaries not found`);
  }
  source = source.slice(0, start) + replacement.trimEnd() + "\n\n" + source.slice(end);
}

replaceBetween(
  'router.get("/catalog"',
  'router.post("/catalog/items"',
  `// Compatibility endpoint: delegates to the canonical Menu V3 services.\nrouter.get("/catalog", staffDevice, async (_req, res) => {\n  try {\n    const [categories, items] = await Promise.all([getAllCategories(), getAllItems()]);\n    res.json({\n      ok: true,\n      source: "menu_v3_canonical",\n      categories: categories.map((category: any) => ({\n        id: category.id,\n        name_en: category.name_en ?? category.name,\n        name_th: category.name_th ?? null,\n        sort_order: category.sortOrder ?? category.displayOrder ?? 0,\n        is_active: category.isActive !== false,\n      })),\n      items: items.map((item: any) => ({\n        id: item.id,\n        category_id: item.categoryId,\n        category_name: typeof item.category === "string" ? item.category : item.category?.name,\n        name_en: item.name,\n        description_en: item.description ?? null,\n        price: item.basePrice ?? item.price ?? 0,\n        direct_price: item.directPrice ?? item.basePrice ?? item.price ?? 0,\n        grab_price: item.grabPrice ?? item.directPrice ?? item.basePrice ?? item.price ?? 0,\n        image_url: item.imageUrl ?? null,\n        is_active: item.isActive !== false,\n        is_sold_out: item.soldOut === true,\n        pos_enabled: item.posEnabled !== false,\n        sort_order: item.sortOrder ?? item.displayOrder ?? 0,\n        recipe_id: item.recipeId ?? null,\n      })),\n    });\n  } catch (e: any) {\n    fail(res, e.message, 500);\n  }\n});`,
  "legacy catalogue read delegation",
);

replaceBetween(
  'router.post("/catalog/items"',
  'router.patch("/catalog/items/:id"',
  `router.post("/catalog/items", staffDevice, async (req, res) => {\n  try {\n    const item = await createItem(req.body || {});\n    res.status(201).json({ ok: true, source: "menu_v3_canonical", item });\n  } catch (e: any) {\n    fail(res, e.message, 400);\n  }\n});`,
  "legacy catalogue create delegation",
);

replaceBetween(
  'router.patch("/catalog/items/:id"',
  'router.get("/orders/next-ticket"',
  `router.patch("/catalog/items/:id", staffDevice, async (req, res) => {\n  try {\n    const item = await updateItem(req.params.id, req.body || {});\n    res.json({ ok: true, source: "menu_v3_canonical", item });\n  } catch (e: any) {\n    const status = /not found/i.test(e.message) ? 404 : 400;\n    fail(res, e.message, status);\n  }\n});`,
  "legacy catalogue update delegation",
);

fs.writeFileSync(filePath, source);
console.log("Issue #3 Stage 1B applied: POS catalogue compatibility routes now delegate to Menu V3 services.");

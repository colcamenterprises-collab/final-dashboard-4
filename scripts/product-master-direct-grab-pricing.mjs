import fs from "node:fs";

const path = "client/src/pages/menu/MenuItemEditor.tsx";
if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) throw new Error(`Could not apply ${label}: expected source text not found`);
  source = source.replace(search, replacement);
}

replaceOnce(
  'type MenuItem = { id: string; categoryId?: string; category?: string | { name?: string }; name: string; description?: string | null; basePrice?: number | string; price?: number | string; imageUrl?: string | null;',
  'type MenuItem = { id: string; categoryId?: string; category?: string | { name?: string }; name: string; description?: string | null; basePrice?: number | string; price?: number | string; directPrice?: number | string; grabPrice?: number | string; imageUrl?: string | null;',
  "MenuItem pricing fields",
);

replaceOnce(
  'price: String(item.basePrice ?? item.price ?? 0), recipeId:',
  'directPrice: String(item.directPrice ?? item.basePrice ?? item.price ?? 0), grabPrice: String(item.grabPrice ?? item.directPrice ?? item.basePrice ?? item.price ?? 0), recipeId:',
  "pricing draft fields",
);

replaceOnce(
  'price: Number(draft.price || 0), recipeId:',
  'directPrice: Number(draft.directPrice || 0), price: Number(draft.directPrice || 0), grabPrice: Number(draft.grabPrice || draft.directPrice || 0), recipeId:',
  "pricing save payload",
);

replaceOnce(
  '<label className="block text-xs font-medium">RRP / customer price<Input type="number" min="0" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="mt-1" /></label>',
  '<div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-medium">Direct / POS price<Input type="number" min="0" step="1" value={draft.directPrice} onChange={(event) => setDraft({ ...draft, directPrice: event.target.value })} className="mt-1" /></label><label className="block text-xs font-medium">Grab price<Input type="number" min="0" step="1" value={draft.grabPrice} onChange={(event) => setDraft({ ...draft, grabPrice: event.target.value })} className="mt-1" /></label></div>',
  "pricing editor inputs",
);

replaceOnce(
  'const saveBlockedReason = !draft.name.trim() ? "Enter an item name before saving." : !draft.categoryId ? "Select a category before saving." : uploading ? "Wait for the image upload to finish." : "";',
  'const directPriceNumber = Number(draft.directPrice);\n  const grabPriceNumber = Number(draft.grabPrice);\n  const saveBlockedReason = !draft.name.trim() ? "Enter an item name before saving." : !draft.categoryId ? "Select a category before saving." : !Number.isFinite(directPriceNumber) || directPriceNumber < 0 ? "Enter a valid Direct / POS price." : !Number.isFinite(grabPriceNumber) || grabPriceNumber < 0 ? "Enter a valid Grab price." : uploading ? "Wait for the image upload to finish." : "";',
  "pricing validation",
);

fs.writeFileSync(path, source);
console.log("Product Master direct and Grab pricing applied successfully.");
console.log("No database schema changes were made.");

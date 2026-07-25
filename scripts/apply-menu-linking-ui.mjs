import fs from "node:fs";

function replaceOnce(file, find, replacement) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(replacement)) return;
  if (!source.includes(find)) throw new Error(`Patch marker not found in ${file}`);
  fs.writeFileSync(file, source.replace(find, replacement));
}

const workspace = "client/src/pages/menu/MenuWorkspace.tsx";
let source = fs.readFileSync(workspace, "utf8");
if (!source.includes('import ModifierManager from "./ModifierManager";')) {
  source = source.replace('import MenuCategoriesPage from "./recipes/MenuCategoriesPage";', 'import MenuCategoriesPage from "./recipes/MenuCategoriesPage";\nimport ModifierManager from "./ModifierManager";\nimport MenuItemEditor from "./MenuItemEditor";');
}
source = source.replace(/\{editingItem && <div className="fixed inset-0 z-50 flex justify-end bg-black\/30"[\s\S]*?\n    <\/div>\}/, '{editingItem && <MenuItemEditor item={editingItem} categories={categories} recipes={recipes} modifierGroups={modifierGroups} onClose={() => setEditingItemId(null)} />}\n    </div>}');
source = source.replace(/\{activeTab === "modifiers" && <div className="space-y-3">[\s\S]*?<\/div>\}\n    \{activeTab === "categories"/, '{activeTab === "modifiers" && <ModifierManager />}\n    {activeTab === "categories"');
fs.writeFileSync(workspace, source);

const editor = "client/src/pages/menu/recipes/RecipeEditorPage.tsx";
let editorSource = fs.readFileSync(editor, "utf8");
editorSource = editorSource.replace('sellingPrice: directPrice, suggestedPrice: deliveryPartnerPrice, status: form.status,', 'totalCost, costPerServing, sellingPrice: directPrice, suggestedPrice: deliveryPartnerPrice, directMarginPercent: directMargin, deliveryPartnerMarginPercent: deliveryPartnerMargin, cogsPercent: directPrice && costPerServing !== null ? (costPerServing / directPrice) * 100 : null, status: form.status,');
fs.writeFileSync(editor, editorSource);

console.log("Menu linking UI patch applied");

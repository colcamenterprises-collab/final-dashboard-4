import fs from "node:fs";

const path = "client/src/pages/menu/MenuItemEditor.tsx";
if (!fs.existsSync(path)) throw new Error(`Missing ${path}`);
let source = fs.readFileSync(path, "utf8");

const marker = 'const [uploadMessage, setUploadMessage] = useState("");';
if (!source.includes(marker)) throw new Error("Could not locate MenuItemEditor state block");
if (!source.includes('const modifierLinksChanged =')) {
  source = source.replace(
    marker,
    `${marker}\n  const modifierLinksChanged = useMemo(() => {\n    const before = [...initiallyLinked].sort();\n    const after = [...draft.modifierGroupIds].sort();\n    return before.length !== after.length || before.some((value, index) => value !== after[index]);\n  }, [draft.modifierGroupIds, initiallyLinked]);`,
  );
}

const oldMutation = 'mutationFn: () => apiRequest("/api/menu-v3/items/update", { method: "POST", body: JSON.stringify({ id: item.id, name: draft.name, categoryId: draft.categoryId, description: draft.description, imageUrl: draft.imageUrl || null, clearImage: draft.clearImage, price: Number(draft.price || 0), recipeId: draft.recipeId ? Number(draft.recipeId) : null, modifierGroupIds: draft.modifierGroupIds, displayOrder: Number(draft.displayOrder || 0), isActive: draft.isActive, isOnlineEnabled: true, posEnabled: true }) }),';
const newMutation = 'mutationFn: () => apiRequest("/api/menu-v3/items/update", { method: "POST", body: JSON.stringify({ id: item.id, name: draft.name, categoryId: draft.categoryId, description: draft.description, imageUrl: draft.imageUrl || null, clearImage: draft.clearImage, price: Number(draft.price || 0), recipeId: draft.recipeId ? Number(draft.recipeId) : null, ...(modifierLinksChanged ? { modifierGroupIds: draft.modifierGroupIds } : {}), displayOrder: Number(draft.displayOrder || 0), isActive: draft.isActive, isOnlineEnabled: true, posEnabled: true }) }),';

if (source.includes(oldMutation)) {
  source = source.replace(oldMutation, newMutation);
} else if (!source.includes('...(modifierLinksChanged ? { modifierGroupIds: draft.modifierGroupIds } : {})')) {
  throw new Error("Could not locate MenuItemEditor save mutation");
}

fs.writeFileSync(path, source);
console.log("Menu item price save hotfix applied.");
console.log("Modifier links are now submitted only when changed.");

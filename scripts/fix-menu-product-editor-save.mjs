import fs from "node:fs";

const path = "client/src/pages/menu/MenuWorkspace.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceRequired(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) throw new Error(`Could not apply ${label}: source text not found`);
  source = source.replace(search, replacement);
}

replaceRequired(
  'type MenuItem = { id: string; categoryId?: string; category?: string | { name?: string }; name: string; description?: string | null; basePrice?: number | string; price?: number | string; imageUrl?: string | null;',
  'type MenuItem = { id: string; categoryId?: string; category?: string | { name?: string }; name: string; description?: string | null; basePrice?: number | string; price?: number | string; directPrice?: number | string; grabPrice?: number | string; imageUrl?: string | null;',
  "MenuItem price fields",
);

replaceRequired(
  '  const [editingItemId, setEditingItemId] = useState<string | null>(null);',
  '  const [editingItemId, setEditingItemId] = useState<string | null>(null);\n  const [editingItemDraft, setEditingItemDraft] = useState<MenuItem | null>(null);',
  "product editing draft state",
);

replaceRequired(
  '  const updateMenuItemMutation = useMutation({ mutationFn: (item: MenuItem) => apiRequest("/api/menu-v3/items/update", { method: "POST", body: JSON.stringify({ id: item.id, name: item.name, categoryId: item.categoryId, description: item.description, price: item.price ?? item.basePrice, imageUrl: item.imageUrl, isActive: item.isActive !== false, isOnlineEnabled: item.onlineEnabled ?? item.isOnlineEnabled ?? true, displayOrder: item.displayOrder ?? item.sortOrder }) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }); setEditingItemId(null); } });',
  '  const updateMenuItemMutation = useMutation({\n    mutationFn: (item: MenuItem) => apiRequest("/api/menu-v3/items/update", {\n      method: "POST",\n      body: JSON.stringify({\n        id: item.id,\n        name: item.name,\n        categoryId: item.categoryId,\n        description: item.description,\n        directPrice: toNumber(item.directPrice ?? item.basePrice ?? item.price),\n        grabPrice: toNumber(item.grabPrice ?? item.directPrice ?? item.basePrice ?? item.price),\n        imageUrl: item.imageUrl,\n        isActive: item.isActive !== false,\n        isOnlineEnabled: item.onlineEnabled ?? item.isOnlineEnabled ?? true,\n        displayOrder: item.displayOrder ?? item.sortOrder,\n      }),\n    }),\n    onSuccess: async () => {\n      await queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] });\n      setEditingItemId(null);\n      setEditingItemDraft(null);\n      window.alert("Product saved successfully. POS and ordering now use the updated product record.");\n    },\n    onError: (error: any) => {\n      window.alert(error?.message || "Product could not be saved. Please try again.");\n    },\n  });',
  "product update mutation",
);

replaceRequired(
  '  const editingItem = editingItemId ? items.find((item) => item.id === editingItemId) ?? null : null;',
  '  const editingItem = editingItemDraft ?? (editingItemId ? items.find((item) => item.id === editingItemId) ?? null : null);\n  const openItemEditor = (item: MenuItem) => {\n    setEditingItemId(item.id);\n    setEditingItemDraft({\n      ...item,\n      directPrice: item.directPrice ?? item.basePrice ?? item.price ?? "",\n      grabPrice: item.grabPrice ?? item.directPrice ?? item.basePrice ?? item.price ?? "",\n    });\n  };\n  const closeItemEditor = () => { setEditingItemId(null); setEditingItemDraft(null); };',
  "product editor helpers",
);

source = source.replaceAll('onClick={() => setEditingItemId(item.id)}', 'onClick={() => openItemEditor(item)}');
source = source.replaceAll('if (event.key === "Enter") setEditingItemId(item.id);', 'if (event.key === "Enter") openItemEditor(item);');

const modalStart = '      {editingItem && <div className="fixed inset-0 z-50 flex justify-end bg-black/30"';
const modalEnd = '    </div>}\n    {activeTab === "recipes"';
const startIndex = source.indexOf(modalStart);
const endIndex = source.indexOf(modalEnd, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error("Could not locate product editor modal boundaries");

const replacementModal = `      {editingItem && <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={closeItemEditor}>
        <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><p className="text-xs text-slate-500">Product editor</p><h2 className="text-xl font-semibold">{editingItem.name || "UNMAPPED"}</h2></div>
            <button type="button" className="rounded-lg border px-3 py-1.5 text-xs" onClick={closeItemEditor}>Close</button>
          </div>
          <div className="space-y-3">
            <label className="block text-xs font-medium">Item name
              <Input value={editingItem.name || ""} onChange={(event) => setEditingItemDraft((current) => current ? { ...current, name: event.target.value } : current)} className="mt-1" />
            </label>
            <label className="block text-xs font-medium">Category
              <select value={editingItem.categoryId || ""} onChange={(event) => setEditingItemDraft((current) => current ? { ...current, categoryId: event.target.value } : current)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium">Image URL
              <div className="mt-1 flex items-center gap-3"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">{editingItem.imageUrl ? <img src={editingItem.imageUrl} alt={editingItem.name} className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8" />}</div><Input value={editingItem.imageUrl || ""} onChange={(event) => setEditingItemDraft((current) => current ? { ...current, imageUrl: event.target.value } : current)} /></div>
            </label>
            <label className="block text-xs font-medium">Description
              <textarea value={editingItem.description || ""} onChange={(event) => setEditingItemDraft((current) => current ? { ...current, description: event.target.value } : current)} className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium">Direct / POS price (THB)
                <Input type="number" min="0" step="1" value={String(editingItem.directPrice ?? editingItem.basePrice ?? editingItem.price ?? "")} onChange={(event) => setEditingItemDraft((current) => current ? { ...current, directPrice: event.target.value, basePrice: event.target.value, price: event.target.value } : current)} className="mt-1 font-mono" />
              </label>
              <label className="block text-xs font-medium">Grab price (THB)
                <Input type="number" min="0" step="1" value={String(editingItem.grabPrice ?? editingItem.directPrice ?? editingItem.basePrice ?? editingItem.price ?? "")} onChange={(event) => setEditingItemDraft((current) => current ? { ...current, grabPrice: event.target.value } : current)} className="mt-1 font-mono" />
              </label>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Available/customer-visible</span><button type="button" onClick={() => setEditingItemDraft((current) => current ? { ...current, isActive: !itemAvailable(current) } : current)} className={\`relative h-8 w-14 rounded-full transition \${itemAvailable(editingItem) ? "bg-emerald-500" : "bg-slate-300"}\`}><span className={\`absolute top-1 h-6 w-6 rounded-full bg-white transition \${itemAvailable(editingItem) ? "left-7" : "left-1"}\`} /></button></div>
            <label className="block text-xs font-medium">Display order
              <Input type="number" value={String(editingItem.displayOrder ?? editingItem.sortOrder ?? 0)} onChange={(event) => setEditingItemDraft((current) => current ? { ...current, displayOrder: event.target.value } : current)} className="mt-1" />
            </label>
            <button type="button" disabled={updateMenuItemMutation.isPending || !editingItem.name.trim() || toNumber(editingItem.directPrice ?? editingItem.basePrice ?? editingItem.price) === null} onClick={() => updateMenuItemMutation.mutate(editingItem)} className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{updateMenuItemMutation.isPending ? "Saving…" : "Save product"}</button>
          </div>
        </aside>
      </div>}
`;

source = source.slice(0, startIndex) + replacementModal + source.slice(endIndex);
fs.writeFileSync(path, source);
console.log("Product editor save fix applied successfully.");

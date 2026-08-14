import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Recipe = { id: number; name: string };
type ModifierOption = { id?: string; name?: string; name_en?: string; price?: number | string; priceDelta?: number | string };
type ModifierGroup = {
  id?: string;
  name: string;
  menuItemId?: string;
  linkedMenuItemIds?: string[];
  groupType?: string;
  type?: string;
  selectionMode?: string;
  promptText?: string | null;
  options?: ModifierOption[];
  modifiers?: ModifierOption[];
};
type MenuCategory = { id: string; name: string };
type MenuItem = { id: string; categoryId?: string; category?: string | { name?: string }; name: string; description?: string | null; basePrice?: number | string; price?: number | string; directPrice?: number | string; grabPrice?: number | string; imageUrl?: string | null; isActive?: boolean; soldOut?: boolean; posEnabled?: boolean; onlineEnabled?: boolean; isOnlineEnabled?: boolean; recipeId?: number | null; displayOrder?: number | string | null; sortOrder?: number | string | null };
type ItemChoiceDraft = { key: string; id?: string; name: string; promptText: string; options: Array<{ key: string; name: string; finalPrice: string }> };
type Props = { item: MenuItem; categories: MenuCategory[]; recipes: Recipe[]; modifierGroups: ModifierGroup[]; onClose: () => void };

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const linkedToItem = (group: ModifierGroup, itemId: string) => group.menuItemId === itemId || group.linkedMenuItemIds?.includes(itemId);
const isExclusiveChoice = (group: ModifierGroup, itemId: string) =>
  (group.groupType === "choice" || group.type === "choice") && linkedToItem(group, itemId) && (group.linkedMenuItemIds?.length ?? 1) === 1;

export default function MenuItemEditor({ item, categories, recipes, modifierGroups, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initiallyLinked = useMemo(() => modifierGroups.filter((group) => linkedToItem(group, item.id)).map((group) => String(group.id)), [item.id, modifierGroups]);
  const originalChoiceGroupIds = useRef(modifierGroups.filter((group) => isExclusiveChoice(group, item.id)).map((group) => String(group.id)));
  const categoryName = typeof item.category === "string" ? item.category : item.category?.name;
  const resolvedCategoryId = item.categoryId || categories.find((category) => category.name.trim().toLowerCase() === String(categoryName || "").trim().toLowerCase())?.id || "";
  const initialDirectPrice = Number(item.directPrice ?? item.basePrice ?? item.price ?? 0);
  const [draft, setDraft] = useState({ name: item.name || "", categoryId: resolvedCategoryId, description: item.description || "", imageUrl: item.imageUrl || "", clearImage: false, directPrice: String(initialDirectPrice), grabPrice: String(item.grabPrice ?? item.directPrice ?? item.basePrice ?? item.price ?? 0), recipeId: item.recipeId ? String(item.recipeId) : "", modifierGroupIds: initiallyLinked, displayOrder: String(item.displayOrder ?? item.sortOrder ?? 0), isActive: item.isActive !== false });
  const [choiceGroups, setChoiceGroups] = useState<ItemChoiceDraft[]>(() => modifierGroups.filter((group) => isExclusiveChoice(group, item.id)).map((group) => ({
    key: String(group.id), id: String(group.id), name: group.name, promptText: group.promptText || group.name,
    options: (group.options || group.modifiers || []).map((option) => ({ key: String(option.id || newKey()), name: String(option.name ?? option.name_en ?? ""), finalPrice: String(initialDirectPrice + Number(option.priceDelta ?? option.price ?? 0)) })),
  })));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");

  const editableChoiceIds = new Set(choiceGroups.map((group) => group.id).filter(Boolean));
  const reusableGroups = modifierGroups.filter((group) => !editableChoiceIds.has(String(group.id)) && !isExclusiveChoice(group, item.id));
  const modifierLinksChanged = useMemo(() => {
    const before = [...initiallyLinked].sort();
    const after = [...draft.modifierGroupIds].sort();
    return before.length !== after.length || before.some((value, index) => value !== after[index]);
  }, [draft.modifierGroupIds, initiallyLinked]);

  // Cache refreshes must never hold the save modal open: POS endpoints can be slow or unavailable.
  const refreshMenuData = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/modifiers/groups"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/pos/catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/pos/menu"] }),
    ]).catch(() => undefined);
  };

  const uploadImage = async () => {
    if (!selectedFile) { setUploadError("Choose an image before uploading."); return; }
    setUploading(true); setUploadError(""); setUploadMessage("");
    let uploadedImageUrl = "";
    let savedToItem = false;
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      const response = await fetch("/api/upload/menu-item-image", { method: "POST", credentials: "include", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Image upload failed");
      uploadedImageUrl = result.imageUrl || result.url;
      if (!uploadedImageUrl) throw new Error("Upload completed without an image URL");
      await apiRequest("/api/menu-v3/items/update", { method: "POST", body: JSON.stringify({ id: item.id, imageUrl: uploadedImageUrl, clearImage: false }) });
      savedToItem = true;
      setDraft((current) => ({ ...current, imageUrl: uploadedImageUrl, clearImage: false }));
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshMenuData();
      setUploadMessage(`Image uploaded, converted and saved (${result.width || "?"} × ${result.height || "?"}).`);
    } catch (error) {
      if (uploadedImageUrl && !savedToItem) {
        void fetch("/api/upload/menu-item-image", { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: uploadedImageUrl }) });
      }
      setUploadError(error instanceof Error ? error.message : "Image upload failed");
    } finally { setUploading(false); }
  };

  const removeImage = () => { setUploadError(""); setUploadMessage(""); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; setDraft((current) => ({ ...current, imageUrl: "", clearImage: true })); };
  const addChoiceGroup = () => setChoiceGroups((current) => [...current, { key: newKey(), name: "Choose size", promptText: "Choose a size", options: [{ key: newKey(), name: "", finalPrice: draft.directPrice }, { key: newKey(), name: "", finalPrice: draft.directPrice }] }]);
  const updateChoiceGroup = (key: string, patch: Partial<ItemChoiceDraft>) => setChoiceGroups((current) => current.map((group) => group.key === key ? { ...group, ...patch } : group));
  const removeChoiceGroup = (group: ItemChoiceDraft) => setChoiceGroups((current) => current.filter((entry) => entry.key !== group.key));
  const addChoice = (groupKey: string) => setChoiceGroups((current) => current.map((group) => group.key === groupKey ? { ...group, options: [...group.options, { key: newKey(), name: "", finalPrice: draft.directPrice }] } : group));
  const updateChoice = (groupKey: string, optionKey: string, patch: { name?: string; finalPrice?: string }) => setChoiceGroups((current) => current.map((group) => group.key === groupKey ? { ...group, options: group.options.map((option) => option.key === optionKey ? { ...option, ...patch } : option) } : group));
  const removeChoice = (groupKey: string, optionKey: string) => setChoiceGroups((current) => current.map((group) => group.key === groupKey ? { ...group, options: group.options.filter((option) => option.key !== optionKey) } : group));

  const save = useMutation({
    mutationFn: async () => {
      const savedItem = await apiRequest("/api/menu-v3/items/update", { method: "POST", body: JSON.stringify({ id: item.id, name: draft.name, categoryId: draft.categoryId, description: draft.description, imageUrl: draft.imageUrl || null, clearImage: draft.clearImage, directPrice: Number(draft.directPrice), price: Number(draft.directPrice), grabPrice: Number(draft.grabPrice), recipeId: draft.recipeId ? Number(draft.recipeId) : null, ...(modifierLinksChanged ? { modifierGroupIds: draft.modifierGroupIds } : {}), displayOrder: Number(draft.displayOrder || 0), isActive: draft.isActive, isOnlineEnabled: true, posEnabled: true }) });
      for (const group of choiceGroups) {
        const result = await apiRequest("/api/menu-v3/items/options/save", { method: "POST", body: JSON.stringify({ itemId: item.id, groupId: group.id || null, name: group.name, promptText: group.promptText, options: group.options.map((option) => ({ name: option.name, finalPrice: Number(option.finalPrice) })) }) });
        if (!group.id && result?.id) setChoiceGroups((current) => current.map((entry) => entry.key === group.key ? { ...entry, id: String(result.id) } : entry));
      }
      const retained = new Set(choiceGroups.map((group) => group.id).filter(Boolean));
      for (const groupId of originalChoiceGroupIds.current.filter((id) => !retained.has(id))) {
        await apiRequest("/api/menu-v3/items/options/delete", { method: "POST", body: JSON.stringify({ itemId: item.id, groupId }) });
      }
      return savedItem;
    },
    onSuccess: (savedItem) => {
      queryClient.setQueryData(["/api/menu-v3/items"], (current: unknown) => {
        const replaceItem = (items: unknown[]) => items.map((entry: any) => entry?.id === savedItem?.id ? savedItem : entry);
        if (Array.isArray(current)) return replaceItem(current);
        if (current && typeof current === "object" && Array.isArray((current as { items?: unknown[] }).items)) {
          return { ...(current as object), items: replaceItem((current as { items: unknown[] }).items) };
        }
        return current;
      });
      refreshMenuData();
      onClose();
    },
    onError: () => { refreshMenuData(); },
  });

  const toggleModifier = (id: string) => setDraft((current) => ({ ...current, modifierGroupIds: current.modifierGroupIds.includes(id) ? current.modifierGroupIds.filter((value) => value !== id) : [...current.modifierGroupIds, id] }));
  const directPriceNumber = Number(draft.directPrice);
  const grabPriceNumber = Number(draft.grabPrice);
  const choiceError = choiceGroups.map((group) => {
    if (!group.name.trim()) return "Enter an option group name.";
    if (group.options.length < 2) return `${group.name}: add at least two choices.`;
    const names = group.options.map((option) => option.name.trim().toLowerCase());
    if (names.some((name) => !name)) return `${group.name}: enter every choice name.`;
    if (new Set(names).size !== names.length) return `${group.name}: choice names must be unique.`;
    if (group.options.some((option) => !Number.isFinite(Number(option.finalPrice)) || Number(option.finalPrice) < directPriceNumber)) return `${group.name}: every final price must be at least the Direct / POS base price.`;
    return "";
  }).find(Boolean) || "";
  const saveBlockedReason = !draft.name.trim() ? "Enter an item name before saving." : !draft.categoryId ? "Select a category before saving." : !Number.isFinite(directPriceNumber) || directPriceNumber <= 0 ? "Enter a Direct / POS base price above zero." : !Number.isFinite(grabPriceNumber) || grabPriceNumber < 0 ? "Enter a valid Grab price." : choiceError || (uploading ? "Wait for the image upload to finish." : "");
  const selectedRecipe = recipes.find((recipe) => String(recipe.id) === draft.recipeId);
  const linkedGroups = modifierGroups.filter((group) => draft.modifierGroupIds.includes(String(group.id || "")));

  return <div className="fixed inset-0 z-50 bg-slate-100" onClick={onClose}>
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50" onClick={(event) => event.stopPropagation()}>
      <header className="flex min-h-[72px] items-center justify-between gap-4 border-b bg-white px-4 py-3 sm:px-6 lg:px-8"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Product Builder</p><h2 className="truncate text-xl font-bold text-slate-950">{draft.name || "Untitled product"}</h2><p className="truncate text-xs text-slate-500">Product ID: {item.id}</p></div><div className="flex shrink-0 items-center gap-2"><span className={"hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex " + (draft.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{draft.isActive ? "Active" : "Unavailable"}</span><button type="button" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold" onClick={onClose}>Close</button></div></header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6"><div className="mx-auto grid w-full max-w-[1800px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)_380px] 2xl:grid-cols-[360px_minmax(0,1fr)_420px]">
        <section className="space-y-4"><div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-slate-950">Product image</h3><p className="text-xs text-slate-500">Used by Menu and POS</p></div>{draft.imageUrl && <button type="button" onClick={removeImage} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-700">Remove</button>}</div><div className="mt-4 flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-slate-100">{draft.imageUrl ? <img src={draft.imageUrl} alt={draft.name} className="h-full w-full object-contain" /> : <span className="text-sm text-slate-400">No product image</span>}</div><div className="mt-3 space-y-2"><input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.avif,.tif,.tiff" disabled={uploading} onChange={(event) => { setUploadError(""); setUploadMessage(""); setSelectedFile(event.target.files?.[0] ?? null); }} className="w-full rounded-lg border px-3 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1" />{selectedFile && <p className="break-all text-xs text-slate-600">{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>}<button type="button" disabled={!selectedFile || uploading} onClick={() => void uploadImage()} className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40">{uploading ? "Converting and uploading…" : "Upload selected image"}</button>{uploadMessage && <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{uploadMessage}</p>}{uploadError && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{uploadError}</p>}</div></div><div className="rounded-2xl border bg-white p-4 shadow-sm"><h3 className="font-semibold text-slate-950">Availability</h3><label className="mt-3 flex items-center justify-between rounded-xl border p-3 text-sm"><span><strong className="block">Available</strong><span className="text-xs text-slate-500">Visible to staff and customers</span></span><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="h-5 w-5" /></label></div></section>
        <section className="space-y-4"><div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><h3 className="font-semibold text-slate-950">Product information</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-slate-600 md:col-span-2">Product name<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1.5" /></label><label className="text-xs font-semibold text-slate-600">Category<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Display order<Input type="number" value={draft.displayOrder} onChange={(event) => setDraft({ ...draft, displayOrder: event.target.value })} className="mt-1.5" /></label><label className="text-xs font-semibold text-slate-600 md:col-span-2">Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1.5 min-h-28 w-full rounded-md border px-3 py-2 text-sm" /></label></div></div>
          <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">Item price options</h3><p className="text-xs text-slate-500">Required choices created on this product, such as Nuggets 6 / 9 / 12 / 24.</p></div><button type="button" onClick={addChoiceGroup} className="shrink-0 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-black">Add options</button></div><div className="mt-4 space-y-4">{choiceGroups.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No item-level price options.</p> : choiceGroups.map((group) => <div key={group.key} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4"><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-semibold text-slate-600">Group name<Input value={group.name} onChange={(event) => updateChoiceGroup(group.key, { name: event.target.value })} placeholder="Choose size" className="mt-1" /></label><label className="text-xs font-semibold text-slate-600">Cashier prompt<Input value={group.promptText} onChange={(event) => updateChoiceGroup(group.key, { promptText: event.target.value })} placeholder="Choose a size" className="mt-1" /></label><button type="button" onClick={() => removeChoiceGroup(group)} className="self-end rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Delete group</button></div><div className="mt-3 space-y-2">{group.options.map((option) => <div key={option.key} className="grid grid-cols-[1fr_125px_auto] gap-2"><Input value={option.name} onChange={(event) => updateChoice(group.key, option.key, { name: event.target.value })} placeholder="e.g. 6 pieces" /><Input type="number" min={draft.directPrice || "0"} step="0.01" value={option.finalPrice} onChange={(event) => updateChoice(group.key, option.key, { finalPrice: event.target.value })} aria-label={`${option.name || "Choice"} final POS price`} /><button type="button" disabled={group.options.length <= 2} onClick={() => removeChoice(group.key, option.key)} className="rounded-lg border px-3 text-xs text-red-700 disabled:opacity-30">Remove</button></div>)}<div className="grid grid-cols-[1fr_125px_auto] gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500"><span>Choice name</span><span>Final POS price</span><span /></div><button type="button" onClick={() => addChoice(group.key)} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Add another choice</button></div></div>)}</div></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><div><h3 className="font-semibold text-slate-950">Reusable modifiers</h3><p className="text-xs text-slate-500">Assign shared add-ons and upsells such as Make it Better.</p></div><div className="mt-4 grid gap-2 md:grid-cols-2">{reusableGroups.length === 0 ? <p className="text-sm text-slate-500">No reusable modifier groups available.</p> : reusableGroups.map((group) => { const id = String(group.id || ""); const optionCount = (group.options || group.modifiers || []).length; const checked = draft.modifierGroupIds.includes(id); return <label key={id || group.name} className={"flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition " + (checked ? "border-amber-400 bg-amber-50" : "hover:border-slate-400")}><span><strong className="block text-sm">{group.name}</strong><span className="text-xs text-slate-500">{optionCount} option{optionCount === 1 ? "" : "s"}</span></span><input type="checkbox" checked={checked} onChange={() => toggleModifier(id)} className="h-5 w-5" /></label>; })}</div></div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><h3 className="font-semibold text-slate-950">Recipe</h3><label className="mt-4 block text-xs font-semibold text-slate-600">Linked recipe<select value={draft.recipeId} onChange={(event) => setDraft({ ...draft, recipeId: event.target.value })} className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"><option value="">No recipe linked</option>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></label>{selectedRecipe && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><span className="text-xs text-slate-500">Current recipe</span><strong className="mt-1 block">{selectedRecipe.name}</strong></div>}</div></section>
        <section className="space-y-4"><div className="rounded-2xl border bg-white p-4 shadow-sm"><h3 className="font-semibold text-slate-950">Pricing</h3><div className="mt-4 space-y-4"><label className="block text-xs font-semibold text-slate-600">Direct / POS base price (THB)<Input type="number" min="0.01" step="0.01" value={draft.directPrice} onChange={(event) => setDraft({ ...draft, directPrice: event.target.value })} className="mt-1.5 text-lg font-semibold" /></label><p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">For a product with choices, use the lowest option as the base price. Each option above stores only the difference.</p><label className="block text-xs font-semibold text-slate-600">Grab price (THB)<Input type="number" min="0" step="0.01" value={draft.grabPrice} onChange={(event) => setDraft({ ...draft, grabPrice: event.target.value })} className="mt-1.5 text-lg font-semibold" /></label></div></div><div className="rounded-2xl border bg-slate-950 p-4 text-white shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Live POS preview</p><h3 className="mt-1 text-lg font-bold">{draft.name || "Product name"}</h3></div><span className="rounded-full bg-white/10 px-2 py-1 text-[10px]">PREVIEW</span></div><div className="mt-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-white/5">{draft.imageUrl ? <img src={draft.imageUrl} alt="Preview" className="h-full w-full object-contain" /> : <span className="text-xs text-white/40">Product image</span>}</div><div className="mt-4 flex items-center justify-between"><strong className="text-xl">{Number(draft.directPrice || 0).toLocaleString("en-AU")} THB</strong><span className={"rounded-full px-2 py-1 text-xs " + (draft.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50")}>{draft.isActive ? "Available" : "Unavailable"}</span></div>{(linkedGroups.length > 0 || choiceGroups.length > 0) && <div className="mt-4 border-t border-white/10 pt-3"><p className="text-[11px] uppercase tracking-wide text-white/40">Selling flow</p><div className="mt-2 flex flex-wrap gap-2">{choiceGroups.map((group) => <span key={group.key} className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-black">{group.name || "Item options"}</span>)}{linkedGroups.filter((group) => !isExclusiveChoice(group,item.id)).map((group) => <span key={String(group.id)} className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{group.name}</span>)}</div></div>}</div></section>
      </div></div>
      <footer className="border-t bg-white px-4 py-3 sm:px-6 lg:px-8"><div className="mx-auto flex w-full max-w-[1800px] flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><div>{saveBlockedReason && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{saveBlockedReason}</p>}{save.isError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{(save.error as Error)?.message || "Could not save product"}</p>}</div><button disabled={Boolean(saveBlockedReason) || save.isPending} onClick={() => save.mutate()} className="rounded-xl bg-black px-8 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white disabled:opacity-100">{save.isPending ? "Saving product and options…" : "Save product"}</button></div></footer>
    </div>
  </div>;
}

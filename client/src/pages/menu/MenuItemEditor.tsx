import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Recipe = { id: number; name: string };
type ModifierGroup = { id?: string; name: string; menuItemId?: string; linkedMenuItemIds?: string[]; options?: unknown[]; modifiers?: unknown[] };
type MenuCategory = { id: string; name: string };
type MenuItem = { id: string; categoryId?: string; category?: string | { name?: string }; name: string; description?: string | null; basePrice?: number | string; price?: number | string; directPrice?: number | string; grabPrice?: number | string; imageUrl?: string | null; isActive?: boolean; soldOut?: boolean; posEnabled?: boolean; onlineEnabled?: boolean; isOnlineEnabled?: boolean; recipeId?: number | null; displayOrder?: number | string | null; sortOrder?: number | string | null };

type Props = { item: MenuItem; categories: MenuCategory[]; recipes: Recipe[]; modifierGroups: ModifierGroup[]; onClose: () => void };

export default function MenuItemEditor({ item, categories, recipes, modifierGroups, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initiallyLinked = useMemo(() => modifierGroups.filter((group) => group.menuItemId === item.id || group.linkedMenuItemIds?.includes(item.id)).map((group) => String(group.id)), [item.id, modifierGroups]);
  const categoryName = typeof item.category === "string" ? item.category : item.category?.name;
  const resolvedCategoryId = item.categoryId || categories.find((category) => category.name.trim().toLowerCase() === String(categoryName || "").trim().toLowerCase())?.id || "";
  const [draft, setDraft] = useState({ name: item.name || "", categoryId: resolvedCategoryId, description: item.description || "", imageUrl: item.imageUrl || "", clearImage: false, directPrice: String(item.directPrice ?? item.basePrice ?? item.price ?? 0), grabPrice: String(item.grabPrice ?? item.directPrice ?? item.basePrice ?? item.price ?? 0), recipeId: item.recipeId ? String(item.recipeId) : "", modifierGroupIds: initiallyLinked, displayOrder: String(item.displayOrder ?? item.sortOrder ?? 0), isActive: item.isActive !== false });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const modifierLinksChanged = useMemo(() => {
    const before = [...initiallyLinked].sort();
    const after = [...draft.modifierGroupIds].sort();
    return before.length !== after.length || before.some((value, index) => value !== after[index]);
  }, [draft.modifierGroupIds, initiallyLinked]);

  const refreshMenuData = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/modifiers/groups"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/pos/catalog"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/pos/menu"] }),
  ]);

  const uploadImage = async () => {
    if (!selectedFile) { setUploadError("Choose an image before uploading."); return; }
    setUploading(true); setUploadError(""); setUploadMessage("");
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      const response = await fetch("/api/upload/menu-item-image", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Image upload failed");
      const imageUrl = result.imageUrl || result.url;
      if (!imageUrl) throw new Error("Upload completed without an image URL");
      await apiRequest("/api/menu-v3/items/update", { method: "POST", body: JSON.stringify({ id: item.id, imageUrl, clearImage: false }) });
      setDraft((current) => ({ ...current, imageUrl, clearImage: false }));
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshMenuData();
      setUploadMessage("Image uploaded and saved to the Menu Item.");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed");
    } finally { setUploading(false); }
  };

  const removeImage = () => { setUploadError(""); setUploadMessage(""); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; setDraft((current) => ({ ...current, imageUrl: "", clearImage: true })); };

  const save = useMutation({
    mutationFn: () => apiRequest("/api/menu-v3/items/update", { method: "POST", body: JSON.stringify({ id: item.id, name: draft.name, categoryId: draft.categoryId, description: draft.description, imageUrl: draft.imageUrl || null, clearImage: draft.clearImage, directPrice: Number(draft.directPrice || 0), price: Number(draft.directPrice || 0), grabPrice: Number(draft.grabPrice || draft.directPrice || 0), recipeId: draft.recipeId ? Number(draft.recipeId) : null, ...(modifierLinksChanged ? { modifierGroupIds: draft.modifierGroupIds } : {}), displayOrder: Number(draft.displayOrder || 0), isActive: draft.isActive, isOnlineEnabled: true, posEnabled: true }) }),
    onSuccess: async () => { await refreshMenuData(); onClose(); },
  });

  const toggleModifier = (id: string) => setDraft((current) => ({ ...current, modifierGroupIds: current.modifierGroupIds.includes(id) ? current.modifierGroupIds.filter((value) => value !== id) : [...current.modifierGroupIds, id] }));
  const directPriceNumber = Number(draft.directPrice);
  const grabPriceNumber = Number(draft.grabPrice);
  const saveBlockedReason = !draft.name.trim() ? "Enter an item name before saving." : !draft.categoryId ? "Select a category before saving." : !Number.isFinite(directPriceNumber) || directPriceNumber < 0 ? "Enter a valid Direct / POS price." : !Number.isFinite(grabPriceNumber) || grabPriceNumber < 0 ? "Enter a valid Grab price." : uploading ? "Wait for the image upload to finish." : "";

  const grabPrice = String((draft as any).grabPrice ?? (item as any).grabPrice ?? draft.price ?? "0");
  const setGrabPrice = (value: string) => setDraft(({ ...draft, grabPrice: value }) as typeof draft);
  const selectedRecipe = recipes.find((recipe) => String(recipe.id) === draft.recipeId);
  const linkedGroups = modifierGroups.filter((group) => draft.modifierGroupIds.includes(String(group.id || "")));

  return <div className="fixed inset-0 z-50 bg-slate-100" onClick={onClose}>
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50" onClick={(event) => event.stopPropagation()}>
      <header className="flex min-h-[72px] items-center justify-between gap-4 border-b bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">Product Builder</p><h2 className="truncate text-xl font-bold text-slate-950">{draft.name || "Untitled product"}</h2><p className="truncate text-xs text-slate-500">Product ID: {item.id}</p></div>
        <div className="flex shrink-0 items-center gap-2"><span className={"hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex " + (draft.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{draft.isActive ? "Active" : "Unavailable"}</span><button type="button" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold" onClick={onClose}>Close</button></div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
        <div className="mx-auto grid w-full max-w-[1800px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)_380px] 2xl:grid-cols-[360px_minmax(0,1fr)_420px]">
          <section className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><div><h3 className="font-semibold text-slate-950">Product image</h3><p className="text-xs text-slate-500">Used by Menu and POS</p></div>{draft.imageUrl && <button type="button" onClick={removeImage} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-700">Remove</button>}</div>
              <div className="mt-4 flex aspect-square items-center justify-center overflow-hidden rounded-2xl border bg-slate-100">{draft.imageUrl ? <img src={draft.imageUrl} alt={draft.name} className="h-full w-full object-contain" /> : <span className="text-sm text-slate-400">No product image</span>}</div>
              <div className="mt-3 space-y-2"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { setUploadError(""); setUploadMessage(""); setSelectedFile(event.target.files?.[0] ?? null); }} className="w-full rounded-lg border px-3 py-2 text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1" /><button type="button" disabled={!selectedFile || uploading} onClick={() => void uploadImage()} className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40">{uploading ? "Uploading…" : "Upload selected image"}</button>{uploadMessage && <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{uploadMessage}</p>}{uploadError && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{uploadError}</p>}</div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm"><h3 className="font-semibold text-slate-950">Availability</h3><label className="mt-3 flex items-center justify-between rounded-xl border p-3 text-sm"><span><strong className="block">Available</strong><span className="text-xs text-slate-500">Visible to staff and customers</span></span><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="h-5 w-5" /></label></div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><h3 className="font-semibold text-slate-950">Product information</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-slate-600 md:col-span-2">Product name<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1.5" /></label><label className="text-xs font-semibold text-slate-600">Category<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Display order<Input type="number" value={draft.displayOrder} onChange={(event) => setDraft({ ...draft, displayOrder: event.target.value })} className="mt-1.5" /></label><label className="text-xs font-semibold text-slate-600 md:col-span-2">Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1.5 min-h-28 w-full rounded-md border px-3 py-2 text-sm" /></label></div></div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><h3 className="font-semibold text-slate-950">Recipe</h3><label className="mt-4 block text-xs font-semibold text-slate-600">Linked recipe<select value={draft.recipeId} onChange={(event) => setDraft({ ...draft, recipeId: event.target.value })} className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"><option value="">No recipe linked</option>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></label>{selectedRecipe && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><span className="text-xs text-slate-500">Current recipe</span><strong className="mt-1 block">{selectedRecipe.name}</strong></div>}</div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5"><div><h3 className="font-semibold text-slate-950">Modifier groups</h3><p className="text-xs text-slate-500">Assign reusable selling and upsell groups</p></div><div className="mt-4 grid gap-2 md:grid-cols-2">{modifierGroups.length === 0 ? <p className="text-sm text-slate-500">No modifier groups available.</p> : modifierGroups.map((group) => { const id = String(group.id || ""); const optionCount = (group.options || group.modifiers || []).length; const checked = draft.modifierGroupIds.includes(id); return <label key={id || group.name} className={"flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition " + (checked ? "border-amber-400 bg-amber-50" : "hover:border-slate-400")}><span><strong className="block text-sm">{group.name}</strong><span className="text-xs text-slate-500">{optionCount} option{optionCount === 1 ? "" : "s"}</span></span><input type="checkbox" checked={checked} onChange={() => toggleModifier(id)} className="h-5 w-5" /></label>; })}</div></div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm"><h3 className="font-semibold text-slate-950">Pricing</h3><div className="mt-4 space-y-4"><label className="block text-xs font-semibold text-slate-600">Direct / POS price (THB)<Input type="number" min="0" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="mt-1.5 text-lg font-semibold" /></label>{Object.prototype.hasOwnProperty.call(draft, "grabPrice") && <label className="block text-xs font-semibold text-slate-600">Grab price (THB)<Input type="number" min="0" value={grabPrice} onChange={(event) => setGrabPrice(event.target.value)} className="mt-1.5 text-lg font-semibold" /></label>}</div></div>

            <div className="rounded-2xl border bg-slate-950 p-4 text-white shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Live POS preview</p><h3 className="mt-1 text-lg font-bold">{draft.name || "Product name"}</h3></div><span className="rounded-full bg-white/10 px-2 py-1 text-[10px]">PREVIEW</span></div><div className="mt-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-white/5">{draft.imageUrl ? <img src={draft.imageUrl} alt="Preview" className="h-full w-full object-contain" /> : <span className="text-xs text-white/40">Product image</span>}</div><div className="mt-4 flex items-center justify-between"><strong className="text-xl">{Number(draft.price || 0).toLocaleString("en-AU")} THB</strong><span className={"rounded-full px-2 py-1 text-xs " + (draft.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50")}>{draft.isActive ? "Available" : "Unavailable"}</span></div>{linkedGroups.length > 0 && <div className="mt-4 border-t border-white/10 pt-3"><p className="text-[11px] uppercase tracking-wide text-white/40">Selling flow</p><div className="mt-2 flex flex-wrap gap-2">{linkedGroups.map((group) => <span key={String(group.id)} className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{group.name}</span>)}</div></div>}</div>
          </section>
        </div>
      </div>

      <footer className="border-t bg-white px-4 py-3 sm:px-6 lg:px-8"><div className="mx-auto flex w-full max-w-[1800px] flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between"><div>{saveBlockedReason && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{saveBlockedReason}</p>}{save.isError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{(save.error as Error)?.message || "Could not save product"}</p>}</div><button disabled={Boolean(saveBlockedReason) || save.isPending} onClick={() => save.mutate()} className="rounded-xl bg-black px-8 py-3 text-sm font-bold text-white disabled:opacity-40">{save.isPending ? "Saving product…" : "Save product"}</button></div></footer>
    </div>
  </div>;
}

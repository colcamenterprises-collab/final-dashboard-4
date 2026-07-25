import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Recipe = { id: number; name: string };
type ModifierGroup = { id?: string; name: string; menuItemId?: string; linkedMenuItemIds?: string[]; options?: unknown[]; modifiers?: unknown[] };
type MenuCategory = { id: string; name: string };
type MenuItem = { id: string; categoryId?: string; category?: string | { name?: string }; name: string; description?: string | null; basePrice?: number | string; price?: number | string; imageUrl?: string | null; isActive?: boolean; soldOut?: boolean; posEnabled?: boolean; onlineEnabled?: boolean; isOnlineEnabled?: boolean; recipeId?: number | null; displayOrder?: number | string | null; sortOrder?: number | string | null };

type Props = {
  item: MenuItem;
  categories: MenuCategory[];
  recipes: Recipe[];
  modifierGroups: ModifierGroup[];
  onClose: () => void;
};

export default function MenuItemEditor({ item, categories, recipes, modifierGroups, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initiallyLinked = useMemo(() => modifierGroups.filter((group) => group.menuItemId === item.id || group.linkedMenuItemIds?.includes(item.id)).map((group) => String(group.id)), [item.id, modifierGroups]);
  const categoryName = typeof item.category === "string" ? item.category : item.category?.name;
  const resolvedCategoryId = item.categoryId || categories.find((category) => category.name.trim().toLowerCase() === String(categoryName || "").trim().toLowerCase())?.id || "";
  const [draft, setDraft] = useState({
    name: item.name || "",
    categoryId: resolvedCategoryId,
    description: item.description || "",
    imageUrl: item.imageUrl || "",
    clearImage: false,
    price: String(item.basePrice ?? item.price ?? 0),
    recipeId: item.recipeId ? String(item.recipeId) : "",
    modifierGroupIds: initiallyLinked,
    displayOrder: String(item.displayOrder ?? item.sortOrder ?? 0),
    isActive: item.isActive !== false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const uploadImage = async () => {
    if (!selectedFile) {
      setUploadError("Choose an image before uploading.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      const response = await fetch("/api/upload/menu-item-image", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Image upload failed");
      const imageUrl = result.imageUrl || result.url;
      if (!imageUrl) throw new Error("Upload completed without an image URL");
      setDraft((current) => ({ ...current, imageUrl, clearImage: false }));
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setUploadError("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setDraft((current) => ({ ...current, imageUrl: "", clearImage: true }));
  };

  const save = useMutation({
    mutationFn: () => apiRequest("/api/menu-v3/items/update", {
      method: "POST",
      body: JSON.stringify({
        id: item.id,
        name: draft.name,
        categoryId: draft.categoryId,
        description: draft.description,
        imageUrl: draft.imageUrl || null,
        clearImage: draft.clearImage,
        price: Number(draft.price || 0),
        recipeId: draft.recipeId ? Number(draft.recipeId) : null,
        modifierGroupIds: draft.modifierGroupIds,
        displayOrder: Number(draft.displayOrder || 0),
        isActive: draft.isActive,
        isOnlineEnabled: true,
        posEnabled: true,
      }),
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/modifiers/groups"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/pos/catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/pos/menu"] }),
      ]);
      onClose();
    },
  });

  const toggleModifier = (id: string) => setDraft((current) => ({ ...current, modifierGroupIds: current.modifierGroupIds.includes(id) ? current.modifierGroupIds.filter((value) => value !== id) : [...current.modifierGroupIds, id] }));
  const saveBlockedReason = !draft.name.trim() ? "Enter an item name before saving." : !draft.categoryId ? "Select a category before saving." : uploading ? "Wait for the image upload to finish." : "";

  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
    <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">Menu item editor</p><h2 className="text-xl font-semibold">{draft.name || "Untitled item"}</h2></div><button className="rounded-lg border px-3 py-1.5 text-xs" onClick={onClose}>Close</button></div>
      <div className="space-y-4">
        <label className="block text-xs font-medium">Item name<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1" /></label>
        <label className="block text-xs font-medium">Category<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm"><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>

        <section className="rounded-xl border p-3">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-medium">Menu item image</p><p className="text-[11px] text-slate-500">This image feeds the POS catalogue and live POS.</p></div>{draft.imageUrl && <button type="button" onClick={removeImage} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700">Remove image</button>}</div>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-slate-100 text-xs text-slate-500">{draft.imageUrl ? <img src={draft.imageUrl} alt={draft.name} className="h-full w-full object-contain" /> : "No image"}</div>
            <div className="min-w-0 flex-1 space-y-2">
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { setUploadError(""); setSelectedFile(event.target.files?.[0] ?? null); }} className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs" />
              {selectedFile && <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><strong>Selected:</strong> {selectedFile.name}</div>}
              <button type="button" disabled={!selectedFile || uploading} onClick={() => void uploadImage()} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40">{uploading ? "Uploading image…" : "Upload selected image"}</button>
              <p className="text-[11px] text-slate-500">Use a 600 × 600 PNG, JPG or WebP. Uploading replaces the current image.</p>
              {uploadError && <p className="text-xs text-red-700">{uploadError}</p>}
            </div>
          </div>
        </section>

        <label className="block text-xs font-medium">Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium">RRP / customer price<Input type="number" min="0" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="mt-1" /></label>
        <label className="block text-xs font-medium">Linked recipe<select value={draft.recipeId} onChange={(event) => setDraft({ ...draft, recipeId: event.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm"><option value="">No recipe linked</option>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select><span className="mt-1 block text-[11px] text-slate-500">Linking does not automatically publish or overwrite the recipe.</span></label>
        <section className="rounded-xl border p-3"><p className="text-xs font-medium text-slate-500">Modifiers / POS upsell groups</p><div className="mt-3 space-y-2">{modifierGroups.length === 0 ? <p className="text-sm text-slate-500">No modifier groups available.</p> : modifierGroups.map((group) => { const id = String(group.id || ""); const optionCount = (group.options || group.modifiers || []).length; return <label key={id || group.name} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"><span><strong className="text-sm">{group.name}</strong><span className="ml-2 text-xs text-slate-500">{optionCount} option{optionCount === 1 ? "" : "s"}</span></span><input type="checkbox" checked={draft.modifierGroupIds.includes(id)} onChange={() => toggleModifier(id)} /></label>; })}</div></section>
        <label className="block text-xs font-medium">Display order<Input type="number" value={draft.displayOrder} onChange={(event) => setDraft({ ...draft, displayOrder: event.target.value })} className="mt-1" /></label>
        <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Available/customer-visible</span><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /></label>
        {saveBlockedReason && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{saveBlockedReason}</p>}
        {save.isError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{(save.error as Error)?.message || "Could not save menu item"}</p>}
        <button disabled={Boolean(saveBlockedReason) || save.isPending} onClick={() => save.mutate()} className="w-full rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{save.isPending ? "Saving…" : "Save menu item"}</button>
      </div>
    </aside>
  </div>;
}

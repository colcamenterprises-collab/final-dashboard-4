import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";

type MenuCategory = { id: string; name: string; isActive?: boolean };
type CreatedMenuItem = { id: string; name: string; [key: string]: unknown };
type Props = {
  categories: MenuCategory[];
  onClose: () => void;
  onCreated: (item: CreatedMenuItem) => void;
};

export default function MenuItemCreateModal({ categories, onClose, onCreated }: Props) {
  const activeCategories = categories.filter((category) => category.isActive !== false);
  const [draft, setDraft] = useState({
    name: "",
    categoryId: activeCategories[0]?.id || "",
    description: "",
    directPrice: "",
    grabPrice: "",
    displayOrder: "0",
    isActive: true,
  });

  const directPrice = Number(draft.directPrice);
  const grabPrice = draft.grabPrice === "" ? directPrice : Number(draft.grabPrice);
  const validationError = !draft.name.trim()
    ? "Enter a product name."
    : !draft.categoryId
      ? "Select a category."
      : !Number.isFinite(directPrice) || directPrice <= 0
        ? "Enter a Direct / POS price above zero."
        : !Number.isFinite(grabPrice) || grabPrice < 0
          ? "Enter a valid Grab price."
          : "";

  const create = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("/api/menu-v3/items/create", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name.trim(),
          categoryId: draft.categoryId,
          description: draft.description.trim() || null,
          directPrice,
          price: directPrice,
          grabPrice,
          displayOrder: Number(draft.displayOrder || 0),
          isActive: draft.isActive,
          posEnabled: true,
          isOnlineEnabled: true,
        }),
      });
      if (!result?.id) throw new Error("Menu item was created without an item ID");
      return result as CreatedMenuItem;
    },
    onSuccess: async (item) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/pos/catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/pos/menu"] }),
      ]);
      onCreated(item);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">New menu product</p>
            <h2 className="text-xl font-bold text-slate-950">Add Menu Item</h2>
            <p className="mt-1 text-xs text-slate-500">Create the product first, then continue into Product Builder for image, recipe, options and modifiers.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-xs font-semibold">Close</button>
        </header>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600 md:col-span-2">Product name
            <Input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Biggest Meal Deal Ever" className="mt-1.5" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Category
            <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Select category</option>
              {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Display order
            <Input type="number" value={draft.displayOrder} onChange={(event) => setDraft({ ...draft, displayOrder: event.target.value })} className="mt-1.5" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Direct / POS price (THB)
            <Input type="number" min="0.01" step="0.01" value={draft.directPrice} onChange={(event) => setDraft({ ...draft, directPrice: event.target.value })} className="mt-1.5" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Grab price (THB)
            <Input type="number" min="0" step="0.01" value={draft.grabPrice} onChange={(event) => setDraft({ ...draft, grabPrice: event.target.value })} placeholder="Defaults to Direct price" className="mt-1.5" />
          </label>
          <label className="text-xs font-semibold text-slate-600 md:col-span-2">Description
            <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Customer-facing product description" className="mt-1.5 min-h-24 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center justify-between rounded-xl border p-3 text-sm md:col-span-2">
            <span><strong className="block">Available immediately</strong><span className="text-xs text-slate-500">Turn off to create the item as unavailable while you finish setup.</span></span>
            <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="h-5 w-5" />
          </label>
        </div>

        <footer className="flex flex-col gap-2 border-t bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {validationError && <p className="text-xs text-amber-700">{validationError}</p>}
            {create.isError && <p className="text-xs text-red-700">{(create.error as Error)?.message || "Could not create menu item"}</p>}
          </div>
          <button type="button" disabled={Boolean(validationError) || create.isPending} onClick={() => create.mutate()} className="rounded-xl bg-black px-6 py-3 text-sm font-bold text-white disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create & Continue Setup"}
          </button>
        </footer>
      </div>
    </div>
  );
}

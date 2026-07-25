import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { asArray, normalizeMenuCategories, normalizeMenuItems } from "@/lib/menuData";

type Category = { id: string; name: string; sortOrder?: number; displayOrder?: number; isActive?: boolean };
type ModifierOption = { id?: string; name: string; price?: number | string; priceDelta?: number | string; active?: boolean; isActive?: boolean };
type ModifierGroup = { id?: string; name: string; menuItemId?: string; linkedMenuItemIds?: string[]; options?: ModifierOption[]; modifiers?: ModifierOption[]; isActive?: boolean };
type Item = { id: string; categoryId?: string; category?: string | { name?: string }; name: string; description?: string | null; basePrice?: number | string; price?: number | string; directPrice?: number | string; grabPrice?: number | string; imageUrl?: string | null; isActive?: boolean; soldOut?: boolean; posEnabled?: boolean; onlineEnabled?: boolean; isOnlineEnabled?: boolean; displayOrder?: number | string; sortOrder?: number | string };

const money = (value: unknown) => `฿${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const fallbackImage = "/burger-placeholder.png";
const itemCategory = (item: Item, categoryMap: Record<string, string>) => typeof item.category === "string" ? item.category : categoryMap[item.categoryId || ""] || item.category?.name || "Uncategorised";

export default function PosCatalog() {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Item | null>(null);
  const [saveMessage, setSaveMessage] = useState("");

  const { data: rawItems, isLoading: itemsLoading, error: itemsError } = useQuery<unknown>({ queryKey: ["/api/menu-v3/items"] });
  const { data: rawCategories, isLoading: categoriesLoading } = useQuery<unknown>({ queryKey: ["/api/menu-v3/categories"] });
  const { data: modifierData, isLoading: modifiersLoading } = useQuery<{ groups?: ModifierGroup[] } | ModifierGroup[]>({ queryKey: ["/api/menu-v3/modifiers/groups"] });

  const items = asArray<Item>(normalizeMenuItems<Item>(rawItems).items);
  const categories = asArray<Category>(normalizeMenuCategories<Category>(rawCategories).items);
  const modifierGroups = Array.isArray(modifierData) ? modifierData : asArray<ModifierGroup>(modifierData?.groups);
  const categoryMap = useMemo(() => categories.reduce<Record<string, string>>((map, category) => { map[category.id] = category.name; return map; }, {}), [categories]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = items.filter((item) => !term || [item.name, item.description, itemCategory(item, categoryMap)].some((value) => String(value || "").toLowerCase().includes(term)));
    const grouped = new Map<string, Item[]>();
    for (const item of filtered) {
      const categoryName = itemCategory(item, categoryMap);
      grouped.set(categoryName, [...(grouped.get(categoryName) || []), item]);
    }
    return Array.from(grouped.entries()).sort(([nameA], [nameB]) => {
      const categoryA = categories.find((category) => category.name === nameA);
      const categoryB = categories.find((category) => category.name === nameB);
      const orderA = Number(categoryA?.sortOrder ?? categoryA?.displayOrder ?? 9999);
      const orderB = Number(categoryB?.sortOrder ?? categoryB?.displayOrder ?? 9999);
      return orderA === orderB ? nameA.localeCompare(nameB) : orderA - orderB;
    }).map(([categoryName, categoryItems]) => [categoryName, [...categoryItems].sort((a, b) => Number(a.displayOrder ?? a.sortOrder ?? 0) - Number(b.displayOrder ?? b.sortOrder ?? 0))] as const);
  }, [items, categories, categoryMap, search]);

  const modifiersFor = (itemId: string) => modifierGroups.filter((group) => group.isActive !== false && (group.menuItemId === itemId || group.linkedMenuItemIds?.includes(itemId)));

  const saveItem = async () => {
    if (!editing) return;
    setSaveMessage("Saving…");
    try {
      await apiRequest("/api/menu-v3/items/update", {
        method: "POST",
        body: JSON.stringify({
          id: editing.id,
          name: editing.name,
          categoryId: editing.categoryId,
          description: editing.description,
          price: editing.directPrice ?? editing.basePrice ?? editing.price,
          directPrice: editing.directPrice ?? editing.basePrice ?? editing.price,
          grabPrice: editing.grabPrice,
          imageUrl: editing.imageUrl,
          isActive: editing.isActive !== false,
          soldOut: editing.soldOut === true,
          posEnabled: editing.posEnabled !== false,
          onlineEnabled: editing.onlineEnabled ?? editing.isOnlineEnabled ?? true,
          displayOrder: editing.displayOrder ?? editing.sortOrder ?? 0,
        }),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/menu-v3/items"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/pos/menu"] }),
      ]);
      setSaveMessage("Live catalogue updated.");
      window.setTimeout(() => { setEditing(null); setSaveMessage(""); }, 700);
    } catch (error: any) {
      setSaveMessage(error?.message || "Could not update catalogue item.");
    }
  };

  const isLoading = itemsLoading || categoriesLoading || modifiersLoading;

  return <div className="mx-auto max-w-7xl space-y-5 p-4">
    <div><h1 className="text-2xl font-bold text-slate-950">POS / Online Ordering Catalogue</h1><p className="mt-1 text-sm text-slate-500">Operational view of published Menu Items, Categories and Modifiers. Changes made here update the same live records used by the POS.</p></div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search published items" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" /></div>
    {isLoading && <p className="py-16 text-center text-sm text-slate-500">Loading live catalogue…</p>}
    {itemsError && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load the live catalogue.</p>}
    {!isLoading && !itemsError && groups.length === 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No published menu items matched this search.</p>}
    {!isLoading && !itemsError && <div className="space-y-6">{groups.map(([categoryName, categoryItems]) => {
      const isCollapsed = collapsed[categoryName] === true;
      return <section key={categoryName} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button type="button" onClick={() => setCollapsed((current) => ({ ...current, [categoryName]: !isCollapsed }))} className="flex w-full items-center justify-between text-left"><div><h2 className="text-xl font-bold text-slate-950">{categoryName}</h2><p className="text-xs text-slate-500">{categoryItems.length} item{categoryItems.length === 1 ? "" : "s"}</p></div><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100">{isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}</span></button>
        {!isCollapsed && <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{categoryItems.map((item) => {
          const attached = modifiersFor(item.id);
          const available = item.isActive !== false && item.soldOut !== true && item.posEnabled !== false;
          return <button key={item.id} onClick={() => setEditing({ ...item })} className="flex min-h-36 gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-yellow-400 hover:shadow-sm"><div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100"><img src={item.imageUrl || fallbackImage} alt={item.name} className="h-full w-full object-contain" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold text-slate-900">{item.name}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${available ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{available ? "Live" : item.soldOut ? "Sold out" : "Hidden"}</span></div><p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description || "No description"}</p><p className="mt-2 font-mono text-xs text-slate-800">Direct {money(item.directPrice ?? item.basePrice ?? item.price)} · Grab {money(item.grabPrice ?? item.directPrice ?? item.price)}</p><div className="mt-2 flex flex-wrap gap-1">{attached.length ? attached.map((group) => <span key={group.id || group.name} className="rounded-full bg-yellow-100 px-2 py-1 text-[10px] font-semibold text-yellow-900">{group.name} · {(group.options || group.modifiers || []).filter((option) => option.isActive !== false && option.active !== false).length} options</span>) : <span className="text-[10px] text-slate-400">No modifiers attached</span>}</div></div></button>;
        })}</div>}
      </section>;
    })}</div>}
    {editing && <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setEditing(null)}><aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-start justify-between"><div><p className="text-xs text-slate-500">Published menu item</p><h2 className="text-xl font-bold">{editing.name}</h2></div><button onClick={() => setEditing(null)} className="rounded-lg border px-3 py-1.5 text-sm">Close</button></div><div className="space-y-4"><label className="block text-sm font-medium">Name<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm font-medium">Category<select value={editing.categoryId || ""} onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })} className="mt-1 w-full rounded-lg border p-2">{categories.filter((category) => category.isActive !== false).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="block text-sm font-medium">Description<textarea value={editing.description || ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} className="mt-1 min-h-24 w-full rounded-lg border p-2" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Direct price<input type="number" value={editing.directPrice ?? editing.basePrice ?? editing.price ?? 0} onChange={(event) => setEditing({ ...editing, directPrice: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm font-medium">Grab price<input type="number" value={editing.grabPrice ?? editing.directPrice ?? editing.price ?? 0} onChange={(event) => setEditing({ ...editing, grabPrice: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label></div><label className="block text-sm font-medium">Image URL<input value={editing.imageUrl || ""} onChange={(event) => setEditing({ ...editing, imageUrl: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label><div className="grid grid-cols-3 gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={editing.isActive !== false} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} />Active</label><label className="flex items-center gap-2"><input type="checkbox" checked={editing.soldOut === true} onChange={(event) => setEditing({ ...editing, soldOut: event.target.checked })} />Sold out</label><label className="flex items-center gap-2"><input type="checkbox" checked={editing.posEnabled !== false} onChange={(event) => setEditing({ ...editing, posEnabled: event.target.checked })} />POS visible</label></div><div className="rounded-lg border bg-slate-50 p-3"><p className="text-sm font-semibold">Attached modifiers</p><div className="mt-2 space-y-2">{modifiersFor(editing.id).length ? modifiersFor(editing.id).map((group) => <div key={group.id || group.name}><p className="text-xs font-semibold">{group.name}</p><p className="text-xs text-slate-500">{(group.options || group.modifiers || []).filter((option) => option.isActive !== false && option.active !== false).map((option) => `${option.name} (+${money(option.priceDelta ?? option.price)})`).join(" · ") || "No active options"}</p></div>) : <p className="text-xs text-slate-500">No modifiers attached. Attach them from Menu → Modifiers.</p>}</div></div><button type="button" onClick={saveItem} className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black">Save to live catalogue</button>{saveMessage && <p className="text-center text-sm text-slate-600">{saveMessage}</p>}</div></aside></div>}
  </div>;
}

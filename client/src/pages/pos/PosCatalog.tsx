import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Plus, Search } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

type Category = { id: string; name_en: string; sort_order: number; is_active: boolean };
type Item = { id: string; category_id: string; category_name: string; name_en: string; description_en?: string | null; price: number | string; direct_price?: number | string | null; grab_price?: number | string | null; image_url?: string | null; is_active: boolean; is_sold_out: boolean; pos_enabled: boolean; sort_order: number };
type Catalog = { categories: Category[]; items: Item[] };
const money = (value: number | string | null | undefined) => `฿${Number(value || 0).toFixed(0)}`;

export default function PosCatalog() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [newItem, setNewItem] = useState<Item | null>(null);
  const [saveState, setSaveState] = useState<{ kind: "idle" | "saving" | "success" | "error"; message?: string }>({ kind: "idle" });
  const { data, isLoading, error } = useQuery<Catalog>({ queryKey: ["/api/pos/catalog"] });
  const categories = data?.categories || [];
  const items = data?.items || [];
  const filtered = useMemo(() => items.filter((item) => [item.name_en, item.category_name].join(" ").toLowerCase().includes(search.toLowerCase())), [items, search]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/pos/catalog"] });

  async function upload(file: File) {
    const form = new FormData();
    form.append("image", file);
    const response = await fetch("/api/upload/menu-item-image", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Image upload failed");
    setDraft({ image_url: result.imageUrl });
  }

  const draft: Item | null = editing || newItem;
  const setDraft = (patch: Partial<Item>) => {
    if (creating) setNewItem((item) => item ? { ...item, ...patch } : item);
    else setEditing((item) => item ? { ...item, ...patch } : item);
  };

  async function persistDraft() {
    if (!draft || !draft.name_en.trim() || !draft.category_id) return;
    setSaveState({ kind: "saving" });
    try {
      const response = await fetch(creating ? "/api/pos/catalog/items" : `/api/pos/catalog/items/${draft.id}`, {
        method: creating ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const raw = await response.text();
      let result: any = {};
      try { result = raw ? JSON.parse(raw) : {}; } catch { throw new Error("The server returned an invalid save response."); }
      if (!response.ok) throw new Error(result.error || `Could not save item (${response.status}).`);
      invalidate();
      setSaveState({ kind: "success", message: "POS item saved." });
      window.setTimeout(() => { setEditing(null); setNewItem(null); setCreating(false); setSaveState({ kind: "idle" }); }, 700);
    } catch (error: any) {
      setSaveState({ kind: "error", message: error?.message || "Could not save this POS item." });
    }
  }

  return <div className="mx-auto max-w-6xl space-y-5 p-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-950">POS Catalogue</h1><p className="mt-1 text-sm text-slate-500">Live POS items and images. This is separate from the unfinished Menu section.</p></div><button onClick={() => { setEditing(null); setNewItem({ id: "", category_id: categories[0]?.id || "", category_name: "", name_en: "", price: 0, direct_price: 0, grab_price: 0, image_url: null, is_active: true, is_sold_out: false, pos_enabled: true, sort_order: items.length }); setCreating(true); }} className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-black"><Plus className="h-4 w-4" />Add POS item</button></div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search POS items" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" /></div>
    {isLoading && <p className="py-16 text-center text-sm text-slate-500">Loading POS catalogue…</p>}
    {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load the POS catalogue.</p>}
    {!isLoading && !error && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <button key={item.id} onClick={() => { setCreating(false); setEditing({ ...item }); }} className="flex min-h-28 gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-yellow-400"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">{item.image_url ? <img src={item.image_url} alt={item.name_en} className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6" />}</div><div className="min-w-0"><p className="font-semibold text-slate-900">{item.name_en}</p><p className="mt-1 text-xs text-slate-500">{item.category_name}</p><p className="mt-2 font-mono text-sm text-slate-800">Direct {money(item.direct_price ?? item.price)} · Grab {money(item.grab_price ?? item.price)}</p><p className={`mt-1 text-xs ${item.is_active && !item.is_sold_out ? "text-emerald-700" : "text-slate-400"}`}>{item.is_active && !item.is_sold_out ? "Available" : "Unavailable"}</p></div></button>)}</div>}
    {draft && <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => { setEditing(null); setCreating(false); }}><aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-start justify-between"><div><p className="text-xs text-slate-500">{creating ? "New POS item" : "Edit POS item"}</p><h2 className="text-xl font-bold">{draft.name_en || "Untitled item"}</h2></div><button onClick={() => { setEditing(null); setCreating(false); }} className="rounded-lg border px-3 py-1.5 text-sm">Close</button></div><div className="space-y-4"><label className="block text-sm font-medium">Name<input value={draft.name_en} onChange={(e) => setDraft({ name_en: e.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm font-medium">Category<select value={draft.category_id} onChange={(e) => setDraft({ category_id: e.target.value })} className="mt-1 w-full rounded-lg border p-2">{categories.map((category) => <option key={category.id} value={category.id}>{category.name_en}</option>)}</select></label><label className="block text-sm font-medium">Description<textarea value={draft.description_en || ""} onChange={(e) => setDraft({ description_en: e.target.value })} className="mt-1 min-h-24 w-full rounded-lg border p-2" /></label><div className="grid grid-cols-3 gap-3"><label className="text-sm font-medium">Base<input type="number" value={draft.price} onChange={(e) => setDraft({ price: e.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm font-medium">Direct<input type="number" value={draft.direct_price ?? draft.price} onChange={(e) => setDraft({ direct_price: e.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm font-medium">Grab<input type="number" value={draft.grab_price ?? draft.price} onChange={(e) => setDraft({ grab_price: e.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label></div><div><p className="text-sm font-medium">Image</p><div className="mt-1 flex gap-3"><div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">{draft.image_url ? <img src={draft.image_url} alt="Preview" className="h-full w-full object-cover" /> : <ImagePlus className="text-slate-400" />}</div><div className="flex-1"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file).catch((err) => window.alert(err.message)); }} className="w-full text-sm" /><input value={draft.image_url || ""} onChange={(e) => setDraft({ image_url: e.target.value })} placeholder="Or image URL" className="mt-3 w-full rounded-lg border p-2 text-sm" /></div></div></div><div className="grid grid-cols-3 gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ is_active: e.target.checked })} />Active</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_sold_out} onChange={(e) => setDraft({ is_sold_out: e.target.checked })} />Sold out</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.pos_enabled} onChange={(e) => setDraft({ pos_enabled: e.target.checked })} />Visible in POS</label></div><div className="space-y-2"><button type="button" disabled={saveState.kind === "saving" || !draft.name_en || !draft.category_id} onClick={persistDraft} className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black disabled:opacity-50">{saveState.kind === "saving" ? "Saving…" : creating ? "Create POS item" : "Save POS item"}</button>{saveState.kind !== "idle" && <p role="status" className={`text-center text-sm ${saveState.kind === "error" ? "text-red-600" : "text-emerald-700"}`}>{saveState.message || "Saving…"}</p>}</div></div></aside></div>}
  </div>;
}

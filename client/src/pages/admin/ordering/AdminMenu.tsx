import { useEffect, useMemo, useState } from "react";
import { fetchOrderingMenu, money } from "@/components/ordering/orderingApi";

async function save(path: string, body: any) {
  const res = await fetch(path, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminMenu() {
  const [menu, setMenu] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const allItems = useMemo(() => menu.flatMap((category) => (category.items ?? []).map((item: any) => ({ ...item, categoryName: category.name_en }))), [menu]);

  async function load() {
    try {
      const data = await fetchOrderingMenu(true);
      setMenu(data.categories ?? []);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  function draftFor(item: any) {
    return drafts[item.id] ?? {
      name_en: item.name_en ?? "",
      description_en: item.description_en ?? "",
      price: item.price ?? "0.00",
      category_id: item.category_id,
      is_active: item.is_active,
    };
  }

  function updateDraft(item: any, patch: any) {
    setDrafts((prev) => ({ ...prev, [item.id]: { ...draftFor(item), ...patch } }));
  }

  async function saveItem(item: any, patch?: any) {
    setError("");
    setSaved("");
    try {
      await save(`/api/ordering/admin/items/${item.id}`, patch ?? draftFor(item));
      setDrafts((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
      setSaved("Menu item saved. Public ordering menu updates immediately.");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main className="p-4">
      <h1 className="text-3xl font-bold">Ordering Menu Manager</h1>
      {saved && <div className="mt-4 rounded border border-green-300 bg-green-50 p-3">{saved}</div>}
      {error && <div className="mt-4 rounded border border-red-300 bg-red-50 p-3">{error}</div>}
      <section className="mt-6 rounded border bg-white p-4">
        <h2 className="text-xl font-semibold">Current menu</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse border">
            <thead><tr><th className="border p-2">Enabled</th><th className="border p-2">Name</th><th className="border p-2">Description</th><th className="border p-2">Price</th><th className="border p-2">Category</th><th className="border p-2">Save</th></tr></thead>
            <tbody>{allItems.map((item: any) => {
              const draft = draftFor(item);
              return <tr key={item.id}>
                <td className="border p-2 text-center"><input type="checkbox" checked={draft.is_active} onChange={(event) => updateDraft(item, { is_active: event.target.checked })} /></td>
                <td className="border p-2"><input className="w-full rounded border p-2" value={draft.name_en} onChange={(event) => updateDraft(item, { name_en: event.target.value })} /></td>
                <td className="border p-2"><input className="w-full rounded border p-2" value={draft.description_en ?? ""} onChange={(event) => updateDraft(item, { description_en: event.target.value })} /></td>
                <td className="border p-2"><input className="w-28 rounded border p-2" value={draft.price} onChange={(event) => updateDraft(item, { price: event.target.value })} /><div className="text-xs text-gray-600">{money(draft.price)}</div></td>
                <td className="border p-2"><select className="w-full rounded border p-2" value={draft.category_id} onChange={(event) => updateDraft(item, { category_id: event.target.value })}>{menu.map((category) => <option key={category.id} value={category.id}>{category.name_en}</option>)}</select></td>
                <td className="border p-2"><button className="rounded border px-3 py-2" onClick={() => saveItem(item)}>Save</button><button className="ml-2 rounded border px-3 py-2" onClick={() => saveItem(item, { is_active: !item.is_active })}>{item.is_active ? "Disable" : "Enable"}</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

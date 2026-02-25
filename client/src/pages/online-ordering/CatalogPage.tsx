import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type CatalogItem = {
  id: number;
  sourceType: "recipe" | "manual";
  sourceId: number | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  price: number;
  isPublished: boolean;
  sortOrder: number;
};

type ManualForm = {
  name: string;
  category: string;
  price: string;
  description: string;
  imageUrl: string;
};

const emptyForm: ManualForm = { name: "", category: "", price: "", description: "", imageUrl: "" };

export default function OnlineOrderingCatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ManualForm>(emptyForm);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/catalog");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load catalog");
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error: any) {
      toast({ title: "Failed to load catalog", description: error?.message || "Request failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreateManual = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/catalog/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim() || null,
          description: form.description.trim() || null,
          imageUrl: form.imageUrl.trim() || null,
          price: Number(form.price) || 0,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to create manual item");
      setForm(emptyForm);
      toast({ title: "Catalog item added", variant: "success" as any });
      await load();
    } catch (error: any) {
      toast({ title: "Create failed", description: error?.message || "Request failed", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const updateItem = async (id: number, patch: Record<string, unknown>) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/catalog/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Update failed");
      await load();
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message || "Request failed", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const deleteItem = async (id: number) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/catalog/${id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Delete failed");
      toast({ title: "Catalog item deleted", variant: "success" as any });
      await load();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error?.message || "Request failed", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Online Ordering Catalog</h1>
        <p className="text-sm text-slate-600 mt-1">Source of truth for online ordering items.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="font-medium text-slate-900">Add Item (Manual)</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
        </div>
        <Button onClick={onCreateManual} disabled={creating}>{creating ? "Adding..." : "Add Item"}</Button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Price</th>
              <th className="p-3 text-left">Published</th>
              <th className="p-3 text-left">Source</th>
              <th className="p-3 text-left">Edit</th>
              <th className="p-3 text-left">Delete</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-4">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="p-4">No catalog items.</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="p-3">{item.name}</td>
                <td className="p-3">{item.category || "Unmapped"}</td>
                <td className="p-3">{Number(item.price || 0).toFixed(2)}</td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={item.isPublished}
                    onChange={(e) => updateItem(item.id, { isPublished: e.target.checked })}
                    disabled={saving === item.id}
                  />
                </td>
                <td className="p-3">{item.sourceType}{item.sourceId ? ` #${item.sourceId}` : ""}</td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const price = window.prompt("Price", String(item.price ?? 0));
                      const category = window.prompt("Category", item.category || "");
                      const name = window.prompt("Name", item.name || "");
                      if (name == null || price == null || category == null) return;
                      updateItem(item.id, { name, price: Number(price) || 0, category });
                    }}
                    disabled={saving === item.id}
                  >
                    Edit
                  </Button>
                </td>
                <td className="p-3">
                  <Button size="sm" variant="destructive" onClick={() => deleteItem(item.id)} disabled={saving === item.id}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

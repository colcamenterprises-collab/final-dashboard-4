import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type ProductItem = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  online_category: string | null;
  price_online: number | null;
  visible_online: boolean;
};

export default function OnlineOrderingCatalogPage() {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/online/products/catalog");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to load products");
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error: any) {
      toast({ title: "Failed to load products", description: error?.message || "Request failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patchProduct = async (id: number, patch: Record<string, unknown>, successTitle = "Updated successfully") => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/online/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (payload?.error === "Missing Online Price") {
          toast({ title: "Missing Online Price", variant: "destructive" });
          return;
        }
        throw new Error(payload?.error || "Update failed");
      }

      toast({ title: successTitle, variant: "success" as any });
      await load();
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message || "Request failed", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const updateDraft = (id: number, patch: Partial<ProductItem>) => {
    setItems((curr) => curr.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Online Ordering Catalog</h1>
        <p className="text-sm text-slate-600 mt-1">Edit products and publish them directly to Online Ordering.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Online Price</th>
              <th className="p-3 text-left">Image URL</th>
              <th className="p-3 text-left">Publish</th>
              <th className="p-3 text-left">Save</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-4">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="p-4">No products available.</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 align-top">
                <td className="p-3 min-w-[180px]">
                  <Input value={item.name || ""} onChange={(e) => updateDraft(item.id, { name: e.target.value })} />
                </td>
                <td className="p-3 min-w-[260px]">
                  <Input value={item.description || ""} onChange={(e) => updateDraft(item.id, { description: e.target.value })} />
                </td>
                <td className="p-3 min-w-[170px]">
                  <Input value={item.online_category || ""} onChange={(e) => updateDraft(item.id, { online_category: e.target.value })} />
                </td>
                <td className="p-3 min-w-[130px]">
                  <Input
                    type="number"
                    value={item.price_online ?? ""}
                    onChange={(e) => updateDraft(item.id, { price_online: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </td>
                <td className="p-3 min-w-[220px]">
                  <Input value={item.imageUrl || ""} onChange={(e) => updateDraft(item.id, { imageUrl: e.target.value })} />
                </td>
                <td className="p-3">
                  {item.visible_online ? (
                    <Button size="sm" variant="secondary" disabled>
                      Live
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => patchProduct(item.id, { visible_online: true, price_online: item.price_online }, "Published to Online Ordering")}
                      disabled={savingId === item.id}
                    >
                      Add to Online Ordering
                    </Button>
                  )}
                </td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => patchProduct(item.id, {
                      name: item.name,
                      description: item.description,
                      online_category: item.online_category,
                      price_online: item.price_online,
                      imageUrl: item.imageUrl,
                    })}
                    disabled={savingId === item.id}
                  >
                    Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon } from "lucide-react";

type ProductMenuItem = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  category: string | null;
  sortOrder: number;
  visibility: {
    inStore: boolean;
    grab: boolean;
    online: boolean;
  };
  prices: Record<string, number>;
};

type ProductMenuCategory = {
  name: string;
  items: ProductMenuItem[];
};

type ProductMenuResponse = {
  ok: boolean;
  categories: ProductMenuCategory[];
};

export default function MenuManagement() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<number, { category: string; sortOrder: string }>>({});

  const { data, isLoading } = useQuery<ProductMenuResponse>({
    queryKey: ["/api/product-menu"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      productId,
      category,
      sortOrder,
      visibility,
    }: {
      productId: number;
      category?: string | null;
      sortOrder?: number;
      visibility?: { inStore?: boolean; grab?: boolean; online?: boolean };
    }) => {
      const res = await apiRequest(`/api/product-menu/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ category, sortOrder, visibility }),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-menu"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const categories = data?.categories || [];

  const draftsFor = (item: ProductMenuItem) => {
    return (
      drafts[item.id] || {
        category: item.category || "",
        sortOrder: String(item.sortOrder ?? 0),
      }
    );
  };

  const updateDraft = (id: number, field: "category" | "sortOrder", value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { category: "", sortOrder: "0" }),
        [field]: value,
      },
    }));
  };

  const saveDraft = (item: ProductMenuItem) => {
    const draft = draftsFor(item);
    updateMutation.mutate({
      productId: item.id,
      category: draft.category || null,
      sortOrder: Number(draft.sortOrder) || 0,
    });
  };

  const handleToggle = (
    item: ProductMenuItem,
    next: { inStore?: boolean; grab?: boolean; online?: boolean }
  ) => {
    updateMutation.mutate({
      productId: item.id,
      visibility: next,
    });
  };

  const totalItems = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.items.length, 0),
    [categories]
  );

  if (isLoading) {
    return <div className="text-center py-8 text-slate-500">Loading menu view...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">Menu</h1>
        <p className="text-sm text-slate-500">
          Read-only view of products grouped by category. Update visibility and ordering only.
        </p>
        <p className="text-xs text-slate-400 mt-1">Total products: {totalItems}</p>
      </div>

      {categories.map((category) => (
        <Card key={category.name} className="rounded-[4px]">
          <CardHeader className="py-3 px-4 bg-slate-50 border-b">
            <CardTitle className="text-sm font-semibold">{category.name} ({category.items.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {category.items.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">No products in this category</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-white">
                    <th className="text-left py-2 px-4 font-medium w-16">Image</th>
                    <th className="text-left py-2 px-4 font-medium">Product</th>
                    <th className="text-left py-2 px-4 font-medium">Category</th>
                    <th className="text-left py-2 px-4 font-medium w-24">Order</th>
                    <th className="text-left py-2 px-4 font-medium">Prices</th>
                    <th className="text-center py-2 px-4 font-medium">Visibility</th>
                    <th className="text-right py-2 px-4 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {category.items.map((item) => {
                    const draft = draftsFor(item);
                    return (
                      <tr key={item.id} className="border-b hover:bg-slate-50">
                        <td className="py-2 px-4">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-10 w-10 object-cover rounded" />
                          ) : (
                            <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-slate-400" />
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          <div className="font-medium">{item.name}</div>
                          {item.description && <div className="text-xs text-slate-500 line-clamp-2">{item.description}</div>}
                        </td>
                        <td className="py-2 px-4">
                          <Input
                            value={draft.category}
                            onChange={(e) => updateDraft(item.id, "category", e.target.value)}
                            className="h-8 text-xs rounded-[4px]"
                            placeholder="UNMAPPED"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <Input
                            value={draft.sortOrder}
                            onChange={(e) => updateDraft(item.id, "sortOrder", e.target.value)}
                            className="h-8 text-xs rounded-[4px]"
                            type="number"
                          />
                        </td>
                        <td className="py-2 px-4 text-xs text-slate-600">
                          <div>In-store: ฿{(item.prices.IN_STORE ?? 0).toFixed(0)}</div>
                          <div>Grab: ฿{(item.prices.GRAB ?? 0).toFixed(0)}</div>
                          <div>Online: ฿{(item.prices.ONLINE ?? 0).toFixed(0)}</div>
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex flex-col gap-2 items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Store</span>
                              <Switch
                                checked={item.visibility.inStore}
                                onCheckedChange={(checked) => handleToggle(item, { inStore: checked })}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Grab</span>
                              <Switch
                                checked={item.visibility.grab}
                                onCheckedChange={(checked) => handleToggle(item, { grab: checked })}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Online</span>
                              <Switch
                                checked={item.visibility.online}
                                onCheckedChange={(checked) => handleToggle(item, { online: checked })}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-right">
                          <Button
                            size="sm"
                            className="h-8 text-xs rounded-[4px]"
                            onClick={() => saveDraft(item)}
                            disabled={updateMutation.isPending}
                          >
                            Save
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

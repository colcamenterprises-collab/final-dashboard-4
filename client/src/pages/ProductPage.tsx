import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Ingredient = {
  id: number;
  name: string;
  purchase_cost: number | null;
  yield_per_purchase: number | null;
  yield_unit: string | null;
};

type ProductLine = {
  productIngredientId: number;
  ingredientId: number;
  ingredientName: string | null;
  quantityUsed: number;
  unitCostDerived: number | null;
  lineCostDerived: number | null;
  yieldUnit: string | null;
  prepNote?: string | null;
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  prep_notes?: string | null;
  image_url?: string | null;
  category?: string | null;
  sale_price?: number | null;
  active: boolean;
};

type IngredientsResponse = {
  items: Array<{
    id: number;
    name: string;
    packageCost?: number | null;
    packageQty?: number | null;
    packageUnit?: string | null;
    portionQty?: number | null;
    portionUnit?: string | null;
  }>;
};

type ProductResponse = {
  product: Product;
  lines: ProductLine[];
};

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === "new";

  const [product, setProduct] = useState<Product>({
    id: 0,
    name: "",
    description: "",
    prep_notes: "",
    image_url: "",
    category: "",
    sale_price: null,
    active: false,
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [lines, setLines] = useState<ProductLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [lineSaving, setLineSaving] = useState<number | null>(null);
  const [lineRemoving, setLineRemoving] = useState<number | null>(null);
  const [newLine, setNewLine] = useState<{ ingredientId: string; quantityUsed: string; prepNote: string }>({
    ingredientId: "",
    quantityUsed: "1",
    prepNote: "",
  });

  const refreshProduct = async (productId: number) => {
    const data: ProductResponse = await fetch(`/api/products/${productId}`).then((r) => r.json());
    setProduct(data.product);
    setLines(
      (data.lines || []).map((line) => ({
        ...line,
        prepNote: line.prepNote ?? "",
      })),
    );
  };

  useEffect(() => {
    (async () => {
      const ing: IngredientsResponse = await fetch("/api/ingredients").then((r) => r.json());
      const mapped = (ing.items || []).map((item) => ({
        id: item.id,
        name: item.name,
        purchase_cost: item.packageCost ?? null,
        yield_per_purchase: item.packageQty ?? item.portionQty ?? null,
        yield_unit: item.packageUnit ?? item.portionUnit ?? null,
      }));
      setIngredients(mapped);
      if (!isNew && id) {
        await refreshProduct(Number(id));
      }
    })();
  }, [id, isNew]);

  const totalCost = useMemo(() => {
    if (lines.length === 0) return null;
    if (lines.some((line) => line.lineCostDerived === null || line.lineCostDerived === undefined)) {
      return null;
    }
    return lines.reduce((sum, line) => sum + Number(line.lineCostDerived || 0), 0);
  }, [lines]);

  const margin = useMemo(() => {
    if (totalCost === null) return null;
    if (!product.sale_price || product.sale_price <= 0) return null;
    return (product.sale_price - totalCost) / product.sale_price;
  }, [product.sale_price, totalCost]);

  const cogs = useMemo(() => {
    if (totalCost === null) return null;
    if (!product.sale_price || product.sale_price <= 0) return null;
    return totalCost / product.sale_price;
  }, [product.sale_price, totalCost]);

  const ingredientById = useMemo(() => {
    const map = new Map<number, Ingredient>();
    ingredients.forEach((item) => map.set(item.id, item));
    return map;
  }, [ingredients]);

  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products${isNew ? "" : `/${product.id}`}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Save failed");
      }
      if (isNew && data.id) {
        navigate(`/products/${data.id}`, { replace: true });
      } else if (!isNew) {
        await refreshProduct(product.id);
      }
      toast({ title: "Product saved" });
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddLine = async () => {
    if (isNew) {
      toast({ title: "Save the product before adding ingredients", variant: "destructive" });
      return;
    }
    const ingredientId = Number(newLine.ingredientId);
    const quantityUsed = Number(newLine.quantityUsed);
    if (!Number.isFinite(ingredientId) || !Number.isFinite(quantityUsed) || quantityUsed <= 0) {
      toast({ title: "Invalid ingredient line", variant: "destructive" });
      return;
    }

    const res = await fetch(`/api/products/${product.id}/ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredientId, quantityUsed, prepNote: newLine.prepNote }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Line update failed", description: data.error, variant: "destructive" });
      return;
    }
    setNewLine({ ingredientId: "", quantityUsed: "1", prepNote: "" });
    await refreshProduct(product.id);
  };

  const handleUpdateLine = async (line: ProductLine) => {
    if (isNew) return;
    setLineSaving(line.productIngredientId);
    try {
      const res = await fetch(`/api/products/${product.id}/ingredients/${line.productIngredientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: line.ingredientId,
          quantityUsed: line.quantityUsed,
          prepNote: line.prepNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Line update failed");
      }
      await refreshProduct(product.id);
    } catch (error: any) {
      toast({ title: "Line update failed", description: error.message, variant: "destructive" });
    } finally {
      setLineSaving(null);
    }
  };

  const handleRemoveLine = async (lineId: number) => {
    if (isNew) return;
    setLineRemoving(lineId);
    try {
      const res = await fetch(`/api/products/${product.id}/ingredients/${lineId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Line removal failed");
      }
      await refreshProduct(product.id);
    } catch (error: any) {
      toast({ title: "Line removal failed", description: error.message, variant: "destructive" });
    } finally {
      setLineRemoving(null);
    }
  };

  const handleToggleActive = async (nextActive: boolean) => {
    if (isNew) {
      toast({ title: "Save the product before activating", variant: "destructive" });
      return;
    }
    const endpoint = nextActive ? "activate" : "deactivate";
    const res = await fetch(`/api/products/${product.id}/${endpoint}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Activation failed", description: data.error, variant: "destructive" });
      return;
    }
    setProduct((prev) => ({ ...prev, active: nextActive }));
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">{isNew ? "New Product" : "Product"}</h1>
          <Badge className={`text-[10px] rounded-[4px] ${product.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
            {product.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-xs text-slate-500">Product-first costing. All costs are derived from ingredient lines.</p>
      </div>

      <Card className="rounded-[4px]">
        <CardHeader className="px-4 py-3 border-b">
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Name</label>
              <Input
                value={product.name}
                onChange={(e) => setProduct({ ...product, name: e.target.value })}
                className="h-9 text-sm"
                placeholder="Product name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Category</label>
              <Input
                value={product.category || ""}
                onChange={(e) => setProduct({ ...product, category: e.target.value })}
                className="h-9 text-sm"
                placeholder="Category"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Image URL</label>
              <Input
                value={product.image_url || ""}
                onChange={(e) => setProduct({ ...product, image_url: e.target.value })}
                className="h-9 text-sm"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Sale Price</label>
              <Input
                value={product.sale_price ?? ""}
                onChange={(e) => setProduct({ ...product, sale_price: e.target.value === "" ? null : Number(e.target.value) })}
                className="h-9 text-sm"
                type="number"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Description</label>
            <Textarea
              value={product.description ?? ""}
              onChange={(e) => setProduct({ ...product, description: e.target.value })}
              className="min-h-[90px] text-sm"
              placeholder="Product description"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Prep Notes</label>
            <Textarea
              value={product.prep_notes || ""}
              onChange={(e) => setProduct({ ...product, prep_notes: e.target.value })}
              className="min-h-[70px] text-sm"
              placeholder="Prep notes"
            />
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              <Switch checked={product.active} onCheckedChange={handleToggleActive} disabled={isNew} />
              <span className="text-xs text-slate-600">Activation toggle</span>
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={handleSaveProduct} disabled={saving}>
              {saving ? "Saving..." : "Save Product"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px]">
        <CardHeader className="px-4 py-3 border-b">
          <CardTitle className="text-sm">Ingredient Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="mb-4 grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Ingredient</label>
              <select
                value={newLine.ingredientId}
                onChange={(e) => setNewLine((prev) => ({ ...prev, ingredientId: e.target.value }))}
                className="h-9 w-full rounded-[4px] border border-slate-200 bg-white px-2 text-sm"
              >
                <option value="">Select ingredient</option>
                {ingredients.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Quantity</label>
              <Input
                value={newLine.quantityUsed}
                onChange={(e) => setNewLine((prev) => ({ ...prev, quantityUsed: e.target.value }))}
                className="h-9 text-sm"
                type="number"
                min="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Prep Note</label>
              <Input
                value={newLine.prepNote}
                onChange={(e) => setNewLine((prev) => ({ ...prev, prepNote: e.target.value }))}
                className="h-9 text-sm"
                placeholder="Optional"
              />
            </div>
            <Button size="sm" className="h-9 text-xs" onClick={handleAddLine} disabled={isNew}>
              <Plus className="h-3 w-3 mr-1" /> Add Line
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left py-2 px-2">Ingredient</th>
                  <th className="text-left py-2 px-2">Qty</th>
                  <th className="text-left py-2 px-2">Unit</th>
                  <th className="text-right py-2 px-2">Unit Cost</th>
                  <th className="text-right py-2 px-2">Line Cost</th>
                  <th className="text-left py-2 px-2">Prep Note</th>
                  <th className="text-right py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const ingredient = ingredientById.get(line.ingredientId);
                  return (
                    <tr key={line.productIngredientId} className="border-b">
                      <td className="py-2 px-2">
                        <select
                          value={String(line.ingredientId)}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((item) =>
                                item.productIngredientId === line.productIngredientId
                                  ? { ...item, ingredientId: Number(e.target.value) }
                                  : item,
                              ),
                            )
                          }
                          className="h-8 w-full rounded-[4px] border border-slate-200 bg-white px-2 text-xs"
                        >
                          {ingredients.map((item) => (
                            <option key={item.id} value={String(item.id)}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          value={String(line.quantityUsed ?? "")}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((item) =>
                                item.productIngredientId === line.productIngredientId
                                  ? { ...item, quantityUsed: Number(e.target.value) }
                                  : item,
                              ),
                            )
                          }
                          className="h-8 text-xs"
                          type="number"
                          min="0"
                        />
                      </td>
                      <td className="py-2 px-2 text-slate-500">
                        {ingredient?.yield_unit || line.yieldUnit || "—"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {line.unitCostDerived === null || line.unitCostDerived === undefined
                          ? "—"
                          : Number(line.unitCostDerived).toFixed(4)}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-emerald-700">
                        {line.lineCostDerived === null || line.lineCostDerived === undefined
                          ? "—"
                          : Number(line.lineCostDerived).toFixed(4)}
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          value={line.prepNote ?? ""}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((item) =>
                                item.productIngredientId === line.productIngredientId
                                  ? { ...item, prepNote: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => handleUpdateLine(line)}
                            disabled={lineSaving === line.productIngredientId}
                          >
                            {lineSaving === line.productIngredientId ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500"
                            onClick={() => handleRemoveLine(line.productIngredientId)}
                            disabled={lineRemoving === line.productIngredientId}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No ingredient lines yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px]">
        <CardHeader className="px-4 py-3 border-b">
          <CardTitle className="text-sm">Cost Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-slate-500">Total Cost</div>
            <div className="text-sm font-semibold text-slate-900">
              {totalCost === null ? "—" : `฿${totalCost.toFixed(2)}`}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Margin</div>
            <div className="text-sm font-semibold text-slate-900">
              {margin === null ? "—" : `${(margin * 100).toFixed(1)}%`}
            </div>
          </div>
          <div>
            <div className="text-slate-500">COGS</div>
            <div className="text-sm font-semibold text-slate-900">
              {cogs === null ? "—" : `${(cogs * 100).toFixed(1)}%`}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

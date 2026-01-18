/**
 * PATCH P1: Product Editor Component
 * 
 * Responsive modal for creating/editing products with:
 * - Multi-channel pricing (IN_STORE, GRAB, ONLINE)
 * - Ingredient-based cost calculation
 * - Margin display per channel
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ProductIngredient = {
  id?: number;
  ingredientId: number;
  name: string;
  baseUnit: string;
  portionQty: number;
  unitCost: number;
};

type ProductPrice = {
  channel: string;
  price: number;
};

interface ProductEditorProps {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const CHANNELS = ['IN_STORE', 'GRAB', 'ONLINE'] as const;

export function ProductEditor({ productId, isOpen, onClose, onSaved }: ProductEditorProps) {
  const { toast } = useToast();
  const isEdit = productId !== null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [active, setActive] = useState(false);
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState({ inStore: false, grab: false, online: false });
  const [recipeId, setRecipeId] = useState("");
  const [ingredients, setIngredients] = useState<ProductIngredient[]>([]);
  const [baseCost, setBaseCost] = useState<number | null>(null);
  const [prices, setPrices] = useState<ProductPrice[]>([
    { channel: "IN_STORE", price: 0 },
    { channel: "GRAB", price: 0 },
    { channel: "ONLINE", price: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const { data: recipesData } = useQuery<{ ok: boolean; recipes: { id: number; name: string }[] }>({
    queryKey: ['/api/recipe-authority'],
    enabled: isOpen,
  });

  const recipes = recipesData?.recipes || [];

  useEffect(() => {
    if (!isOpen) return;

    if (productId) {
      fetch(`/api/products/${productId}`)
        .then(r => r.json())
        .then(d => {
          if (d.ok !== false) {
            setName(d.product.name || "");
            setDescription(d.product.description || "");
            setImageUrl(d.product.imageUrl || "");
            setActive(d.product.active !== false);
            setCategory(d.product.category || "");
            setVisibility({
              inStore: d.product.visibleInStore === true,
              grab: d.product.visibleGrab === true,
              online: d.product.visibleOnline === true,
            });
            setRecipeId(d.product.recipeId ? String(d.product.recipeId) : "");
            setBaseCost(d.product.baseCost !== undefined && d.product.baseCost !== null ? Number(d.product.baseCost) : null);
            setIngredients(d.ingredients.map((i: any) => ({
              ingredientId: i.ingredientId,
              name: i.name,
              baseUnit: i.baseUnit,
              portionQty: Number(i.portionQty),
              unitCost: Number(i.unitCost || 0),
            })));
            const priceMap = new Map(d.prices.map((p: any) => [p.channel, Number(p.price)]));
            setPrices(CHANNELS.map(ch => ({
              channel: ch,
              price: priceMap.get(ch) || 0,
            })));
          }
        });
    } else {
      setName("");
      setDescription("");
      setImageUrl("");
      setActive(false);
      setCategory("");
      setVisibility({ inStore: false, grab: false, online: false });
      setRecipeId("");
      setIngredients([]);
      setBaseCost(null);
      setPrices([
        { channel: "IN_STORE", price: 0 },
        { channel: "GRAB", price: 0 },
        { channel: "ONLINE", price: 0 },
      ]);
    }
  }, [productId, isOpen]);

  const displayBaseCost = baseCost ?? null;
  const priceInStore = prices.find((p) => p.channel === "IN_STORE")?.price ?? 0;
  const priceOnline = prices.find((p) => p.channel === "ONLINE")?.price ?? 0;
  const activationIssues = [];
  if (!imageUrl.trim()) activationIssues.push("Image URL required");
  if (!recipeId) activationIssues.push("Linked recipe required");
  if (!(priceInStore > 0 || priceOnline > 0)) activationIssues.push("Online or in-store price required");
  if (baseCost === null) activationIssues.push("Base cost missing");
  const canActivate = activationIssues.length === 0;

  const updatePrice = (channel: string, value: number) => {
    setPrices(p => p.map(x => x.channel === channel ? { ...x, price: value } : x));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!recipeId) {
      toast({ title: "Recipe required", description: "Link a recipe before saving a product", variant: "destructive" });
      return;
    }
    if (active && !canActivate) {
      toast({ title: "Activation blocked", description: "Add image, base cost, and a price before activating.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        description,
        imageUrl,
        active,
        category: category || null,
        visibility,
        recipeId: recipeId ? Number(recipeId) : null,
        prices: prices.filter(p => p.price > 0),
      };

      const url = isEdit ? `/api/products/${productId}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      toast({ title: isEdit ? "Product updated" : "Product created" });
      onSaved();
      onClose();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {isEdit ? "Edit Product" : "New Product"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Product Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Smash Burger"
                className="text-xs h-9 rounded-[4px]"
              />
            </div>
            <div className="flex items-center gap-2 pt-5" title={!canActivate ? activationIssues.join(", ") : undefined}>
              <Switch
                checked={active}
                onCheckedChange={setActive}
                disabled={!active && !canActivate}
              />
              <Label className="text-xs">{active ? "Active" : "Inactive"}</Label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Category</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Burgers"
                className="text-xs h-9 rounded-[4px]"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product description for menu display"
              className="text-xs rounded-[4px] min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Linked Recipe (required)</Label>
              <Select value={recipeId} onValueChange={setRecipeId}>
                <SelectTrigger className="h-9 text-xs rounded-[4px]">
                  <SelectValue placeholder="Select recipe" />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((recipe) => (
                    <SelectItem key={recipe.id} value={String(recipe.id)}>
                      {recipe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Visibility</Label>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={visibility.inStore}
                    onCheckedChange={(checked) => setVisibility((prev) => ({ ...prev, inStore: checked }))}
                  />
                  <span>In-store</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={visibility.grab}
                    onCheckedChange={(checked) => setVisibility((prev) => ({ ...prev, grab: checked }))}
                  />
                  <span>Grab</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={visibility.online}
                    onCheckedChange={(checked) => setVisibility((prev) => ({ ...prev, online: checked }))}
                  />
                  <span>Online</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Image URL</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="text-xs h-9 rounded-[4px]"
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold text-slate-900">Ingredients (from recipe)</h3>
              <span className="text-sm font-semibold text-emerald-600">
                Base Cost: {baseCost !== null ? `฿${displayBaseCost.toFixed(2)}` : "Unavailable"}
              </span>
            </div>

            {ingredients.length > 0 ? (
              <>
                <div className="hidden sm:block">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-2 px-2 font-medium">Ingredient</th>
                        <th className="text-right py-2 px-2 font-medium w-24">Quantity per portion</th>
                        <th className="text-left py-2 px-2 font-medium w-16">Unit</th>
                        <th className="text-right py-2 px-2 font-medium w-20">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredients.map(i => (
                        <tr key={i.ingredientId} className="border-b border-slate-100">
                          <td className="py-2 px-2">{i.name}</td>
                          <td className="py-2 px-2 text-right">{i.portionQty}</td>
                          <td className="py-2 px-2 text-slate-500">{i.baseUnit}</td>
                          <td className="py-2 px-2 text-right font-mono text-emerald-600">
                            ฿{(i.portionQty * i.unitCost).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="sm:hidden space-y-2">
                  {ingredients.map(i => (
                    <div key={i.ingredientId} className="bg-slate-50 rounded-[4px] p-3 border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium">{i.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{i.portionQty}</span>
                        <span className="text-xs text-slate-500">{i.baseUnit}</span>
                        <span className="text-xs font-mono text-emerald-600 ml-auto">฿{(i.portionQty * i.unitCost).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-slate-400 text-xs">No ingredients added</div>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-xs font-semibold text-slate-900 mb-3">Pricing & Margin</h3>
            <div className="space-y-3">
              {prices.map(p => {
                const margin = displayBaseCost !== null ? p.price - displayBaseCost : null;
                const marginPct = margin !== null && p.price > 0 ? ((margin / p.price) * 100).toFixed(0) : null;
                return (
                  <div key={p.channel} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-slate-50 rounded-[4px]">
                    <span className="text-xs font-medium w-24">{p.channel.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs text-slate-500">฿</span>
                      <Input
                        type="number"
                        value={p.price || ""}
                        onChange={(e) => updatePrice(p.channel, parseFloat(e.target.value) || 0)}
                        className="h-9 w-24 text-xs rounded-[4px] bg-white"
                        min="0"
                        step="1"
                      />
                      {margin !== null ? (
                        <span className={`text-xs font-medium ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          Margin: ฿{margin.toFixed(2)} ({marginPct}%)
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">Margin: Unavailable</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="text-xs rounded-[4px] h-9 min-h-[36px]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700 h-9 min-h-[36px]">
            {saving ? "Saving..." : (isEdit ? "Save Changes" : "Create Product")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

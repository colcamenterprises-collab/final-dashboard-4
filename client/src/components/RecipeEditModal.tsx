import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

type RecipeAuthority = {
  id: number;
  name: string;
  category?: string;
  yieldUnits?: string | null;
  active: boolean;
  ingredients: RecipeIngredientAuthority[];
  totalCost: number;
};

type RecipeIngredientAuthority = {
  id: number;
  recipeId: number;
  purchasingItemId: number;
  quantity: string;
  unit: string;
  ingredientName?: string;
  ingredientCost?: number;
  lineCost?: number;
};

type AvailableIngredient = {
  id: number;
  item: string;
  category: string | null;
  unitCost: number | null;
  orderUnit: string | null;
  portionUnit: string | null;
};

type ModalIngredient = {
  purchasingItemId: number;
  quantity: string;
  unit: string;
  ingredientName?: string;
};

interface RecipeEditModalProps {
  recipe: RecipeAuthority | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function RecipeEditModal({ recipe, isOpen, onClose, onSaved }: RecipeEditModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [yieldUnits, setYieldUnits] = useState("");
  const [active, setActive] = useState(true);
  const [modalIngredients, setModalIngredients] = useState<ModalIngredient[]>([]);
  const [newIngredientId, setNewIngredientId] = useState("");
  const [newQuantity, setNewQuantity] = useState("");

  const { data: ingredientsData } = useQuery<{ ok: boolean; ingredients: AvailableIngredient[] }>({
    queryKey: ['/api/recipe-authority/available-ingredients'],
    queryFn: async () => {
      const res = await fetch('/api/recipe-authority/available-ingredients');
      if (!res.ok) throw new Error('Failed to load ingredients');
      return res.json();
    },
    enabled: isOpen,
  });
  const availableIngredients = ingredientsData?.ingredients || [];

  useEffect(() => {
    if (recipe && isOpen) {
      setName(recipe.name);
      setYieldUnits(recipe.yieldUnits?.toString() || "");
      setActive(recipe.active);
      setModalIngredients(
        recipe.ingredients.map((ing) => ({
          purchasingItemId: ing.purchasingItemId,
          quantity: ing.quantity,
          unit: ing.unit,
          ingredientName: ing.ingredientName,
        }))
      );
    }
  }, [recipe, isOpen]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!recipe) return;
      const res = await fetch(`/api/recipe-authority/${recipe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          yieldUnits: yieldUnits || null,
          active,
          ingredients: modalIngredients.map((ing) => ({
            purchasingItemId: ing.purchasingItemId,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save recipe");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-authority'] });
      toast({ title: "Recipe saved", description: "All changes have been saved." });
      onSaved();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddIngredient = () => {
    if (!newIngredientId || !newQuantity) {
      toast({ title: "Missing fields", description: "Select ingredient and enter quantity", variant: "destructive" });
      return;
    }
    const qty = parseFloat(newQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Invalid quantity", description: "Quantity must be a positive number", variant: "destructive" });
      return;
    }
    const id = parseInt(newIngredientId);
    if (modalIngredients.some((i) => i.purchasingItemId === id)) {
      toast({ title: "Duplicate", description: "This ingredient is already added", variant: "destructive" });
      return;
    }
    const found = availableIngredients.find((i) => i.id === id);
    if (!found) return;

    setModalIngredients([
      ...modalIngredients,
      {
        purchasingItemId: id,
        quantity: newQuantity,
        unit: found.portionUnit || found.orderUnit || "unit",
        ingredientName: found.item,
      },
    ]);
    setNewIngredientId("");
    setNewQuantity("");
  };

  const handleRemoveIngredient = (purchasingItemId: number) => {
    setModalIngredients(modalIngredients.filter((i) => i.purchasingItemId !== purchasingItemId));
  };

  const handleCancel = () => {
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter a recipe name", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const totalCost = modalIngredients.reduce((sum, ing) => {
    const found = availableIngredients.find((a) => a.id === ing.purchasingItemId);
    const cost = Number(found?.unitCost || 0) * parseFloat(ing.quantity || "0");
    return sum + cost;
  }, 0);

  if (!recipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Edit Recipe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Recipe Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs h-8 rounded-[4px]"
                data-testid="input-recipe-name"
              />
            </div>
            <div>
              <Label className="text-xs">SKU (read-only)</Label>
              <Input
                value={`RECIPE-${recipe.id}`}
                disabled
                className="text-xs h-8 rounded-[4px] bg-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Serves (portions)</Label>
              <Input
                value={yieldUnits}
                onChange={(e) => setYieldUnits(e.target.value)}
                placeholder="e.g. 1"
                className="text-xs h-8 rounded-[4px]"
                data-testid="input-yield-units"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={active} onCheckedChange={setActive} data-testid="switch-active" />
              <Label className="text-xs">{active ? "Active" : "Inactive"}</Label>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <Label className="text-xs font-medium">Ingredients ({modalIngredients.length})</Label>
              <span className="text-xs text-emerald-600 font-medium">Total: ฿{totalCost.toFixed(2)}</span>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Ingredient</th>
                  <th className="text-left py-2 font-medium w-20">Portion</th>
                  <th className="text-left py-2 font-medium w-16">Unit</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {modalIngredients.map((ing) => {
                  const found = availableIngredients.find((a) => a.id === ing.purchasingItemId);
                  return (
                    <tr key={ing.purchasingItemId} className="border-b">
                      <td className="py-2">{ing.ingredientName || found?.item || `Item #${ing.purchasingItemId}`}</td>
                      <td className="py-2">{ing.quantity}</td>
                      <td className="py-2">{ing.unit}</td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveIngredient(ing.purchasingItemId)}
                          className="h-6 w-6 p-0"
                          data-testid={`button-remove-ingredient-${ing.purchasingItemId}`}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {modalIngredients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      No ingredients added yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex gap-2 mt-3">
              <Select value={newIngredientId} onValueChange={setNewIngredientId}>
                <SelectTrigger className="flex-1 h-8 text-xs rounded-[4px]" data-testid="select-new-ingredient">
                  <SelectValue placeholder="Select ingredient" />
                </SelectTrigger>
                <SelectContent>
                  {availableIngredients
                    .filter((i) => !modalIngredients.some((m) => m.purchasingItemId === i.id))
                    .map((ing) => (
                      <SelectItem key={ing.id} value={ing.id.toString()}>
                        {ing.item}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Portion"
                className="w-20 h-8 text-xs rounded-[4px]"
                data-testid="input-new-quantity"
              />
              <Button
                size="sm"
                onClick={handleAddIngredient}
                className="h-8 text-xs rounded-[4px]"
                data-testid="button-add-ingredient"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel} className="text-xs rounded-[4px]" data-testid="button-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700"
            data-testid="button-save-recipe"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

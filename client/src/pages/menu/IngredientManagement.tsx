import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Edit, Save, X, Upload, EyeOff, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Ingredient = {
  id: number;
  name: string;
  category: string;
  supplier: string;
  brand: string;
  unit: string;
  baseUnit: string;
  price: number;
  packagingQty: string;
  notes: string;
  photoUrl: string | null;
  updatedAt: string;
  costPerBase: number;
  unitCostPerBase: number;
};

const categories = ["All", "Meat", "Drinks", "Fresh Food", "Frozen Food", "Kitchen Supplies", "Packaging", "Shelf Items", "Sauces"];

const THB = (n: number) => `฿${n.toFixed(2)}`;
const formatCost = (n: number) => {
  if (n < 0.01) return `฿${n.toFixed(4)}`;
  if (n < 1) return `฿${n.toFixed(3)}`;
  return `฿${n.toFixed(2)}`;
};

function getCostBreakdown(ing: Ingredient): { line1: string; line2: string; warning: boolean } {
  if (!ing.price) {
    return { line1: "No price set", line2: "—", warning: true };
  }
  
  const unit = ing.unit?.toLowerCase() || 'each';
  const baseUnit = ing.baseUnit || (unit === 'kg' || unit === 'g' ? 'g' : unit === 'litre' || unit === 'l' ? 'ml' : 'each');
  
  const line1 = `฿${ing.price.toFixed(2)} / ${ing.packagingQty || '1'} ${ing.unit || 'each'}`;
  const costPerBase = ing.unitCostPerBase || ing.costPerBase;
  const line2 = costPerBase ? `= ${formatCost(costPerBase)} per ${baseUnit}` : '';
  
  const isPackaging = unit === 'each' || unit === 'pcs';
  const hasNoBreakdown = isPackaging && (!ing.packagingQty || ing.packagingQty === '1' || ing.packagingQty === '');
  
  return { line1, line2, warning: hasNoBreakdown };
}

export default function IngredientManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showHidden, setShowHidden] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Ingredient>>({});
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  const { data, isLoading } = useQuery<{ items: Ingredient[]; count: number }>({
    queryKey: ["/api/ingredients/management", showHidden],
    queryFn: async () => {
      const url = showHidden ? "/api/ingredients/management?showHidden=true" : "/api/ingredients/management";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 1000 * 30,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<Ingredient>) => {
      return apiRequest(`/api/ingredients/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients/management"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Saved", description: "Ingredient updated. Recipe costs will reflect this change." });
      setEditingId(null);
      setEditForm({});
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to update", variant: "destructive" });
    }
  });

  const hideMutation = useMutation({
    mutationFn: async ({ id, hidden }: { id: number; hidden: boolean }) => {
      return apiRequest(`/api/ingredients/${id}`, { method: "PUT", body: JSON.stringify({ hidden }) });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients/management"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      toast({ 
        title: variables.hidden ? "Hidden" : "Restored", 
        description: variables.hidden ? "Ingredient hidden from this list." : "Ingredient restored to list."
      });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to update", variant: "destructive" });
    }
  });

  const handleHide = (ing: Ingredient) => {
    if (confirm(`Hide "${ing.name}" from ingredients list?\n\nThis will remove it from view but not delete it.`)) {
      hideMutation.mutate({ id: ing.id, hidden: true });
    }
  };

  const handleRestore = (ing: Ingredient) => {
    hideMutation.mutate({ id: ing.id, hidden: false });
  };

  const ingredients = data?.items || [];

  const filtered = useMemo(() => {
    return ingredients.filter((i) => {
      const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "All" || i.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [ingredients, search, categoryFilter]);

  const startEdit = (ing: Ingredient) => {
    setEditingId(ing.id);
    setEditForm({
      name: ing.name,
      category: ing.category,
      supplier: ing.supplier,
      brand: ing.brand,
      unit: ing.unit,
      price: ing.price,
      packagingQty: ing.packagingQty,
      notes: ing.notes,
      photoUrl: ing.photoUrl,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({ id: editingId, ...editForm });
  };

  const openPhotoDialog = (ing: Ingredient) => {
    setSelectedIngredient(ing);
    setPhotoDialogOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="mb-2 md:mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Ingredients</h1>
        <p className="text-xs text-slate-600">Edit ingredient prices here. Changes immediately affect all recipe costs.</p>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-3 mb-2 md:mb-4 items-center">
        <Card className="px-3 py-2 md:px-4 md:py-3 rounded-[4px] border-slate-200 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{ingredients.length}</span>
          <span className="text-xs text-slate-600">Total</span>
        </Card>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show hidden ingredients
        </label>
      </div>

      <Card className="p-3 md:p-4 mb-2 md:mb-4 rounded-[4px] border-slate-200">
        <div className="flex flex-col sm:flex-row gap-2 md:gap-3 items-stretch sm:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search ingredients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-xs rounded-[4px] border-slate-200 w-full"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-200 rounded-[4px] bg-white w-full sm:w-auto"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-xs text-slate-600">Loading...</div>
      ) : (
        <Card className="rounded-[4px] border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="p-3 text-left font-medium text-slate-600" style={{width: '220px'}}>Ingredient</th>
                  <th className="p-3 text-left font-medium text-slate-600" style={{width: '140px'}}>Category</th>
                  <th className="p-3 text-left font-medium text-slate-600" style={{width: '140px'}}>Supplier</th>
                  <th className="p-3 text-left font-medium text-slate-600" style={{width: '120px'}}>Purchase Price</th>
                  <th className="p-3 text-left font-medium text-slate-600" style={{width: '140px'}}>Packaging</th>
                  <th className="p-3 text-left font-medium text-slate-600" style={{width: '260px'}}>Cost Breakdown</th>
                  <th className="p-3 text-center font-medium text-slate-600" style={{width: '110px'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ing) => (
                  <tr key={ing.id} className={`border-b border-slate-100 ${editingId === ing.id ? "bg-emerald-50" : ""}`}>
                    {editingId === ing.id ? (
                      <>
                        <td className="p-3">
                          <Input
                            value={editForm.name || ""}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Select
                            value={editForm.category || ""}
                            onValueChange={(v) => setEditForm({ ...editForm, category: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.filter(c => c !== "All").map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            value={editForm.supplier || ""}
                            onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={editForm.price || 0}
                            onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                            className="h-8 w-24 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={editForm.packagingQty || ""}
                            onChange={(e) => setEditForm({ ...editForm, packagingQty: e.target.value })}
                            placeholder="e.g., 1kg, 500g"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-slate-500 italic">Save to recalculate</span>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-1">
                            <Button size="sm" variant="ghost" onClick={saveEdit} disabled={updateMutation.isPending} className="h-7 w-7 p-0">
                              <Save className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 w-7 p-0">
                              <X className="h-4 w-4 text-slate-500" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 text-slate-900">
                          <div className="flex items-center gap-2">
                            {ing.photoUrl && (
                              <img
                                src={ing.photoUrl}
                                alt={ing.name}
                                className="w-6 h-6 rounded-[4px] object-cover cursor-pointer flex-shrink-0"
                                onClick={() => openPhotoDialog(ing)}
                              />
                            )}
                            <div>
                              <div className="text-xs text-slate-900">{ing.name}</div>
                              {ing.brand && <div className="text-[10px] text-slate-500">{ing.brand}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">{ing.category || "—"}</Badge>
                        </td>
                        <td className="p-3 text-slate-600">{ing.supplier || "—"}</td>
                        <td className="p-3 text-slate-900">{THB(ing.price)}</td>
                        <td className="p-3 text-slate-600">{ing.packagingQty || "—"}</td>
                        <td className="p-3 text-slate-700">
                          {(() => {
                            const breakdown = getCostBreakdown(ing);
                            return (
                              <div>
                                <div className="text-xs text-slate-700">{breakdown.line1}</div>
                                {breakdown.line2 && <div className="text-xs text-slate-600">{breakdown.line2}</div>}
                                {breakdown.warning && (
                                  <div className="text-amber-600 text-[10px]">⚠ No qty breakdown</div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(ing)} className="h-7 w-7 p-0" title="Edit">
                              <Edit className="h-3.5 w-3.5 text-slate-500" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openPhotoDialog(ing)} className="h-7 w-7 p-0" title="Photo">
                              <Upload className="h-3.5 w-3.5 text-slate-400" />
                            </Button>
                            {(ing as any).hidden ? (
                              <Button size="sm" variant="ghost" onClick={() => handleRestore(ing)} className="h-7 w-7 p-0" title="Restore">
                                <Eye className="h-3.5 w-3.5 text-emerald-500 hover:text-emerald-700" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => handleHide(ing)} className="h-7 w-7 p-0" title="Hide from list">
                                <EyeOff className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ingredient Photo - {selectedIngredient?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedIngredient?.photoUrl ? (
              <img
                src={selectedIngredient.photoUrl}
                alt={selectedIngredient.name}
                className="w-full max-h-64 object-contain rounded border"
              />
            ) : (
              <div className="w-full h-32 bg-slate-100 rounded flex items-center justify-center text-slate-400">
                No photo uploaded
              </div>
            )}
            <div>
              <Label>Photo URL</Label>
              <Input
                placeholder="https://example.com/photo.jpg"
                value={selectedIngredient?.photoUrl || ""}
                onChange={(e) => {
                  if (selectedIngredient) {
                    setSelectedIngredient({ ...selectedIngredient, photoUrl: e.target.value });
                  }
                }}
              />
              <p className="text-xs text-slate-500 mt-1">
                Paste a URL to an invoice or product photo
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhotoDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedIngredient) {
                  updateMutation.mutate({
                    id: selectedIngredient.id,
                    photoUrl: selectedIngredient.photoUrl
                  });
                  setPhotoDialogOpen(false);
                }
              }}
              disabled={updateMutation.isPending}
            >
              Save Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

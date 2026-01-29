import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Edit, Save, X, Upload, Trash2 } from "lucide-react";
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

const categories = ["All", "Meat", "Drinks", "Fresh Food", "Frozen Food", "Kitchen Supplies", "Packaging", "Shelf Items"];

const THB = (n: number) => `฿${n.toFixed(2)}`;
const formatCost = (n: number) => {
  if (n < 0.01) return `฿${n.toFixed(4)}`;
  if (n < 1) return `฿${n.toFixed(3)}`;
  return `฿${n.toFixed(2)}`;
};

function getCostBreakdown(ing: Ingredient): { purchase: string; cost: string; warning: boolean } {
  if (!ing.price) {
    return { purchase: "No price set", cost: "—", warning: true };
  }
  
  const unit = ing.unit?.toLowerCase() || 'each';
  const baseUnit = ing.baseUnit || (unit === 'kg' || unit === 'g' ? 'g' : unit === 'litre' || unit === 'l' ? 'ml' : 'each');
  
  const purchase = `฿${ing.price.toFixed(2)} / ${ing.packagingQty || '1'} ${ing.unit || 'each'}`;
  const cost = `→ ${formatCost(ing.unitCostPerBase || ing.costPerBase)} per ${baseUnit}`;
  
  const isPackaging = unit === 'each' || unit === 'pcs';
  const hasNoBreakdown = isPackaging && (!ing.packagingQty || ing.packagingQty === '1' || ing.packagingQty === '');
  
  return { purchase, cost, warning: hasNoBreakdown };
}

export default function IngredientManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Ingredient>>({});
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  const { data, isLoading, refetch } = useQuery<{ items: Ingredient[]; count: number }>({
    queryKey: ["/api/ingredients/management"],
    staleTime: 1000 * 30,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<Ingredient>) => {
      return apiRequest("PUT", `/api/ingredients/${id}`, data);
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/ingredients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients/management"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      toast({ title: "Deleted", description: "Ingredient removed from this list." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to delete", variant: "destructive" });
    }
  });

  const handleDelete = (ing: Ingredient) => {
    if (confirm(`Remove "${ing.name}" from ingredients list?`)) {
      deleteMutation.mutate(ing.id);
    }
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

      <div className="flex flex-wrap gap-2 md:gap-3 mb-2 md:mb-4">
        <Card className="px-3 py-2 md:px-4 md:py-3 rounded-[4px] border-slate-200 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{ingredients.length}</span>
          <span className="text-xs text-slate-600">Total</span>
        </Card>
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
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 border-slate-200">
                    <TableHead className="text-xs font-semibold text-slate-600 w-[20%] min-w-[120px]">Ingredient</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 w-[12%] min-w-[80px]">Category</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 w-[10%] min-w-[70px]">Supplier</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 w-[10%] min-w-[70px]">Price</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 w-[12%] min-w-[80px]">Packaging</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 w-[24%] min-w-[140px]">Cost Breakdown</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 text-center w-[12%] min-w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((ing) => (
                    <TableRow key={ing.id} className={editingId === ing.id ? "bg-emerald-50" : ""}>
                      {editingId === ing.id ? (
                        <>
                          <TableCell>
                            <Input
                              value={editForm.name || ""}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={editForm.category || ""}
                              onValueChange={(v) => setEditForm({ ...editForm, category: v })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.filter(c => c !== "All").map((cat) => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.supplier || ""}
                              onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={editForm.price || 0}
                              onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                              className="h-8 w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editForm.packagingQty || ""}
                              onChange={(e) => setEditForm({ ...editForm, packagingQty: e.target.value })}
                              placeholder="e.g., 1kg, 10kg bag, 500g"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-500 italic">Save to recalculate</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={saveEdit} disabled={updateMutation.isPending}>
                                <Save className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                <X className="h-4 w-4 text-slate-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-xs text-slate-700">
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
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-xs">{ing.category || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{ing.supplier || "—"}</TableCell>
                          <TableCell className="text-xs font-medium text-slate-900">{THB(ing.price)}</TableCell>
                          <TableCell className="text-xs text-slate-600">{ing.packagingQty || "—"}</TableCell>
                          <TableCell className="text-xs text-slate-700">
                            {(() => {
                              const breakdown = getCostBreakdown(ing);
                              return (
                                <div className="space-y-0.5">
                                  <div className="text-xs text-slate-700">{breakdown.purchase}</div>
                                  <div className="text-xs text-emerald-600">{breakdown.cost}</div>
                                  {breakdown.warning && (
                                    <div className="text-amber-600 text-[10px]">⚠ No qty breakdown</div>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => startEdit(ing)} className="h-7 w-7 p-0" title="Edit">
                                <Edit className="h-3.5 w-3.5 text-slate-500" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openPhotoDialog(ing)} className="h-7 w-7 p-0" title="Photo">
                                <Upload className="h-3.5 w-3.5 text-slate-400" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(ing)} className="h-7 w-7 p-0" title="Delete">
                                <Trash2 className="h-3.5 w-3.5 text-rose-400 hover:text-rose-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

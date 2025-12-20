import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, AlertCircle, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface PurchasingItem {
  id: number;
  item: string;
  brand: string | null;
  unitDescription: string | null;
  unitCost: number | null;
}

interface Ingredient {
  id: string;
  name: string;
  category: string | null;
  baseUnit: string | null;
  defaultPortion: number | null;
  linkedPurchasingItemId: number | null;
  linkedPurchasingItem: PurchasingItem | null;
  costPreview: number | null;
  verified: boolean;
}

interface ApiResponse {
  ok: boolean;
  ingredients: Ingredient[];
  purchasingItems: PurchasingItem[];
}

const BASE_UNITS = ["g", "ml", "unit", "slice", "piece", "pack", "kg", "L"];

export default function IngredientsMaster() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    category: "",
    baseUnit: "g",
    defaultPortion: "",
    linkedPurchasingItemId: "",
  });

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["/api/ingredient-master"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Ingredient>) => {
      return apiRequest(`/api/ingredient-master/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredient-master"] });
      toast({ title: "Ingredient updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newIngredient) => {
      return apiRequest("/api/ingredient-master", { 
        method: "POST", 
        body: JSON.stringify({
          name: data.name,
          category: data.category || null,
          baseUnit: data.baseUnit,
          defaultPortion: data.defaultPortion ? parseFloat(data.defaultPortion) : null,
          linkedPurchasingItemId: data.linkedPurchasingItemId ? parseInt(data.linkedPurchasingItemId) : null,
        }) 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredient-master"] });
      toast({ title: "Ingredient created" });
      setShowAddForm(false);
      setNewIngredient({ name: "", category: "", baseUnit: "g", defaultPortion: "", linkedPurchasingItemId: "" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const ingredients = data?.ingredients || [];
  const purchasingItems = data?.purchasingItems || [];

  const handleUpdate = (id: string, field: string, value: any) => {
    updateMutation.mutate({ id, [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-4">
        <CardContent className="p-6">
          <p className="text-red-600">Failed to load ingredients</p>
        </CardContent>
      </Card>
    );
  }

  const verifiedCount = ingredients.filter(i => i.verified).length;

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Ingredients Master</CardTitle>
              <p className="text-xs text-slate-500">
                {ingredients.length} ingredients | {verifiedCount} verified
              </p>
            </div>
            <Button 
              size="sm" 
              onClick={() => setShowAddForm(!showAddForm)}
              data-testid="button-add-ingredient"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Ingredient
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <div className="mb-4 p-4 border rounded-lg bg-slate-50">
              <div className="grid grid-cols-6 gap-2">
                <Input
                  placeholder="Name *"
                  value={newIngredient.name}
                  onChange={e => setNewIngredient({ ...newIngredient, name: e.target.value })}
                  data-testid="input-new-name"
                />
                <Input
                  placeholder="Category"
                  value={newIngredient.category}
                  onChange={e => setNewIngredient({ ...newIngredient, category: e.target.value })}
                  data-testid="input-new-category"
                />
                <Select
                  value={newIngredient.baseUnit}
                  onValueChange={v => setNewIngredient({ ...newIngredient, baseUnit: v })}
                >
                  <SelectTrigger data-testid="select-new-baseunit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_UNITS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Default Portion"
                  type="number"
                  value={newIngredient.defaultPortion}
                  onChange={e => setNewIngredient({ ...newIngredient, defaultPortion: e.target.value })}
                  data-testid="input-new-portion"
                />
                <Select
                  value={newIngredient.linkedPurchasingItemId}
                  onValueChange={v => setNewIngredient({ ...newIngredient, linkedPurchasingItemId: v })}
                >
                  <SelectTrigger data-testid="select-new-purchasing">
                    <SelectValue placeholder="Link Purchasing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {purchasingItems.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.item} {p.brand ? `— ${p.brand}` : ""} {p.unitCost ? `— ฿${p.unitCost}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => createMutation.mutate(newIngredient)}
                  disabled={!newIngredient.name || !newIngredient.baseUnit || createMutation.isPending}
                  data-testid="button-save-new"
                >
                  {createMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded border border-slate-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-medium">Ingredient Name</TableHead>
                  <TableHead className="text-xs font-medium">Category</TableHead>
                  <TableHead className="text-xs font-medium">Base Unit</TableHead>
                  <TableHead className="text-xs font-medium text-right">Default Portion</TableHead>
                  <TableHead className="text-xs font-medium">Linked Purchasing Item</TableHead>
                  <TableHead className="text-xs font-medium text-right">Cost Preview</TableHead>
                  <TableHead className="text-xs font-medium text-center">Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ing) => (
                  <TableRow key={ing.id} data-testid={`ingredient-row-${ing.id}`}>
                    <TableCell className="p-1">
                      <Input
                        className="text-xs h-8"
                        value={ing.name}
                        onBlur={e => {
                          if (e.target.value !== ing.name) {
                            handleUpdate(ing.id, "name", e.target.value);
                          }
                        }}
                        data-testid={`input-name-${ing.id}`}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        className="text-xs h-8"
                        value={ing.category || ""}
                        onBlur={e => {
                          if (e.target.value !== (ing.category || "")) {
                            handleUpdate(ing.id, "category", e.target.value || null);
                          }
                        }}
                        data-testid={`input-category-${ing.id}`}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Select
                        value={ing.baseUnit || ""}
                        onValueChange={v => handleUpdate(ing.id, "baseUnit", v)}
                      >
                        <SelectTrigger className="text-xs h-8" data-testid={`select-baseunit-${ing.id}`}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {BASE_UNITS.map(u => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1 text-right">
                      <Input
                        className="text-xs h-8 text-right w-20"
                        type="number"
                        value={ing.defaultPortion ?? ""}
                        onBlur={e => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          if (val !== ing.defaultPortion) {
                            handleUpdate(ing.id, "defaultPortion", val);
                          }
                        }}
                        data-testid={`input-portion-${ing.id}`}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Select
                        value={ing.linkedPurchasingItemId ? String(ing.linkedPurchasingItemId) : ""}
                        onValueChange={v => handleUpdate(ing.id, "linkedPurchasingItemId", v ? parseInt(v) : null)}
                      >
                        <SelectTrigger className="text-xs h-8" data-testid={`select-purchasing-${ing.id}`}>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {purchasingItems.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.item} {p.brand ? `— ${p.brand}` : ""} {p.unitDescription ? `— ${p.unitDescription}` : ""} {p.unitCost ? `— ฿${p.unitCost}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {ing.costPreview !== null ? `฿${ing.costPreview.toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleUpdate(ing.id, "verified", !ing.verified)}
                        data-testid={`toggle-verified-${ing.id}`}
                      >
                        {ing.verified ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3 h-3 mr-1" />Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-600">
                            <AlertCircle className="w-3 h-3 mr-1" />Unverified
                          </Badge>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

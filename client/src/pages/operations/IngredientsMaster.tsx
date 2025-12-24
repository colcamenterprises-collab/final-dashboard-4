/**
 * 🔒 FOUNDATION-01: Ingredients (from Purchasing)
 * 
 * Ingredients are DERIVED from purchasing_items WHERE is_ingredient = true.
 * Cost is managed centrally in the Purchasing List.
 * 
 * Editable here: Portion Unit, Portion Size, Yield
 * NOT editable here: Cost (read-only from Purchasing)
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Ingredient {
  id: number;
  name: string;
  category: string | null;
  brand: string | null;
  orderUnit: string | null;
  unitDescription: string | null;
  unitCost: number | null;
  portionUnit: string | null;
  portionSize: number | null;
  yield: number | null;
  active: boolean;
}

interface ApiResponse {
  ok: boolean;
  ingredients: Ingredient[];
  source: string;
}

const PORTION_UNITS = ["g", "ml", "piece", "slice", "pack", "unit"];

const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function IngredientsMaster() {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["/api/ingredient-master"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<Ingredient>) => {
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

  const ingredients = data?.ingredients || [];

  const handleUpdate = (id: number, field: string, value: any) => {
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

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Ingredients (from Purchasing)</CardTitle>
              <p className="text-xs text-slate-500">
                {ingredients.length} ingredients
              </p>
              <p className="text-xs text-slate-400">Source: purchasing_items.is_ingredient</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-[4px]">
            <Info className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <p className="text-xs text-slate-600">
              Ingredients are derived from your Purchasing List. Costs are managed centrally there.
            </p>
          </div>

          <div className="rounded border border-slate-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-medium">Name</TableHead>
                  <TableHead className="text-xs font-medium">Category</TableHead>
                  <TableHead className="text-xs font-medium">Brand</TableHead>
                  <TableHead className="text-xs font-medium">Order Unit</TableHead>
                  <TableHead className="text-xs font-medium text-right">Unit Cost</TableHead>
                  <TableHead className="text-xs font-medium">Portion Unit</TableHead>
                  <TableHead className="text-xs font-medium text-right">Portion Size</TableHead>
                  <TableHead className="text-xs font-medium text-right">Yield %</TableHead>
                  <TableHead className="text-xs font-medium text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-xs text-slate-500 py-8">
                      No recipe defined. Mark items as "Ingredient" in the Purchasing List.
                    </TableCell>
                  </TableRow>
                ) : (
                  ingredients.map((ing) => (
                    <TableRow key={ing.id} data-testid={`ingredient-row-${ing.id}`}>
                      <TableCell className="text-xs font-medium text-slate-900">
                        {ing.name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {ing.category || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {ing.brand || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {ing.orderUnit || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-900 font-medium text-right">
                        {ing.unitCost !== null ? thb(ing.unitCost) : "-"}
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={ing.portionUnit || ""}
                          onValueChange={(v) => handleUpdate(ing.id, "portionUnit", v || null)}
                        >
                          <SelectTrigger className="h-8 text-xs" data-testid={`select-portion-unit-${ing.id}`}>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {PORTION_UNITS.map(u => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          step="0.001"
                          className="text-xs h-8 w-20 text-right"
                          defaultValue={ing.portionSize ?? ""}
                          onBlur={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            if (val !== ing.portionSize) {
                              handleUpdate(ing.id, "portionSize", val);
                            }
                          }}
                          data-testid={`input-portion-size-${ing.id}`}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="text-xs h-8 w-16 text-right"
                          defaultValue={ing.yield ?? ""}
                          onBlur={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            if (val !== ing.yield) {
                              handleUpdate(ing.id, "yield", val);
                            }
                          }}
                          data-testid={`input-yield-${ing.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {ing.active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

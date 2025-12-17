import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Lock, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Ingredient {
  id: number;
  name: string;
  category: string | null;
  purchaseQty: string | null;
  purchaseUnit: string | null;
  purchaseCost: string | null;
  portionUnit: string | null;
  portionsPerPurchase: number | null;
  portionCost: string | null;
  verified: boolean;
  locked: boolean;
  status: "verified" | "unverified" | "locked";
}

export default function IngredientsMaster() {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<{ ok: boolean; ingredients: Ingredient[] }>({
    queryKey: ["/api/ingredients/master"],
  });

  const toggleVerified = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/ingredients/${id}/toggle-verified`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients/master"] });
      toast({ title: "Verification status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleLocked = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/ingredients/${id}/toggle-locked`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients/master"] });
      toast({ title: "Lock status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const ingredients = data?.ingredients || [];

  const getStatusBadge = (ing: Ingredient) => {
    if (ing.locked) {
      return <Badge variant="outline" className="bg-slate-100 text-slate-600"><Lock className="w-3 h-3 mr-1" />Locked</Badge>;
    }
    if (ing.verified) {
      return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
    }
    return <Badge variant="outline" className="bg-amber-50 text-amber-600"><AlertCircle className="w-3 h-3 mr-1" />Unverified</Badge>;
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
  const lockedCount = ingredients.filter(i => i.locked).length;

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Ingredients Master</CardTitle>
          <p className="text-xs text-slate-500">
            {ingredients.length} ingredients | {verifiedCount} verified | {lockedCount} locked
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-medium">Name</TableHead>
                  <TableHead className="text-xs font-medium">Category</TableHead>
                  <TableHead className="text-xs font-medium text-right">Package Size</TableHead>
                  <TableHead className="text-xs font-medium text-right">Portion Size</TableHead>
                  <TableHead className="text-xs font-medium text-right">Cost</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                  <TableHead className="text-xs font-medium text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ing) => (
                  <TableRow key={ing.id} data-testid={`ingredient-row-${ing.id}`}>
                    <TableCell className="text-xs font-medium">{ing.name}</TableCell>
                    <TableCell className="text-xs text-slate-600">{ing.category || "-"}</TableCell>
                    <TableCell className="text-xs text-right">
                      {ing.purchaseQty ? `${ing.purchaseQty} ${ing.purchaseUnit || ""}` : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {ing.portionsPerPurchase ? `${ing.portionsPerPurchase} ${ing.portionUnit || ""}` : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {ing.portionCost ? `฿${parseFloat(ing.portionCost).toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(ing)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => toggleVerified.mutate(ing.id)}
                        disabled={ing.locked || toggleVerified.isPending}
                        data-testid={`toggle-verified-${ing.id}`}
                      >
                        {ing.verified ? "Unverify" : "Verify"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => toggleLocked.mutate(ing.id)}
                        disabled={toggleLocked.isPending}
                        data-testid={`toggle-locked-${ing.id}`}
                      >
                        {ing.locked ? "Unlock" : "Lock"}
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

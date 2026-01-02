import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, AlertTriangle, CheckCircle, Package, Receipt, Utensils, Percent, Flag, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface IngredientUsageData {
  ingredientId: number;
  ingredientName: string;
  quantityUsed: number;
  unit: string;
  sourceItemCount: number;
  confidence: number;
}

interface ModifierEffect {
  modifierName: string;
  ingredientName: string;
  totalDelta: number;
  unit: string;
  occurrences: number;
}

interface TruthFlag {
  receiptId: string;
  posItemName: string;
  issueType: string;
  details: string;
}

interface IngredientUsageResult {
  date: string;
  runId: number;
  status: string;
  receiptCount: number;
  lineItemCount: number;
  confidenceScore: number;
  ingredientUsage: IngredientUsageData[];
  modifierEffects: ModifierEffect[];
  flags: TruthFlag[];
}

export default function IngredientUsage() {
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<IngredientUsageResult>({
    queryKey: ["/api/analysis/ingredient-usage", date],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/ingredient-usage?date=${date}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch ingredient usage");
      return res.json();
    },
    enabled: !!date,
  });

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/analysis/ingredient-usage/rebuild", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
    },
    onSuccess: (result: any) => {
      toast({
        title: "Rebuild Complete",
        description: `${result.ingredientsExpanded} ingredients, ${result.modifierEffects} modifier effects, ${result.confidenceScore}% coverage`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/analysis/ingredient-usage", date] });
    },
    onError: (err: any) => {
      toast({
        title: "Rebuild Failed",
        description: err.message || "Failed to rebuild ingredient usage",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SUCCESS": return "bg-emerald-100 text-emerald-800";
      case "PARTIAL": return "bg-amber-100 text-amber-800";
      case "FAILED": return "bg-red-100 text-red-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const getFlagTypeColor = (type: string) => {
    switch (type) {
      case "UNMAPPED_POS_ITEM": return "bg-red-100 text-red-800";
      case "RECIPE_INCOMPLETE": return "bg-amber-100 text-amber-800";
      case "INGREDIENT_INACTIVE": return "bg-slate-100 text-slate-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const formatQuantity = (qty: number, unit: string) => {
    if (qty >= 1000 && (unit === "g" || unit === "ml")) {
      return `${(qty / 1000).toFixed(2)} ${unit === "g" ? "kg" : "L"}`;
    }
    return `${qty.toFixed(2)} ${unit}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ingredient Usage Analysis</h1>
          <p className="text-sm text-slate-600 mt-1">
            Deterministic ingredient tracking from receipts with modifier math
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
            data-testid="input-date"
          />
          <Button
            onClick={() => rebuildMutation.mutate()}
            disabled={rebuildMutation.isPending}
            className="bg-black hover:bg-slate-800"
            data-testid="button-rebuild"
          >
            {rebuildMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Rebuild
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      )}

      {!isLoading && !data && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Data Available</h3>
            <p className="text-sm text-slate-600 mb-4">
              Ingredient usage truth has not been built for {date}.
            </p>
            <Button
              onClick={() => rebuildMutation.mutate()}
              disabled={rebuildMutation.isPending}
              data-testid="button-build-first"
            >
              {rebuildMutation.isPending ? "Building..." : "Build Ingredient Truth"}
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Receipt className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">{data.receiptCount}</p>
                    <p className="text-xs text-slate-500">Receipts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Utensils className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">{data.lineItemCount}</p>
                    <p className="text-xs text-slate-500">Line Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Package className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">{data.ingredientUsage.length}</p>
                    <p className="text-xs text-slate-500">Ingredients</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${data.confidenceScore >= 95 ? "bg-emerald-100" : data.confidenceScore >= 50 ? "bg-amber-100" : "bg-red-100"}`}>
                    <Percent className={`h-5 w-5 ${data.confidenceScore >= 95 ? "text-emerald-600" : data.confidenceScore >= 50 ? "text-amber-600" : "text-red-600"}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">{data.confidenceScore}%</p>
                    <p className="text-xs text-slate-500">Coverage</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(data.status)}>{data.status}</Badge>
            {data.flags.length > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                <Flag className="h-3 w-3 mr-1" />
                {data.flags.length} flags
              </Badge>
            )}
          </div>

          <Tabs defaultValue="usage" className="w-full">
            <TabsList>
              <TabsTrigger value="usage" data-testid="tab-usage">Ingredient Usage</TabsTrigger>
              <TabsTrigger value="modifiers" data-testid="tab-modifiers">Modifier Effects ({data.modifierEffects.length})</TabsTrigger>
              <TabsTrigger value="flags" data-testid="tab-flags">Flags & Gaps ({data.flags.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="usage" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ingredient Usage by Shift</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead className="text-right">Quantity Used</TableHead>
                        <TableHead className="text-right">Source Items</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ingredientUsage.map((ing) => (
                        <TableRow key={ing.ingredientId} data-testid={`row-ingredient-${ing.ingredientId}`}>
                          <TableCell className="font-medium">{ing.ingredientName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatQuantity(ing.quantityUsed, ing.unit)}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">{ing.sourceItemCount}</TableCell>
                          <TableCell className="text-right">
                            {ing.confidence === 100 ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500 inline" />
                            ) : (
                              <span className="text-amber-600">{ing.confidence}%</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.ingredientUsage.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                            No ingredient usage data. Check the Flags tab for issues.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="modifiers" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Modifier Impact Breakdown</CardTitle>
                  <p className="text-sm text-slate-500">
                    Shows how modifiers (NO CHEESE, EXTRA BACON, etc.) affected ingredient usage
                  </p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Modifier</TableHead>
                        <TableHead>Ingredient</TableHead>
                        <TableHead className="text-right">Delta</TableHead>
                        <TableHead className="text-right">Occurrences</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.modifierEffects.map((mod, idx) => (
                        <TableRow key={idx} data-testid={`row-modifier-${idx}`}>
                          <TableCell className="font-medium text-sm">{mod.modifierName}</TableCell>
                          <TableCell>{mod.ingredientName}</TableCell>
                          <TableCell className={`text-right font-mono ${mod.totalDelta < 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {mod.totalDelta > 0 ? "+" : ""}{formatQuantity(mod.totalDelta, mod.unit)}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">{mod.occurrences}×</TableCell>
                        </TableRow>
                      ))}
                      {data.modifierEffects.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                            No modifier effects recorded. Add modifier rules to track ingredient adjustments.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="flags" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Flags & Gaps
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Issues preventing 100% ingredient coverage
                  </p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>POS Item</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.flags.map((flag, idx) => (
                        <TableRow key={idx} data-testid={`row-flag-${idx}`}>
                          <TableCell>
                            <Badge className={getFlagTypeColor(flag.issueType)} variant="secondary">
                              {flag.issueType.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{flag.posItemName}</TableCell>
                          <TableCell className="text-sm text-slate-600 max-w-md truncate">{flag.details}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">{flag.receiptId}</TableCell>
                        </TableRow>
                      ))}
                      {data.flags.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                            <CheckCircle className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
                            No flags! All items are fully mapped.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

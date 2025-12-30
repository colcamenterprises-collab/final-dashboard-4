import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface IngredientRow {
  ingredientName: string;
  totalQuantity: number;
  unit: string;
  sourceItemCount: number;
  confidence: number;
}

interface FlagRow {
  receiptDate: string;
  receiptId: string;
  posItemName: string;
  issueType: string;
  details: string;
}

interface FlagSummary {
  issueType: string;
  uniqueItems: number;
  occurrences: number;
}

interface IngredientsTruthData {
  date: string;
  status: 'CONFIRMED' | 'ACTION_REQUIRED';
  stats: {
    totalReceipts: number;
    totalLineItems: number;
    totalIngredientsExpanded: number;
    flaggedItemsCount: number;
    mappedItems: number;
    unmappedItems: number;
    coverage: number;
  };
  ingredients: IngredientRow[];
  flagSummary: FlagSummary[];
  flags: FlagRow[];
}

export default function IngredientsTruth() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultDate = yesterday.toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const { data, isLoading, error } = useQuery<IngredientsTruthData>({
    queryKey: ['/api/analysis/ingredients-truth', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/ingredients-truth?date=${selectedDate}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Not found');
      }
      return res.json();
    },
    enabled: !!selectedDate,
    retry: false,
  });

  const rebuildReceiptsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/analysis/receipts-truth/rebuild', {
        method: 'POST',
        body: JSON.stringify({ business_date: selectedDate }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/ingredients-truth', selectedDate] });
    },
  });

  const rebuildIngredientsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/analysis/receipts-truth/ingredients/rebuild', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/ingredients-truth', selectedDate] });
    },
  });

  const hasTruth = !!data;
  const hasFlags = data && data.stats.flaggedItemsCount > 0;
  const noReceiptTruth = error && (error as Error).message?.includes('INGREDIENTS_NOT_BUILT');

  const getStatusBanner = () => {
    if (isLoading) return null;
    
    if (noReceiptTruth) {
      return (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[4px]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-semibold text-red-800 dark:text-red-300">NO RECEIPT TRUTH</span>
          </div>
          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
            No receipt truth for {selectedDate}. Click "Rebuild Receipts" first.
          </div>
        </div>
      );
    }
    
    if (!hasTruth) {
      return (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-[4px]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">INGREDIENT EXPANSION NOT RUN</span>
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Click "Rebuild Ingredients" to expand recipes.
          </div>
        </div>
      );
    }

    if (hasFlags) {
      return (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[4px]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-semibold text-red-800 dark:text-red-300">ACTION REQUIRED</span>
          </div>
          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
            {data.stats.flaggedItemsCount} issues found. See Unmapped Items tab.
          </div>
        </div>
      );
    }

    return (
      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-[4px]">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">INGREDIENT TRUTH CONFIRMED</span>
        </div>
        <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
          {data.stats.coverage}% recipe coverage. All items mapped.
        </div>
      </div>
    );
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 100) return <Badge variant="default" className="bg-emerald-600 text-white text-xs">100</Badge>;
    if (confidence >= 70) return <Badge variant="secondary" className="bg-amber-500 text-white text-xs">{confidence}</Badge>;
    return <Badge variant="destructive" className="text-xs">{confidence}</Badge>;
  };

  const uniqueUnmappedItems = data?.flags
    .filter(f => f.issueType === 'UNMAPPED_POS_ITEM')
    .reduce((acc, f) => {
      if (!acc.some(x => x.posItemName === f.posItemName)) {
        acc.push(f);
      }
      return acc;
    }, [] as FlagRow[]) || [];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          Ingredients (Truth)
        </h1>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
              Ingredient Truth Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
              <div className="flex-1 sm:flex-none">
                <Label htmlFor="businessDate" className="text-xs text-slate-600 dark:text-slate-400">
                  Business Date (≥ 2024-07-01)
                </Label>
                <Input
                  id="businessDate"
                  type="date"
                  value={selectedDate}
                  min="2024-07-01"
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-48 rounded-[4px] text-sm"
                  data-testid="input-business-date"
                />
              </div>
              <div className="text-xs text-slate-500 sm:mb-2">
                Shift Window: 17:00 → 03:00 (BKK)
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => rebuildReceiptsMutation.mutate()}
                disabled={rebuildReceiptsMutation.isPending}
                variant="outline"
                className="rounded-[4px] text-xs border-slate-200"
                data-testid="button-rebuild-receipts"
              >
                <RefreshCw className={`w-3 h-3 mr-2 ${rebuildReceiptsMutation.isPending ? 'animate-spin' : ''}`} />
                {rebuildReceiptsMutation.isPending ? 'Rebuilding...' : 'Rebuild Receipts'}
              </Button>
              <Button
                onClick={() => rebuildIngredientsMutation.mutate()}
                disabled={rebuildIngredientsMutation.isPending || noReceiptTruth}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-[4px] text-xs"
                data-testid="button-rebuild-ingredients"
              >
                <RefreshCw className={`w-3 h-3 mr-2 ${rebuildIngredientsMutation.isPending ? 'animate-spin' : ''}`} />
                {rebuildIngredientsMutation.isPending ? 'Expanding...' : 'Rebuild Ingredients'}
              </Button>
            </div>

            {getStatusBanner()}
          </CardContent>
        </Card>

        {hasTruth && data && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3 xl:grid-cols-6">
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Line Items</div>
                  <div className="text-lg md:text-xl font-bold text-slate-900 dark:text-white" data-testid="text-line-items">
                    {data.stats.totalLineItems}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Mapped</div>
                  <div className="text-lg md:text-xl font-bold text-emerald-600" data-testid="text-mapped">
                    {data.stats.mappedItems}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Unmapped</div>
                  <div className="text-lg md:text-xl font-bold text-red-600" data-testid="text-unmapped">
                    {data.stats.unmappedItems}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Coverage</div>
                  <div className="text-lg md:text-xl font-bold text-slate-900 dark:text-white" data-testid="text-coverage">
                    {data.stats.coverage}%
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Ingredients</div>
                  <div className="text-lg md:text-xl font-bold text-emerald-600" data-testid="text-ingredients">
                    {data.ingredients.length}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Flags</div>
                  <div className={`text-lg md:text-xl font-bold ${data.stats.flaggedItemsCount > 0 ? 'text-red-600' : 'text-emerald-600'}`} data-testid="text-flags">
                    {data.stats.flaggedItemsCount}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="usage" className="w-full">
              <TabsList className="w-full md:w-auto bg-slate-100 dark:bg-slate-800 rounded-[4px] grid grid-cols-4 md:inline-flex">
                <TabsTrigger value="usage" className="rounded-[4px] text-xs" data-testid="tab-usage">Usage</TabsTrigger>
                <TabsTrigger value="unmapped" className="rounded-[4px] text-xs" data-testid="tab-unmapped">
                  Unmapped {data.stats.unmappedItems > 0 && <Badge variant="destructive" className="ml-1 text-xs">{uniqueUnmappedItems.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="coverage" className="rounded-[4px] text-xs" data-testid="tab-coverage">Coverage</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-[4px] text-xs" data-testid="tab-audit">Audit</TabsTrigger>
              </TabsList>

              <TabsContent value="usage" className="mt-4">
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between flex-wrap gap-2">
                      <span>Ingredient Usage (Truth)</span>
                      <Badge variant="secondary" className="text-xs">{data.ingredients.length} ingredients</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {data.ingredients.length === 0 ? (
                      <div className="text-xs text-slate-500 text-center py-8">
                        No ingredients expanded for this date.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                              <th className="text-left py-2 pr-2 font-semibold text-slate-900 dark:text-white">Ingredient</th>
                              <th className="text-right py-2 px-2 font-semibold text-slate-900 dark:text-white">Qty Used</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-900 dark:text-white">Unit</th>
                              <th className="text-right py-2 px-2 font-semibold text-slate-900 dark:text-white">Sources</th>
                              <th className="text-right py-2 pl-2 font-semibold text-slate-900 dark:text-white">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.ingredients.map((ing, idx) => (
                              <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0" data-testid={`ingredient-${idx}`}>
                                <td className="py-2 pr-2 font-medium text-slate-900 dark:text-white">{ing.ingredientName}</td>
                                <td className="py-2 px-2 text-right text-emerald-600 font-semibold">{ing.totalQuantity.toFixed(2)}</td>
                                <td className="py-2 px-2 text-slate-600 dark:text-slate-400">{ing.unit}</td>
                                <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">{ing.sourceItemCount}</td>
                                <td className="py-2 pl-2 text-right">{getConfidenceBadge(ing.confidence)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="unmapped" className="mt-4">
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between flex-wrap gap-2">
                      <span>Unmapped Items</span>
                      <Badge variant="destructive" className="text-xs">{uniqueUnmappedItems.length} items</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {uniqueUnmappedItems.length === 0 ? (
                      <div className="text-xs text-emerald-600 text-center py-8">
                        All items mapped to recipes.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                              <th className="text-left py-2 pr-2 font-semibold text-slate-900 dark:text-white">POS Item Name</th>
                              <th className="text-left py-2 pl-2 font-semibold text-slate-900 dark:text-white">Issue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uniqueUnmappedItems.map((flag, idx) => (
                              <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0" data-testid={`unmapped-${idx}`}>
                                <td className="py-2 pr-2 font-medium text-slate-900 dark:text-white">{flag.posItemName}</td>
                                <td className="py-2 pl-2">
                                  <Badge variant="destructive" className="text-xs">{flag.issueType}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="coverage" className="mt-4">
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                      Recipe Coverage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[4px]">
                        <div className="text-xs text-slate-600 dark:text-slate-400">Total POS Items Sold</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{data.stats.totalLineItems}</div>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[4px]">
                        <div className="text-xs text-slate-600 dark:text-slate-400">Mapped to Recipes</div>
                        <div className="text-xl font-bold text-emerald-600">{data.stats.mappedItems}</div>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[4px]">
                        <div className="text-xs text-slate-600 dark:text-slate-400">Coverage</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">{data.stats.coverage}%</div>
                      </div>
                    </div>

                    {data.flagSummary.length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Issue Summary</div>
                        <div className="space-y-2">
                          {data.flagSummary.map((flag, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                              <span className="text-xs text-slate-900 dark:text-white">{flag.issueType}</span>
                              <div className="flex gap-3">
                                <span className="text-xs text-slate-600">{flag.uniqueItems} unique items</span>
                                <span className="text-xs text-slate-600">{flag.occurrences} occurrences</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                      Audit Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="text-left py-2 pr-2 font-semibold text-slate-900 dark:text-white">Date</th>
                            <th className="text-right py-2 px-2 font-semibold text-slate-900 dark:text-white">Receipts</th>
                            <th className="text-right py-2 px-2 font-semibold text-slate-900 dark:text-white">Line Items</th>
                            <th className="text-right py-2 px-2 font-semibold text-slate-900 dark:text-white">Ingredients</th>
                            <th className="text-right py-2 px-2 font-semibold text-slate-900 dark:text-white">Flags</th>
                            <th className="text-right py-2 pl-2 font-semibold text-slate-900 dark:text-white">Coverage</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 pr-2 font-medium text-slate-900 dark:text-white">{data.date}</td>
                            <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">{data.stats.totalReceipts}</td>
                            <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">{data.stats.totalLineItems}</td>
                            <td className="py-2 px-2 text-right text-emerald-600">{data.stats.totalIngredientsExpanded}</td>
                            <td className="py-2 px-2 text-right text-red-600">{data.stats.flaggedItemsCount}</td>
                            <td className="py-2 pl-2 text-right font-semibold text-slate-900 dark:text-white">{data.stats.coverage}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {isLoading && (
          <div className="text-center py-8 text-xs text-slate-600 dark:text-slate-400">
            Loading ingredient truth...
          </div>
        )}
      </div>
    </div>
  );
}

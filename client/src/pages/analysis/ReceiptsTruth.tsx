import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ReceiptTruthSummary {
  allReceipts: number;
  salesReceipts: number;
  refundReceipts: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  source: string;
  builtAt: string;
}

interface ItemAggregate {
  businessDate: string;
  posCategory: string;
  itemName: string;
  totalQuantity: number;
  grossAmount: number;
}

interface ModifierAggregate {
  businessDate: string;
  modifierName: string;
  totalQuantity: number;
}

interface CategoryTotal {
  category: string;
  itemCount: number;
  totalQuantity: number;
  grossAmount: number;
}

interface AggregateData {
  date: string;
  itemsByCategory: Record<string, ItemAggregate[]>;
  modifiers: ModifierAggregate[];
  categoryTotals: CategoryTotal[];
  categories: string[];
}

export default function ReceiptsTruth() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultDate = yesterday.toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const { data: summary, isLoading: summaryLoading } = useQuery<ReceiptTruthSummary>({
    queryKey: ['/api/analysis/receipts-truth', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/receipts-truth?date=${selectedDate}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Not found');
      }
      return res.json();
    },
    enabled: !!selectedDate,
    retry: false,
  });

  const { data: aggregates, isLoading: aggLoading } = useQuery<AggregateData>({
    queryKey: ['/api/analysis/receipts-truth/aggregates', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/receipts-truth/aggregates?date=${selectedDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedDate && !!summary,
    retry: false,
  });

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/analysis/receipts-truth/rebuild', {
        method: 'POST',
        body: JSON.stringify({ business_date: selectedDate }),
        headers: { 'Content-Type': 'application/json' },
      });
      await apiRequest('/api/analysis/receipts-truth/aggregates/rebuild', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts-truth', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts-truth/aggregates', selectedDate] });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const hasTruth = !!summary;
  const isLoading = summaryLoading || aggLoading;

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Receipts (Truth)
        </h1>

        <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-900 dark:text-white">
              Receipt Truth Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label htmlFor="businessDate" className="text-sm text-slate-600 dark:text-slate-400">
                  Business Date (≥ 2024-07-01)
                </Label>
                <Input
                  id="businessDate"
                  type="date"
                  value={selectedDate}
                  min="2024-07-01"
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-48 rounded-[4px]"
                  data-testid="input-business-date"
                />
              </div>
              <Button
                onClick={() => rebuildMutation.mutate()}
                disabled={rebuildMutation.isPending || !selectedDate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-[4px]"
                data-testid="button-rebuild"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />
                {rebuildMutation.isPending ? 'Rebuilding...' : 'Rebuild from Loyverse API'}
              </Button>
            </div>

            {!hasTruth && !isLoading && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[4px]">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-800 dark:text-red-300">NO RECEIPT TRUTH — DATA MISSING</div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    No truth exists for {selectedDate}. Click "Rebuild from Loyverse API" to fetch receipts.
                  </div>
                </div>
              </div>
            )}

            {rebuildMutation.isError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[4px]">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-800 dark:text-red-300">Rebuild Failed</div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {(rebuildMutation.error as any)?.message || 'Failed to rebuild receipt truth'}
                  </div>
                </div>
              </div>
            )}

            {hasTruth && (
              <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-[4px]">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-800 dark:text-emerald-300">Receipt truth confirmed</div>
                  <div className="text-sm text-emerald-600 dark:text-emerald-400">
                    Data rebuilt from {summary.source} for {selectedDate} at {new Date(summary.builtAt).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {hasTruth && summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">All Receipts</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-all-receipts">
                    {summary.allReceipts}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Sales</div>
                  <div className="text-2xl font-bold text-emerald-600" data-testid="text-sales-count">
                    {summary.salesReceipts}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Refunds</div>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-refund-count">
                    {summary.refundReceipts}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Gross Sales</div>
                  <div className="text-2xl font-bold text-emerald-600" data-testid="text-gross-sales">
                    {formatCurrency(Number(summary.grossSales))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Discounts</div>
                  <div className="text-2xl font-bold text-amber-600" data-testid="text-discounts">
                    {formatCurrency(Number(summary.discounts))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Refund Amount</div>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-refund-amount">
                    {formatCurrency(Number(summary.refunds))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Net Sales</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-net-sales">
                    {formatCurrency(Number(summary.netSales))}
                  </div>
                  <div className="text-xs text-slate-500">gross - discounts - refunds</div>
                </CardContent>
              </Card>
            </div>

            {aggregates && (
              <Tabs defaultValue="items" className="w-full">
                <TabsList className="bg-slate-100 dark:bg-slate-800 rounded-[4px]">
                  <TabsTrigger value="items" className="rounded-[4px]" data-testid="tab-items">Items by Category</TabsTrigger>
                  <TabsTrigger value="modifiers" className="rounded-[4px]" data-testid="tab-modifiers">Modifiers</TabsTrigger>
                  <TabsTrigger value="totals" className="rounded-[4px]" data-testid="tab-totals">Category Totals</TabsTrigger>
                </TabsList>

                <TabsContent value="items" className="mt-4 space-y-4">
                  {aggregates.categories.length === 0 && (
                    <div className="text-sm text-slate-500 text-center py-8">
                      No items recorded for this date.
                    </div>
                  )}

                  {aggregates.categories.map(cat => {
                    const items = aggregates.itemsByCategory[cat] || [];
                    if (items.length === 0) return null;
                    
                    return (
                      <Card key={cat} className="bg-white dark:bg-slate-900 rounded-[4px]">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-gray-900 dark:text-white">
                            {cat}
                            <Badge variant="secondary" className="ml-2">{items.length} items</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0" data-testid={`item-${cat.replace(/\s+/g, '-')}-${idx}`}>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{item.itemName}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">×{item.totalQuantity}</span>
                                  <span className="text-sm font-semibold text-emerald-600">{formatCurrency(item.grossAmount)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>

                <TabsContent value="modifiers" className="mt-4">
                  <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-gray-900 dark:text-white">
                        Modifiers
                        <Badge variant="secondary" className="ml-2">{aggregates.modifiers.length} types</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {aggregates.modifiers.length === 0 ? (
                        <div className="text-sm text-slate-500">No modifiers recorded for this date.</div>
                      ) : (
                        <div className="space-y-2">
                          {aggregates.modifiers.map((mod, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0" data-testid={`modifier-${idx}`}>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{mod.modifierName}</span>
                              <span className="text-sm text-slate-600 dark:text-slate-400">×{mod.totalQuantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="totals" className="mt-4">
                  <Card className="bg-white dark:bg-slate-900 rounded-[4px]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-gray-900 dark:text-white">
                        Category Totals (POS Categories)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {aggregates.categoryTotals.length === 0 ? (
                        <div className="text-sm text-slate-500">No categories recorded for this date.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {aggregates.categoryTotals.map((cat, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-[4px]" data-testid={`total-${cat.category.replace(/\s+/g, '-')}`}>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                {cat.category}
                              </div>
                              <div className="text-2xl font-bold text-emerald-600">{cat.totalQuantity}</div>
                              <div className="text-xs text-slate-500">items sold</div>
                              <div className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{formatCurrency(cat.grossAmount)}</div>
                              <div className="text-xs text-slate-500">{cat.itemCount} unique items</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}

            {!aggregates && !aggLoading && (
              <div className="text-center py-8 text-slate-500">
                Aggregates not built for this date. Click "Rebuild from Loyverse API" to generate.
              </div>
            )}
          </>
        )}

        {isLoading && (
          <div className="text-center py-8 text-slate-600 dark:text-slate-400">
            Loading receipt truth...
          </div>
        )}
      </div>
    </div>
  );
}

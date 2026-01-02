import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
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

interface CategoryTotal {
  category: string;
  itemCount: number;
  totalQuantity: number;
  grossAmount: number;
}

interface AggregateData {
  date: string;
  itemsByCategory: Record<string, ItemAggregate[]>;
  categoryTotals: CategoryTotal[];
  categories: string[];
}

interface ModifierData {
  modifierName: string;
  count: number;
  totalRevenue: number;
}

interface ModifiersResponse {
  date: string;
  modifiers: ModifierData[];
}

export default function ReceiptsTruth() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultDate = yesterday.toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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

  // PATCH 14: Use modifiers-effective endpoint for accurate modifier counts
  const { data: modifiersData, isLoading: modLoading } = useQuery<ModifiersResponse>({
    queryKey: ['/api/analysis/receipts-truth/modifiers-effective', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/receipts-truth/modifiers-effective?date=${selectedDate}`);
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
      // PATCH 14: Rebuild modifiers-effective
      await apiRequest('/api/analysis/receipts-truth/modifiers-effective/rebuild', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts-truth', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts-truth/aggregates', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts-truth/modifiers-effective', selectedDate] });
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
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          Receipts Analysis
        </h1>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
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
              <Button
                onClick={() => rebuildMutation.mutate()}
                disabled={rebuildMutation.isPending || !selectedDate}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-[4px] text-xs"
                data-testid="button-rebuild"
              >
                <RefreshCw className={`w-3 h-3 mr-2 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />
                {rebuildMutation.isPending ? 'Rebuilding...' : 'Rebuild from Loyverse'}
              </Button>
            </div>

            {!hasTruth && !isLoading && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[4px]">
                <div className="text-xs font-semibold text-red-800 dark:text-red-300">NO RECEIPT TRUTH — DATA MISSING</div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  No truth exists for {selectedDate}. Click "Rebuild from Loyverse" to fetch receipts.
                </div>
              </div>
            )}

            {rebuildMutation.isError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[4px]">
                <div className="text-xs font-semibold text-red-800 dark:text-red-300">Rebuild Failed</div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {(rebuildMutation.error as any)?.message || 'Failed to rebuild receipt truth'}
                </div>
              </div>
            )}

            {hasTruth && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-[4px]">
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Data confirmed</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Data rebuilt from {summary.source} at {new Date(summary.builtAt).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {hasTruth && summary && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3 xl:grid-cols-7">
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Receipts</div>
                  <div className="text-lg md:text-xl font-bold text-slate-900 dark:text-white" data-testid="text-all-receipts">
                    {summary.allReceipts}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Sales</div>
                  <div className="text-lg md:text-xl font-bold text-emerald-600" data-testid="text-sales-count">
                    {summary.salesReceipts}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Refunds</div>
                  <div className="text-lg md:text-xl font-bold text-red-600" data-testid="text-refund-count">
                    {summary.refundReceipts}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Gross</div>
                  <div className="text-lg md:text-xl font-bold text-emerald-600 truncate" data-testid="text-gross-sales">
                    {formatCurrency(Number(summary.grossSales))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Discounts</div>
                  <div className="text-lg md:text-xl font-bold text-amber-600 truncate" data-testid="text-discounts">
                    {formatCurrency(Number(summary.discounts))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Refund Amt</div>
                  <div className="text-lg md:text-xl font-bold text-red-600 truncate" data-testid="text-refund-amount">
                    {formatCurrency(Number(summary.refunds))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px] col-span-2 md:col-span-1">
                <CardContent className="p-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">Net Sales</div>
                  <div className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate" data-testid="text-net-sales">
                    {formatCurrency(Number(summary.netSales))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {aggregates && aggregates.categoryTotals.length > 0 && (
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                    Category Totals
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {aggregates.categoryTotals.map((cat, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[4px] cursor-pointer hover:border-emerald-400 transition-colors"
                        onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}
                        data-testid={`total-${cat.category.replace(/\s+/g, '-')}`}
                      >
                        <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1 truncate">
                          {cat.category}
                        </div>
                        <div className="text-lg font-bold text-emerald-600">{cat.totalQuantity}</div>
                        <div className="text-xs text-slate-500">items sold</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{formatCurrency(cat.grossAmount)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {aggregates && expandedCategory && aggregates.itemsByCategory[expandedCategory] && (
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{expandedCategory}</span>
                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-[4px]">
                      {aggregates.itemsByCategory[expandedCategory].length} items
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                    {aggregates.itemsByCategory[expandedCategory].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 gap-2" data-testid={`item-${expandedCategory.replace(/\s+/g, '-')}-${idx}`}>
                        <span className="text-xs font-medium text-slate-900 dark:text-white truncate flex-1">{item.itemName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-slate-600 dark:text-slate-400">×{item.totalQuantity}</span>
                          <span className="text-xs font-semibold text-emerald-600">{formatCurrency(item.grossAmount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {aggregates && !expandedCategory && aggregates.categories.length > 0 && (
              <div className="text-center py-4 text-xs text-slate-500">
                Click a category above to view items
              </div>
            )}

            {modifiersData && (
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Modifiers (Effective Count)</span>
                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-[4px]">
                      {modifiersData.modifiers.length} unique
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  {modifiersData.modifiers.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-4">
                      No modifiers recorded for this date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                      {modifiersData.modifiers.map((mod, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 gap-2" data-testid={`modifier-${idx}`}>
                          <span className="text-xs font-medium text-slate-900 dark:text-white truncate flex-1">{mod.modifierName}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-slate-600 dark:text-slate-400">×{mod.count}</span>
                            <span className={`text-xs font-semibold ${mod.totalRevenue > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {mod.totalRevenue > 0 ? formatCurrency(mod.totalRevenue) : '฿0'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!modifiersData && !modLoading && summary && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-[4px]">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">MODIFIERS NOT BUILT</div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Click "Rebuild from Loyverse" to load modifier data.
                </div>
              </div>
            )}

            {!aggregates && !aggLoading && (
              <div className="text-center py-8 text-xs text-slate-500">
                Aggregates not built for this date. Click "Rebuild from Loyverse" to generate.
              </div>
            )}
          </>
        )}

        {isLoading && (
          <div className="text-center py-8 text-xs text-slate-600 dark:text-slate-400">
            Loading receipt truth...
          </div>
        )}
      </div>
    </div>
  );
}

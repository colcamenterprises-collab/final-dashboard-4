import { useEffect, useState } from "react";
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

interface DailyUsageRow {
  categoryName: string;
  sku: string | null;
  itemName: string;
  quantitySold: number;
  bunsUsed: number | null;
  beefServesUsed: number | null;
  beefGramsUsed: number | null;
  chickenServesUsed: number | null;
  chickenGramsUsed: number | null;
  cokeUsed: number | null;
  cokeZeroUsed: number | null;
  spriteUsed: number | null;
  waterUsed: number | null;
  fantaOrangeUsed: number | null;
  fantaStrawberryUsed: number | null;
  schweppesManaoUsed: number | null;
  friesUsed: number | null;
  baconUsed: number | null;
  cheeseUsed: number | null;
  picklesUsed: number | null;
  saladUsed: number | null;
  tomatoUsed: number | null;
  onionUsed: number | null;
  burgerSauceUsed: number | null;
  jalapenosUsed: number | null;
  coleslawUsed: number | null;
  isModifierEstimated: boolean;
}

interface DailyUsageSummary {
  expectedBuns: number;
  expectedBeefPatties: number;
  expectedBeefGrams: number;
  expectedChickenGrams: number;
  totalDrinksUsed: number;
  friesUsed: number;
  baconUsed: number;
  cheeseUsed: number;
  picklesUsed: number;
  saladUsed: number;
  tomatoUsed: number;
  onionUsed: number;
  burgerSauceUsed: number;
  jalapenosUsed: number;
  coleslawUsed: number;
  cokeUsed: number;
  cokeZeroUsed: number;
  spriteUsed: number;
  waterUsed: number;
  fantaOrangeUsed: number;
  fantaStrawberryUsed: number;
  schweppesManaoUsed: number;
}

interface DailyUsageResponse {
  date: string;
  summary: DailyUsageSummary;
  rows: DailyUsageRow[];
  issues: Array<{
    type: string;
    sku: string | null;
    itemName: string;
    details: string;
  }>;
}

export default function ReceiptsTruth() {
  const fallbackDate = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(fallbackDate);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: latestShift } = useQuery<{ ok: boolean; date: string }>({
    queryKey: ['/api/latest-valid-shift'],
    queryFn: async () => {
      const res = await fetch('/api/latest-valid-shift');
      if (!res.ok) throw new Error('Failed to load latest shift');
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (latestShift?.date && selectedDate === fallbackDate && latestShift.date !== selectedDate) {
      setSelectedDate(latestShift.date);
    }
  }, [latestShift?.date, selectedDate, fallbackDate]);

  const { data: summary, isLoading: summaryLoading } = useQuery<ReceiptTruthSummary>({
    queryKey: ['/api/analysis/receipts-truth', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/receipts-truth?date=${selectedDate}`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Not found'); }
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

  const { data: dailyUsage, isLoading: usageLoading } = useQuery<DailyUsageResponse>({
    queryKey: ['/api/analysis/receipts-truth/daily-usage', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/receipts-truth/daily-usage?date=${selectedDate}`);
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
      await apiRequest('/api/analysis/receipts-truth/modifiers-effective/rebuild', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate }),
        headers: { 'Content-Type': 'application/json' },
      });
      await apiRequest('/api/analysis/receipts-truth/daily-usage/rebuild', {
        method: 'POST',
        body: JSON.stringify({ date: selectedDate }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts-truth', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts-truth/aggregates', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts-truth/modifiers-effective', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts-truth/daily-usage', selectedDate] });
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount);

  const hasTruth = !!summary;
  const isLoading = summaryLoading || aggLoading;
  const n = (v: number | null | undefined) => (v === null || v === undefined ? '-' : Number(v) === 0 ? '-' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 }));
  const nz = (v: number | null | undefined) => (v === null || v === undefined ? '-' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 }));

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Receipts Analysis
        </h1>

        {/* ── Summary card ─────────────────────────────────────────────── */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">Summary</CardTitle>
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
            {/* ── Financial metric cards ──────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3 xl:grid-cols-7">
              {[
                { label: 'Receipts', value: summary.allReceipts, color: 'text-slate-900 dark:text-white', testId: 'text-all-receipts' },
                { label: 'Sales', value: summary.salesReceipts, color: 'text-emerald-600', testId: 'text-sales-count' },
                { label: 'Refunds', value: summary.refundReceipts, color: 'text-red-600', testId: 'text-refund-count' },
                { label: 'Gross', value: formatCurrency(Number(summary.grossSales)), color: 'text-emerald-600', testId: 'text-gross-sales' },
                { label: 'Discounts', value: formatCurrency(Number(summary.discounts)), color: 'text-amber-600', testId: 'text-discounts' },
                { label: 'Refund Amt', value: formatCurrency(Number(summary.refunds)), color: 'text-red-600', testId: 'text-refund-amount' },
                { label: 'Net Sales', value: formatCurrency(Number(summary.netSales)), color: 'text-slate-900 dark:text-white', testId: 'text-net-sales', wide: true },
              ].map((m, i) => (
                <Card key={i} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px] ${m.wide ? 'col-span-2 md:col-span-1' : ''}`}>
                  <CardContent className="p-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400">{m.label}</div>
                    <div className={`text-lg md:text-xl font-bold truncate ${m.color}`} data-testid={m.testId}>{m.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ── Category Totals ─────────────────────────────────────────── */}
            {aggregates && aggregates.categoryTotals.length > 0 && (
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">Category Totals</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    {aggregates.categoryTotals.map((cat, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[4px] cursor-pointer hover:border-emerald-400 transition-colors"
                        onClick={() => setExpandedCategory(expandedCategory === cat.category ? null : cat.category)}
                        data-testid={`total-${cat.category.replace(/\s+/g, '-')}`}
                      >
                        <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1 truncate">{cat.category}</div>
                        <div className="text-lg font-bold text-emerald-600">{cat.totalQuantity}</div>
                        <div className="text-xs text-slate-500">items sold</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{formatCurrency(cat.grossAmount)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Item Breakdown (expandable) ─────────────────────────────── */}
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
              <div className="text-center py-4 text-xs text-slate-500">Click a category above to view items</div>
            )}

            {/* ── Modifiers ───────────────────────────────────────────────── */}
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
                    <div className="text-xs text-slate-500 text-center py-4">No modifiers recorded for this date.</div>
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
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Click "Rebuild from Loyverse" to load modifier data.</div>
              </div>
            )}

            {!aggregates && !aggLoading && (
              <div className="text-center py-8 text-xs text-slate-500">
                Aggregates not built for this date. Click "Rebuild from Loyverse" to generate.
              </div>
            )}

            {/* ── DAILY USAGE SUMMARY ─────────────────────────────────────── */}
            {dailyUsage && (
              <>
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">Daily Usage Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-4">
                    {dailyUsage.issues.length > 0 && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-[4px]">
                        <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">{dailyUsage.issues.length} unmapped rows</div>
                        <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Some items lack usage rules — their usage counts as zero.</div>
                      </div>
                    )}

                    {/* Burger & kitchen */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Burger &amp; Kitchen</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
                        {[
                          { label: 'Buns', value: dailyUsage.summary.expectedBuns },
                          { label: 'Beef Patties', value: dailyUsage.summary.expectedBeefPatties },
                          { label: 'Beef (g)', value: dailyUsage.summary.expectedBeefGrams },
                          { label: 'Chicken (g)', value: dailyUsage.summary.expectedChickenGrams },
                          { label: 'Fries', value: dailyUsage.summary.friesUsed },
                          { label: 'Coleslaw', value: dailyUsage.summary.coleslawUsed },
                          { label: 'Bacon', value: dailyUsage.summary.baconUsed },
                          { label: 'Cheese', value: dailyUsage.summary.cheeseUsed },
                          { label: 'Pickles', value: dailyUsage.summary.picklesUsed },
                          { label: 'Salad', value: dailyUsage.summary.saladUsed },
                          { label: 'Tomato', value: dailyUsage.summary.tomatoUsed },
                          { label: 'Onion', value: dailyUsage.summary.onionUsed },
                          { label: 'Burger Sauce', value: dailyUsage.summary.burgerSauceUsed },
                          { label: 'Jalapeños', value: dailyUsage.summary.jalapenosUsed },
                        ].map((item, i) => (
                          <div key={i} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[4px]">
                            <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight mb-1">{item.label}</div>
                            <div className="text-base font-bold text-slate-900 dark:text-white">{nz(item.value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Drinks */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Drinks — Total: {nz(dailyUsage.summary.totalDrinksUsed)}</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                        {[
                          { label: 'Coke', value: dailyUsage.summary.cokeUsed },
                          { label: 'Coke Zero', value: dailyUsage.summary.cokeZeroUsed },
                          { label: 'Sprite', value: dailyUsage.summary.spriteUsed },
                          { label: 'Water', value: dailyUsage.summary.waterUsed },
                          { label: 'Fanta Orange', value: dailyUsage.summary.fantaOrangeUsed },
                          { label: 'Fanta Straw.', value: dailyUsage.summary.fantaStrawberryUsed },
                          { label: 'Schweppes', value: dailyUsage.summary.schweppesManaoUsed },
                        ].map((item, i) => (
                          <div key={i} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[4px]">
                            <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight mb-1">{item.label}</div>
                            <div className="text-base font-bold text-emerald-600">{nz(item.value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ── USAGE BY ITEM ─────────────────────────────────────────── */}
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px] overflow-hidden min-w-0">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Usage By Item</span>
                      <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-[4px]">
                        {dailyUsage.rows.length} rows
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pt-0">
                    <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                      <table className="w-full text-xs border-collapse" style={{ minWidth: '1200px' }}>
                        <thead>
                          <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-left">
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Category</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">SKU</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 min-w-[140px]">Item</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Qty</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Buns</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Patties</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Beef g</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Chkn g</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Fries</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Bacon</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Cheese</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Pickles</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Salad</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Tomato</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Onion</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Sauce</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Jalap.</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Coleslaw</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Coke</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">C.Zero</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Sprite</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Water</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">F.Org</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">F.Str</th>
                            <th className="py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 text-right whitespace-nowrap">Schwpps</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyUsage.rows.map((row, idx) => {
                            const prevCat = idx > 0 ? dailyUsage.rows[idx - 1].categoryName : null;
                            const isCatBoundary = prevCat !== null && prevCat !== row.categoryName;
                            const isUnmapped = row.bunsUsed === null && row.beefGramsUsed === null && row.chickenGramsUsed === null && row.cokeUsed === null && row.friesUsed === null;
                            return (
                              <tr
                                key={`${row.categoryName}-${row.sku || row.itemName}-${idx}`}
                                className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100/40 dark:hover:bg-slate-800/50 transition-colors ${isCatBoundary ? 'border-t-2 border-t-slate-300 dark:border-t-slate-600' : ''} ${isUnmapped ? 'opacity-50' : ''}`}
                              >
                                <td className="py-2 px-2 text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[120px] truncate">{row.categoryName}</td>
                                <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{row.sku || '-'}</td>
                                <td className="py-2 px-2 text-slate-900 dark:text-white min-w-[140px]">
                                  {row.itemName}
                                  {row.isModifierEstimated && (
                                    <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">~Est.</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right font-semibold text-slate-900 dark:text-white">{nz(row.quantitySold)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.bunsUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.beefServesUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.beefGramsUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.chickenGramsUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.friesUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.baconUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.cheeseUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.picklesUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.saladUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.tomatoUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.onionUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.burgerSauceUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.jalapenosUsed)}</td>
                                <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">{n(row.coleslawUsed)}</td>
                                <td className="py-2 px-2 text-right text-emerald-600">{n(row.cokeUsed)}</td>
                                <td className="py-2 px-2 text-right text-emerald-600">{n(row.cokeZeroUsed)}</td>
                                <td className="py-2 px-2 text-right text-emerald-600">{n(row.spriteUsed)}</td>
                                <td className="py-2 px-2 text-right text-emerald-600">{n(row.waterUsed)}</td>
                                <td className="py-2 px-2 text-right text-emerald-600">{n(row.fantaOrangeUsed)}</td>
                                <td className="py-2 px-2 text-right text-emerald-600">{n(row.fantaStrawberryUsed)}</td>
                                <td className="py-2 px-2 text-right text-emerald-600">{n(row.schweppesManaoUsed)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {!dailyUsage && !usageLoading && (
              <div className="text-center py-8 text-xs text-slate-500">
                Daily usage not built for this date. Click "Rebuild from Loyverse" to generate.
              </div>
            )}
          </>
        )}

        {isLoading && (
          <div className="text-center py-8 text-xs text-slate-600 dark:text-slate-400">Loading receipt truth...</div>
        )}
      </div>
    </div>
  );
}

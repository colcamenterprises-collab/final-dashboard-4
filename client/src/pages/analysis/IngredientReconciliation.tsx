/**
 * PHASE I-3 — INGREDIENT RECONCILIATION PAGE
 * /analysis/ingredient-reconciliation
 * 
 * READ-ONLY display of ingredient usage vs purchases.
 * Clean, dense, intentional. No charts, no exports, no drilldowns.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ReconciliationItem {
  ingredientId: number;
  ingredient: string;
  unit: string;
  usedQuantity: number;
  purchasedQuantity: number;
  delta: number;
  source: string;
}

interface ReconciliationData {
  ok: boolean;
  dateRange: { start: string; end: string };
  items: ReconciliationItem[];
  lastUpdated: string;
  warning?: string;
}

export default function IngredientReconciliation() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [filter, setFilter] = useState('');

  const { data, isLoading, isError, error } = useQuery<ReconciliationData>({
    queryKey: ['/api/analysis/ingredient-reconciliation', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/ingredient-reconciliation?start=${startDate}&end=${endDate}`);
      const payload = await res.json();
      if (!res.ok) {
        const err = new Error(payload?.message || 'Ingredient reconciliation unavailable');
        (err as any).status = res.status;
        throw err;
      }
      return payload;
    },
  });

  const filteredItems = data?.items?.filter(item =>
    item.ingredient.toLowerCase().includes(filter.toLowerCase())
  ) || [];

  const getDeltaColor = (delta: number) => {
    if (delta > 0.5) return 'text-emerald-600 bg-emerald-50';
    if (delta < -0.5) return 'text-red-600 bg-red-50';
    return 'text-amber-600 bg-amber-50';
  };

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" data-testid="page-title">
            Ingredient Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Comparing usage (from POS sales) with purchases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Derived
          </Badge>
          {data?.lastUpdated && (
            <span className="text-xs text-slate-400">
              Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="start-date" className="text-xs">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-xs">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
                data-testid="input-end-date"
              />
            </div>
            <div>
              <Label htmlFor="filter" className="text-xs">Search Ingredient</Label>
              <Input
                id="filter"
                type="text"
                placeholder="Filter by name..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="mt-1"
                data-testid="input-filter"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Reconciliation Data</CardTitle>
            {!isError && (
              <span className="text-xs text-slate-400">
                {filteredItems.length} items
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 text-center" data-testid="reconciliation-disabled">
              <div className="text-slate-800 text-sm font-medium">
                Ingredient Reconciliation is currently unavailable
              </div>
              <div className="text-slate-500 text-xs mt-2">
                {(error as Error)?.message || 'The module is disabled until schema alignment is complete.'}
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center" data-testid="empty-state">
              <div className="text-slate-400 text-sm">
                {data?.items?.length === 0 
                  ? 'No reconciliation data available for the selected period'
                  : 'No ingredients match your filter'}
              </div>
              <div className="text-slate-300 text-xs mt-2">
                Data is derived from POS receipts and purchasing records
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="reconciliation-table">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Ingredient</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Used</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Purchased</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Delta</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr 
                      key={item.ingredientId} 
                      className="hover:bg-slate-50 transition-colors"
                      data-testid={`row-ingredient-${item.ingredientId}`}
                    >
                      <td className="px-4 py-3 text-slate-900 font-medium">
                        {item.ingredient}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {item.usedQuantity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {item.purchasedQuantity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'px-2 py-1 rounded text-xs font-medium tabular-nums',
                          getDeltaColor(item.delta)
                        )}>
                          {item.delta > 0 ? '+' : ''}{item.delta.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">
                        {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Source: POS Receipts + Purchasing Records</span>
        {!isError && data?.warning && (
          <Badge variant="outline" className="text-amber-500 border-amber-200">
            {data.warning}
          </Badge>
        )}
      </div>
    </div>
  );
}

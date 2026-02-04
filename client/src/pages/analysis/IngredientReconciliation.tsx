/**
 * INGREDIENT RECONCILIATION PAGE
 * /analysis/ingredient-reconciliation
 *
 * READ-ONLY display of ingredient usage vs purchases.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, CloudDownload } from 'lucide-react';

interface ReconciliationItem {
  ingredientName: string;
  unit: string | null;
  usedQuantity: number;
  purchasedQuantity: number;
  varianceQuantity: number;
  variancePct: number | null;
  status: 'OK' | 'INSUFFICIENT_DATA' | 'UNIT_MISMATCH';
}

interface ReconciliationData {
  ok: boolean;
  date: string;
  reconciled: boolean;
  variancePct: number | null;
  details: ReconciliationItem[];
}

export default function IngredientReconciliation() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState('');
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<ReconciliationData>({
    queryKey: ['/api/analysis/ingredient-reconciliation', date],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/ingredient-reconciliation?date=${date}`);
      const payload = await res.json();
      if (!res.ok) {
        const err = new Error(payload?.error || payload?.message || 'Ingredient reconciliation unavailable');
        (err as any).status = res.status;
        throw err;
      }
      return payload;
    },
  });

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/analysis/ingredient-reconciliation/rebuild?date=${date}`, {
        method: 'POST',
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'Rebuild failed');
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/ingredient-reconciliation', date] });
    },
  });

  const filteredItems = useMemo(() => {
    return data?.details?.filter(item =>
      item.ingredientName.toLowerCase().includes(filter.toLowerCase())
    ) || [];
  }, [data, filter]);

  const getVarianceColor = (variancePct: number | null) => {
    if (variancePct === null) return 'text-slate-500 bg-slate-50';
    const abs = Math.abs(variancePct);
    if (abs > 10) return 'text-red-700 bg-red-50';
    if (abs >= 5) return 'text-amber-700 bg-amber-50';
    return 'text-emerald-700 bg-emerald-50';
  };

  const runSync = async () => {
    setSyncStatus(null);
    try {
      const res = await fetch(`/api/analysis/sync-pos-for-date?date=${date}`, { method: 'POST' });
      const payload = await res.json();
      if (!payload?.ok) {
        setSyncStatus({ type: 'warning', message: payload?.message || payload?.reason || 'Sync failed' });
        return;
      }
      setSyncStatus({ type: 'success', message: payload?.message || 'Sync completed' });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/ingredient-reconciliation', date] });
    } catch (err: any) {
      setSyncStatus({ type: 'error', message: err?.message || 'Sync failed' });
    }
  };

  const exportCsv = () => {
    window.open(`/api/analysis/ingredient-reconciliation/export.csv?date=${date}`, '_blank');
  };

  const errorMessage = (error as Error | undefined)?.message || '';
  const missingPos = errorMessage.includes('No Loyverse receipts for date');
  const missingDailySales = errorMessage.includes('Missing staff daily form entry');

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
          {data?.reconciled && (
            <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700">
              Reconciled
            </Badge>
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
              <Label htmlFor="date" className="text-xs">Business Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
                data-testid="input-date"
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
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              onClick={() => rebuildMutation.mutate()}
              disabled={rebuildMutation.isPending}
              className="text-xs"
              data-testid="button-refresh-data"
            >
              <RefreshCw className={`w-3 h-3 mr-2 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />
              {rebuildMutation.isPending ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            <Button
              onClick={exportCsv}
              variant="outline"
              className="text-xs"
              data-testid="button-export-csv"
            >
              <Download className="w-3 h-3 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {syncStatus && (
        <div
          className={cn(
            'border rounded px-3 py-2 text-xs',
            syncStatus.type === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
            syncStatus.type === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700',
            syncStatus.type === 'error' && 'border-red-200 bg-red-50 text-red-700'
          )}
          data-testid="sync-banner"
        >
          {syncStatus.message}
        </div>
      )}

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
            <div className="p-6 space-y-3" data-testid="reconciliation-disabled">
              <div className="text-slate-800 text-sm font-medium">
                Ingredient Reconciliation is currently unavailable
              </div>
              <div className="text-slate-500 text-xs">
                {(error as Error)?.message || 'Data not available for this date.'}
              </div>
              {missingPos && (
                <div className="flex items-center gap-2">
                  <Button onClick={runSync} variant="outline" size="sm" className="text-xs" data-testid="button-run-sync">
                    <CloudDownload className="w-3 h-3 mr-2" />
                    Run Sync
                  </Button>
                  <span className="text-xs text-slate-400">Fetch Loyverse receipts for this date</span>
                </div>
              )}
              {missingDailySales && (
                <div className="text-xs text-amber-700">
                  Missing staff daily form entry. Submit Daily Sales & Stock for this date.
                </div>
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center" data-testid="empty-state">
              <div className="text-slate-400 text-sm">
                {data?.details?.length === 0
                  ? 'No reconciliation data available for the selected period'
                  : 'No ingredients match your filter'}
              </div>
              <div className="text-slate-300 text-xs mt-2">
                Data is derived from POS receipts and purchasing records
              </div>
            </div>
          ) : (
            <Table data-testid="reconciliation-table">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Purchased</TableHead>
                  <TableHead className="text-right">Variance Qty</TableHead>
                  <TableHead className="text-right">Variance %</TableHead>
                  <TableHead className="text-center">Unit</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.ingredientName} data-testid={`row-ingredient-${item.ingredientName}`}>
                    <TableCell className="font-medium text-slate-900">
                      {item.ingredientName}
                    </TableCell>
                    <TableCell className="text-right text-slate-600 tabular-nums">
                      {item.usedQuantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-slate-600 tabular-nums">
                      {item.purchasedQuantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-slate-600 tabular-nums">
                      {item.varianceQuantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn('px-2 py-1 rounded text-xs font-medium tabular-nums', getVarianceColor(item.variancePct))}>
                        {item.variancePct === null ? 'N/A' : `${item.variancePct > 0 ? '+' : ''}${item.variancePct.toFixed(2)}%`}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-slate-500 text-xs">
                      {item.unit || '—'}
                    </TableCell>
                    <TableCell className="text-center text-xs text-slate-500">
                      {item.status}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Source: POS Receipts + Daily Sales Stock (requisition)</span>
        {!isError && data?.variancePct !== null && (
          <Badge variant="outline" className="text-slate-600 border-slate-200">
            Total variance: {data.variancePct > 0 ? '+' : ''}{data.variancePct.toFixed(2)}%
          </Badge>
        )}
      </div>
    </div>
  );
}

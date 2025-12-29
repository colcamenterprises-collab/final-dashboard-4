import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertTriangle, CheckCircle2, Info, Receipt } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface BatchItem {
  category: string | null;
  sku: string | null;
  itemName: string;
  modifiers: string | null;
  quantity: number;
  grossSales: number;
  netSales: number;
  isRefund?: boolean;
}

interface BatchSummary {
  ok: boolean;
  hasBatch: boolean;
  businessDate: string;
  allReceipts: number;
  salesCount: number;
  refundCount: number;
  lineItemCount: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  items: BatchItem[];
  error?: string;
}

export default function ReceiptsTruth() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultDate = yesterday.toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const { data, isLoading } = useQuery<BatchSummary>({
    queryKey: ['/api/analysis/receipts/summary', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/receipts/summary?date=${selectedDate}`);
      return res.json();
    },
    enabled: !!selectedDate,
  });

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/analysis/receipts/rebuild', {
        method: 'POST',
        body: JSON.stringify({ business_date: selectedDate }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/receipts/summary', selectedDate] });
    },
  });

  const hasBatch = data?.hasBatch === true;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-8 w-8 text-emerald-600" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Receipts (Truth)
        </h1>
      </div>

      <Card className="border-slate-200 dark:border-slate-700 rounded-[4px]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <strong className="text-gray-900 dark:text-white">Receipts are the single source of truth.</strong>
              <br />
              All sales, stock, and ingredient analysis must reconcile to this page.
              <br />
              <span className="text-xs">Data source: POS raw_json.total_money | Shift window: 17:00-03:00 Bangkok</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[4px]">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-gray-900 dark:text-white">
            Batch Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label htmlFor="businessDate" className="text-sm text-slate-600 dark:text-slate-400">
                Business Date
              </Label>
              <Input
                id="businessDate"
                type="date"
                value={selectedDate}
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
              {rebuildMutation.isPending ? 'Rebuilding...' : 'Rebuild from Receipts'}
            </Button>
          </div>

          {!hasBatch && !isLoading && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[4px]">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <div className="font-semibold text-red-800 dark:text-red-300">NO RECEIPT BATCH — TRUTH MISSING</div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  {data?.error || `No batch exists for ${selectedDate}. Click "Rebuild from Receipts" to create one.`}
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
                  {(rebuildMutation.error as any)?.message || 'Failed to rebuild receipt batch'}
                </div>
              </div>
            </div>
          )}

          {hasBatch && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-[4px]">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <div className="font-semibold text-emerald-800 dark:text-emerald-300">Receipt truth confirmed</div>
                <div className="text-sm text-emerald-600 dark:text-emerald-400">
                  Batch for {data.businessDate} is locked and verified.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasBatch && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="rounded-[4px]">
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">All Receipts</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-all-receipts">
                  {data.allReceipts}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[4px]">
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">Sales</div>
                <div className="text-2xl font-bold text-emerald-600" data-testid="text-sales-count">
                  {data.salesCount}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[4px]">
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">Refunds</div>
                <div className="text-2xl font-bold text-red-600" data-testid="text-refund-count">
                  {data.refundCount}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[4px]">
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">Gross Sales</div>
                <div className="text-2xl font-bold text-emerald-600" data-testid="text-gross-sales">
                  {formatCurrency(Number(data.grossSales))}
                </div>
                <div className="text-xs text-slate-500">raw_json.total_money</div>
              </CardContent>
            </Card>
            <Card className="rounded-[4px]">
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">Discounts</div>
                <div className="text-2xl font-bold text-amber-600" data-testid="text-discounts">
                  {formatCurrency(Number(data.discounts))}
                </div>
                <div className="text-xs text-slate-500">raw_json.total_discount</div>
              </CardContent>
            </Card>
            <Card className="rounded-[4px]">
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">Net Sales</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-net-sales">
                  {formatCurrency(Number(data.netSales))}
                </div>
                <div className="text-xs text-slate-500">calculated</div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[4px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-gray-900 dark:text-white">
                Items Sold ({data.lineItemCount} line items)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-700">
                      <TableHead className="text-xs text-slate-600 dark:text-slate-400">Category</TableHead>
                      <TableHead className="text-xs text-slate-600 dark:text-slate-400">Item</TableHead>
                      <TableHead className="text-xs text-slate-600 dark:text-slate-400">Modifiers</TableHead>
                      <TableHead className="text-xs text-slate-600 dark:text-slate-400 text-right">Qty</TableHead>
                      <TableHead className="text-xs text-slate-600 dark:text-slate-400 text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item, idx) => (
                      <TableRow key={idx} className="border-slate-200 dark:border-slate-700" data-testid={`row-item-${idx}`}>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-300">{item.category || '-'}</TableCell>
                        <TableCell className="text-sm font-medium text-gray-900 dark:text-white">{item.itemName}</TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">{item.modifiers || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-900 dark:text-white text-right">{item.quantity}</TableCell>
                        <TableCell className="text-sm text-emerald-600 text-right">
                          {formatCurrency(Number(item.grossSales))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Note: Line totals are calculated from qty × unit_price. Modifier prices may not be included in line totals.
                The Gross/Net Sales cards above use the POS receipt totals which include all modifiers.
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {isLoading && (
        <div className="text-center py-8 text-slate-600 dark:text-slate-400">
          Loading batch summary...
        </div>
      )}
    </div>
  );
}

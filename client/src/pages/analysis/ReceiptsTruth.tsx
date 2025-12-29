import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface BatchItem {
  category: string | null;
  sku: string | null;
  itemName: string;
  modifiers: string | null;
  quantity: number;
  grossSales: number;
  netSales: number;
}

interface BatchSummary {
  ok: boolean;
  hasBatch: boolean;
  businessDate: string;
  receiptCount: number;
  lineItemCount: number;
  grossSales: number;
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

  const { data, isLoading, error, refetch } = useQuery<BatchSummary>({
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
  const hasError = data?.ok === false || rebuildMutation.isError;

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-300">
            <strong className="text-white">Receipts are the single source of truth.</strong>
            <br />
            All sales, stock, and ingredient analysis must reconcile to this page.
          </div>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl text-white flex items-center gap-2">
            Receipts Truth Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Business Date</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-48 bg-slate-800 border-slate-600 text-white"
                data-testid="input-business-date"
              />
            </div>
            <Button
              onClick={() => rebuildMutation.mutate()}
              disabled={rebuildMutation.isPending || !selectedDate}
              variant="outline"
              className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/30"
              data-testid="button-rebuild"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />
              {rebuildMutation.isPending ? 'Rebuilding...' : 'Rebuild from Receipts'}
            </Button>
          </div>

          {!hasBatch && !isLoading && (
            <Alert variant="destructive" className="bg-red-900/30 border-red-700">
              <AlertTriangle className="w-5 h-5" />
              <AlertTitle className="text-red-300">NO RECEIPT BATCH — TRUTH MISSING</AlertTitle>
              <AlertDescription className="text-red-400">
                {data?.error || `No batch exists for ${selectedDate}. Click "Rebuild from Receipts" to create one.`}
              </AlertDescription>
            </Alert>
          )}

          {rebuildMutation.isError && (
            <Alert variant="destructive" className="bg-red-900/30 border-red-700">
              <AlertTriangle className="w-5 h-5" />
              <AlertTitle className="text-red-300">Rebuild Failed</AlertTitle>
              <AlertDescription className="text-red-400">
                {(rebuildMutation.error as any)?.message || 'Failed to rebuild receipt batch'}
              </AlertDescription>
            </Alert>
          )}

          {hasBatch && (
            <Alert className="bg-emerald-900/30 border-emerald-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <AlertTitle className="text-emerald-300">Receipt truth confirmed</AlertTitle>
              <AlertDescription className="text-emerald-400">
                Batch for {data.businessDate} is locked and verified.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {hasBatch && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="text-sm text-slate-400">Receipts</div>
                <div className="text-2xl font-bold text-white" data-testid="text-receipt-count">
                  {data.receiptCount}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="text-sm text-slate-400">Line Items</div>
                <div className="text-2xl font-bold text-white" data-testid="text-line-item-count">
                  {data.lineItemCount}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="text-sm text-slate-400">Gross Sales</div>
                <div className="text-2xl font-bold text-emerald-400" data-testid="text-gross-sales">
                  ฿{Number(data.grossSales).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="text-sm text-slate-400">Net Sales</div>
                <div className="text-2xl font-bold text-white" data-testid="text-net-sales">
                  ฿{Number(data.netSales).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white">Items Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Category</TableHead>
                      <TableHead className="text-slate-400">Item</TableHead>
                      <TableHead className="text-slate-400">Modifiers</TableHead>
                      <TableHead className="text-slate-400 text-right">Qty</TableHead>
                      <TableHead className="text-slate-400 text-right">Gross Sales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item, idx) => (
                      <TableRow key={idx} className="border-slate-700" data-testid={`row-item-${idx}`}>
                        <TableCell className="text-slate-300">{item.category || '-'}</TableCell>
                        <TableCell className="text-white font-medium">{item.itemName}</TableCell>
                        <TableCell className="text-slate-400 text-sm">{item.modifiers || '-'}</TableCell>
                        <TableCell className="text-white text-right">{item.quantity}</TableCell>
                        <TableCell className="text-emerald-400 text-right">
                          ฿{Number(item.grossSales).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {isLoading && (
        <div className="text-center py-8 text-slate-400">
          Loading batch summary...
        </div>
      )}
    </div>
  );
}

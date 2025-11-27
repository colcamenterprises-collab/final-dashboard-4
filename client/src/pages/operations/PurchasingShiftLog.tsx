import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Package, RefreshCw, Download } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/format';

interface PurchasingItem {
  id: number;
  item: string;
  brand: string | null;
  supplierName: string | null;
  supplierSku: string | null;
  unitDescription: string | null;
  category: string | null;
}

interface Shift {
  id: string;
  shiftDate: string;
  createdAt: string;
}

interface Entry {
  dailyStockId: string;
  purchasingItemId: number;
  quantity: number;
}

interface MatrixData {
  items: PurchasingItem[];
  shifts: Shift[];
  entries: Entry[];
}

export default function PurchasingShiftLog() {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
  
  const [startDate, setStartDate] = useState(defaultFrom);
  const [endDate, setEndDate] = useState(today);

  const preSets = [
    { label: 'Last 7 Days', start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0, 10), end: today },
    { label: 'Last 30 Days', start: defaultFrom, end: today },
    { label: 'MTD', start: new Date().toISOString().slice(0, 7) + '-01', end: today }
  ];

  const { data: matrix, isLoading, refetch } = useQuery<MatrixData>({
    queryKey: ['purchasing-shift-matrix', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/purchasing-shift-matrix?from=${startDate}&to=${endDate}`);
      if (!res.ok) throw new Error('Failed to load matrix data');
      return res.json();
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/purchasing-shift-backfill', { method: 'POST' });
      if (!res.ok) throw new Error('Backfill failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Backfill Complete',
        description: `Processed ${data.processed} records, synced ${data.synced} items`,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Backfill Failed',
        description: String(error),
        variant: 'destructive',
      });
    },
  });

  const getQuantity = (itemId: number, shiftId: string): number => {
    if (!matrix?.entries) return 0;
    const entry = matrix.entries.find(e => e.purchasingItemId === itemId && e.dailyStockId === shiftId);
    return entry?.quantity || 0;
  };

  const getItemTotal = (itemId: number): number => {
    if (!matrix?.entries) return 0;
    return matrix.entries
      .filter(e => e.purchasingItemId === itemId)
      .reduce((sum, e) => sum + e.quantity, 0);
  };

  const exportCSV = () => {
    if (!matrix) return;
    
    const headers = ['Item', 'Category', 'Supplier', 'Total', ...matrix.shifts.map(s => formatDateDDMMYYYY(s.shiftDate))];
    const rows = matrix.items
      .filter(item => getItemTotal(item.id) > 0)
      .map(item => [
        item.item,
        item.category || '',
        item.supplierName || '',
        getItemTotal(item.id),
        ...matrix.shifts.map(s => getQuantity(item.id, s.id) || '')
      ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchasing-log-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const itemsWithData = matrix?.items.filter(item => getItemTotal(item.id) > 0) || [];

  return (
    <div className="p-4 space-y-4" data-testid="purchasing-shift-log-page">
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-extrabold font-[Poppins] flex items-center gap-2">
          <Package className="h-6 w-6 text-emerald-600" />
          Purchasing Shift Log
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
            className="text-xs rounded-[4px]"
            data-testid="button-backfill"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${backfillMutation.isPending ? 'animate-spin' : ''}`} />
            Backfill
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!matrix || itemsWithData.length === 0}
            className="text-xs rounded-[4px]"
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="rounded-[4px] border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label htmlFor="start-date" className="text-xs text-slate-600">From</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs rounded-[4px] border-slate-200 w-36"
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-xs text-slate-600">To</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs rounded-[4px] border-slate-200 w-36"
                data-testid="input-end-date"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {preSets.map(p => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate(p.start);
                  setEndDate(p.end);
                }}
                className={`text-xs rounded-[4px] ${
                  startDate === p.start && endDate === p.end 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                    : 'border-slate-200'
                }`}
                data-testid={`button-preset-${p.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="rounded-[4px] border-slate-200 p-8">
          <div className="text-center text-sm text-slate-600">Loading purchasing data...</div>
        </Card>
      ) : !matrix || matrix.shifts.length === 0 ? (
        <Card className="rounded-[4px] border-slate-200 p-8">
          <div className="text-center text-sm text-slate-500">
            No shift data found for the selected date range.
          </div>
        </Card>
      ) : itemsWithData.length === 0 ? (
        <Card className="rounded-[4px] border-slate-200 p-8">
          <div className="text-center text-sm text-slate-500">
            <p>No purchasing data recorded for shifts in this date range.</p>
            <p className="mt-2 text-xs">Click "Backfill" to sync historical data from existing Daily Stock forms.</p>
          </div>
        </Card>
      ) : (
        <Card className="rounded-[4px] border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="bg-slate-50 border-slate-200">
                  <TableHead className="text-xs font-medium text-slate-900 sticky left-0 bg-slate-50 z-10 min-w-[180px]">
                    Item
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-900 w-16">Category</TableHead>
                  <TableHead className="text-xs font-medium text-slate-900 text-center bg-emerald-50 w-16">
                    Total
                  </TableHead>
                  {matrix.shifts.map((shift) => (
                    <TableHead 
                      key={shift.id} 
                      className="text-xs font-medium text-slate-900 text-center min-w-[70px]"
                    >
                      {formatDateDDMMYYYY(shift.shiftDate).slice(0, 5)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsWithData.map((item) => (
                  <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50">
                    <TableCell 
                      className="text-xs text-slate-900 font-medium sticky left-0 bg-white z-10"
                      data-testid={`text-item-${item.id}`}
                    >
                      <div>{item.item}</div>
                      {item.supplierName && (
                        <div className="text-slate-500 text-[10px]">{item.supplierName}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {item.category || '-'}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-emerald-700 text-center bg-emerald-50">
                      {getItemTotal(item.id)}
                    </TableCell>
                    {matrix.shifts.map((shift) => {
                      const qty = getQuantity(item.id, shift.id);
                      return (
                        <TableCell 
                          key={shift.id} 
                          className={`text-xs text-center ${qty > 0 ? 'text-slate-900' : 'text-slate-300'}`}
                          data-testid={`cell-${item.id}-${shift.id}`}
                        >
                          {qty || '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-600">
              Showing {itemsWithData.length} items with recorded quantities across {matrix.shifts.length} shifts
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// THB formatting helper
const thb = (v: number): string => {
  return "฿" + v.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type ShoppingListLine = {
  fieldKey: string;
  quantity: number;
  item: string;
  brand: string | null;
  supplier: string | null;
  sku: string | null;
  unitDescription: string | null;
  unitCost: number;
  lineTotal: number;
};

type ShoppingListData = {
  dailyStockId: string;
  lines: ShoppingListLine[];
  grandTotal: number;
};

export default function PurchasingListPage() {
  const params = useParams();
  const dailyStockId = params.id || '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchasing-list', dailyStockId],
    queryFn: async () => {
      const res = await fetch(`/api/purchasing-list/${dailyStockId}`);
      if (!res.ok) throw new Error('Failed to load purchasing list');
      return res.json() as Promise<ShoppingListData>;
    },
    enabled: !!dailyStockId,
  });

  const handleDownload = () => {
    window.location.href = `/api/purchasing-list/${dailyStockId}/csv`;
  };

  if (!dailyStockId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Shopping List</h1>
        <p className="text-sm text-slate-600">No daily stock ID provided</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Shopping List</h1>
        <p className="text-xs text-slate-600">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Shopping List</h1>
        <p className="text-xs text-red-600">Error: {(error as Error).message}</p>
      </div>
    );
  }

  const lines = data?.lines || [];
  const grandTotal = data?.grandTotal || 0;

  return (
    <div className="p-6 max-w-full">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-slate-900">Shopping List</h1>
        <Button 
          onClick={handleDownload}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 rounded-[4px]"
          data-testid="button-download-csv"
        >
          <Download className="h-4 w-4 mr-1" />
          Download CSV
        </Button>
      </div>

      {lines.length === 0 ? (
        <Card className="p-6">
          <p className="text-xs text-slate-600">No items to purchase for this shift.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3 text-left font-medium text-slate-600">Item</th>
                  <th className="p-3 text-left font-medium text-slate-600">Brand</th>
                  <th className="p-3 text-left font-medium text-slate-600">SKU</th>
                  <th className="p-3 text-left font-medium text-slate-600">Supplier</th>
                  <th className="p-3 text-left font-medium text-slate-600">Unit</th>
                  <th className="p-3 text-right font-medium text-slate-600">Qty</th>
                  <th className="p-3 text-right font-medium text-slate-600">Unit Cost</th>
                  <th className="p-3 text-right font-medium text-slate-600">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-slate-200 hover:bg-slate-50"
                    data-testid={`row-item-${idx}`}
                  >
                    <td className="p-3 text-slate-900" data-testid={`text-item-${idx}`}>{line.item}</td>
                    <td className="p-3 text-slate-600">{line.brand || '-'}</td>
                    <td className="p-3 text-slate-600">{line.sku || '-'}</td>
                    <td className="p-3 text-slate-600">{line.supplier || '-'}</td>
                    <td className="p-3 text-slate-600">{line.unitDescription || '-'}</td>
                    <td className="p-3 text-right text-slate-900">{line.quantity}</td>
                    <td className="p-3 text-right text-slate-600">{thb(line.unitCost)}</td>
                    <td className="p-3 text-right font-medium text-slate-900">{thb(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 border-t-2 border-emerald-600">
                  <td colSpan={7} className="p-3 text-right font-bold text-emerald-900">
                    Grand Total
                  </td>
                  <td 
                    className="p-3 text-right font-bold text-emerald-900 text-sm"
                    data-testid="text-grand-total"
                  >
                    {thb(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-4 text-xs text-slate-500">
        Stock ID: {dailyStockId} | Items: {lines.length}
      </div>
    </div>
  );
}

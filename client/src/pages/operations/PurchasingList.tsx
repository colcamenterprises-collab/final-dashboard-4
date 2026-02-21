import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import { Download } from 'lucide-react';
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
  salesId: string | null;
  stockId: string | null;
  shiftDate: string | null;
  lines: ShoppingListLine[];
  grandTotal: number;
  itemCount: number;
};

function GuardState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="text-base font-semibold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-600 mb-4">{description}</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/operations/purchasing" className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 rounded-[4px]">
          Go to Purchasing Items
        </Link>
        <Link href="/operations/daily-stock" className="inline-flex items-center bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs h-8 px-3 rounded-[4px]">
          Go to Daily Stock
        </Link>
      </div>
    </Card>
  );
}

export default function PurchasingListPage() {
  const params = useParams();
  const dailyStockId = params.id || '';
  const hasValidIdFormat = /^[a-zA-Z0-9-]+$/.test(dailyStockId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['purchasing-list', dailyStockId],
    queryFn: async () => {
      const res = await fetch(`/api/purchasing-list/${dailyStockId}`);
      if (!res.ok) throw new Error('No linked daily stock found for this ID.');
      return res.json() as Promise<ShoppingListData>;
    },
    enabled: !!dailyStockId && hasValidIdFormat,
    retry: false,
  });

  if (!dailyStockId || !hasValidIdFormat) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Daily Shopping List</h1>
        <GuardState
          title="Daily Shopping List needs a valid Daily Stock ID"
          description="This page is shift-linked and only works when opened with a valid dailyStockId from Daily Stock records."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Daily Shopping List</h1>
        <p className="text-xs text-slate-600">Loading...</p>
      </div>
    );
  }

  if (error || !data?.stockId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Daily Shopping List</h1>
        <GuardState
          title="Daily Shopping List unavailable"
          description="No linked daily stock was found for this ID. Select a valid record from Daily Stock, then open its list again."
        />
      </div>
    );
  }

  const lines = data.lines || [];
  const grandTotal = data.grandTotal || 0;

  return (
    <div className="p-6 max-w-full">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-slate-900">Daily Shopping List</h1>
        <a
          href={`/api/purchasing-list/${dailyStockId}/csv`}
          download={`daily-shopping-list-${dailyStockId}.csv`}
          className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 rounded-[4px]"
          data-testid="button-download-csv"
        >
          <Download className="h-4 w-4 mr-1" />
          Download CSV
        </a>
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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ShoppingBag, Package, RefreshCw } from "lucide-react";

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
  category: string | null;
};

type ShoppingListResponse = {
  salesId: string | null;
  shiftDate?: string;
  lines: ShoppingListLine[];
  grandTotal: number;
  itemCount: number;
  message?: string;
};

export default function ShoppingList() {
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<ShoppingListResponse>({
    queryKey: ["/api/purchasing-list/latest"],
  });

  const lines = data?.lines || [];
  const grandTotal = data?.grandTotal || 0;
  const itemCount = data?.itemCount || 0;
  const shiftDate = data?.shiftDate;

  const handleDownloadCSV = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/purchasing-list/latest/csv');
      if (!response.ok) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shopping-list-${shiftDate || new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `฿${amount.toLocaleString('en-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Group lines by category
  const groupedByCategory = lines.reduce((acc, line) => {
    const cat = line.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(line);
    return acc;
  }, {} as Record<string, ShoppingListLine[]>);

  // Calculate category totals
  const getCategoryTotal = (items: ShoppingListLine[]) => {
    return items.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xs text-slate-500">Loading shopping list...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-600" />
            Shopping List
          </h1>
          {shiftDate && (
            <p className="text-xs text-slate-500 mt-1">
              From shift: {formatDate(shiftDate)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs"
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadCSV}
            disabled={isDownloading || itemCount === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            data-testid="button-download-csv"
          >
            <Download className="h-4 w-4 mr-1" />
            {isDownloading ? 'Downloading...' : 'Download CSV'}
          </Button>
        </div>
      </div>

      {/* Grand Total Banner */}
      {grandTotal > 0 && (
        <div className="p-4 bg-emerald-50 rounded-[4px] border border-emerald-200">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-medium text-slate-700">Estimated Grand Total</span>
              <span className="text-xs text-slate-500 ml-2">({itemCount} items)</span>
            </div>
            <span className="text-2xl font-bold text-emerald-600" data-testid="text-grand-total">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      )}

      {/* Shopping List Table */}
      <Card className="rounded-[4px] border-slate-200">
        <CardHeader className="pb-2 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" />
            Items to Purchase
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {itemCount === 0 ? (
            <div className="p-8 text-center">
              <ShoppingBag className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No items in shopping list</p>
              <p className="text-xs text-slate-400 mt-1">
                Submit Form 2 (Daily Stock) with purchase quantities to generate a shopping list
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs" data-testid="table-shopping-list">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 uppercase">Item</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 uppercase">Brand</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 uppercase">SKU</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 uppercase">Supplier</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 uppercase">Unit</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-600 uppercase">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 uppercase">Unit Cost</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 uppercase">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedByCategory).map(([category, items]) => (
                    <>
                      {/* Category Header Row */}
                      <tr key={`cat-${category}`} className="bg-slate-100 border-y border-slate-200">
                        <td colSpan={6} className="px-3 py-2 font-semibold text-slate-800">
                          {category}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500 font-medium">Subtotal:</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                          {formatCurrency(getCategoryTotal(items))}
                        </td>
                      </tr>
                      {/* Item Rows */}
                      {items.map((line, idx) => (
                        <tr 
                          key={`${category}-${idx}`} 
                          className="border-b border-slate-100 hover:bg-slate-50"
                          data-testid={`row-item-${line.item.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <td className="px-3 py-2 font-medium text-slate-900">{line.item}</td>
                          <td className="px-3 py-2 text-slate-600">{line.brand || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{line.sku || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{line.supplier || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{line.unitDescription || '-'}</td>
                          <td className="px-3 py-2 text-center font-semibold text-slate-900">{line.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(line.unitCost)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600">{formatCurrency(line.lineTotal)}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                  {/* Grand Total Row */}
                  <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                    <td colSpan={6} className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-right font-bold text-slate-800 uppercase">Grand Total:</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-700 text-sm">
                      {formatCurrency(grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Note */}
      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-[4px] border border-slate-200">
        <strong>Note:</strong> This shopping list is generated from Form 2 (Daily Stock) submissions. 
        All item details and prices come from your Purchasing List. 
        Update prices in the Purchasing List to see updated estimates here.
      </div>
    </div>
  );
}

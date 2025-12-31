/**
 * 🔒 CANONICAL PURCHASING FLOW (READ-ONLY VIEW)
 * purchasing_items → Form 2 → purchasing_shift_items → Shopping List
 *
 * RULES:
 * - This is a READ-ONLY operational view of what to buy
 * - Grouped by Supplier for easy purchasing
 * - NO ordering actions, NO mutations
 * - Export CSV is supplier-friendly
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Package, RefreshCw, Calendar, Truck } from "lucide-react";

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
  stockId?: string;
  shiftDate?: string;
  lines: ShoppingListLine[];
  grandTotal: number;
  itemCount: number;
  message?: string;
  source?: string;
  noData?: boolean;
};

export default function ShoppingList() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Build query URL with optional date parameter
  const queryUrl = selectedDate 
    ? `/api/purchasing-list/latest?date=${selectedDate}` 
    : "/api/purchasing-list/latest";

  const { data, isLoading, refetch, isFetching } = useQuery<ShoppingListResponse>({
    queryKey: ["/api/purchasing-list/latest", selectedDate],
    queryFn: async () => {
      const response = await fetch(queryUrl);
      if (!response.ok) throw new Error('Failed to fetch shopping list');
      return response.json();
    },
  });

  const lines = data?.lines || [];
  const grandTotal = data?.grandTotal || 0;
  const itemCount = data?.itemCount || 0;
  const shiftDate = data?.shiftDate;
  const source = data?.source;
  const noData = data?.noData;
  const message = data?.message;

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

  // Group lines by SUPPLIER (not category) as per PATCH C
  const groupedBySupplier = lines.reduce((acc, line) => {
    const supplier = line.supplier || 'No Supplier';
    if (!acc[supplier]) acc[supplier] = [];
    acc[supplier].push(line);
    return acc;
  }, {} as Record<string, ShoppingListLine[]>);

  // Sort suppliers alphabetically, but put "No Supplier" last
  const sortedSuppliers = Object.keys(groupedBySupplier).sort((a, b) => {
    if (a === 'No Supplier') return 1;
    if (b === 'No Supplier') return -1;
    return a.localeCompare(b);
  });

  // Calculate supplier totals
  const getSupplierTotal = (items: ShoppingListLine[]) => {
    return items.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  const getSupplierItemCount = (items: ShoppingListLine[]) => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
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
          <h1 className="text-2xl font-bold text-slate-900">
            Shopping List
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Grouped by supplier for easy purchasing
            {shiftDate && <span className="ml-2">• Shift: {formatDate(shiftDate)}</span>}
          </p>
          <p className="text-xs text-slate-400">Source: purchasing_shift_items</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs h-9 w-36 rounded-[4px] border-slate-200"
              data-testid="input-date-selector"
            />
          </div>
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
            {isDownloading ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-[4px] border-slate-200 p-3">
          <div className="text-xs text-slate-500">Total Items</div>
          <div className="text-xl font-bold text-slate-900">{itemCount}</div>
        </Card>
        <Card className="rounded-[4px] border-slate-200 p-3">
          <div className="text-xs text-slate-500">Suppliers</div>
          <div className="text-xl font-bold text-slate-900">{sortedSuppliers.length}</div>
        </Card>
        <Card className="rounded-[4px] border-emerald-200 bg-emerald-50 p-3 col-span-2">
          <div className="text-xs text-emerald-700">Estimated Grand Total</div>
          <div className="text-2xl font-bold text-emerald-700" data-testid="text-grand-total">
            {formatCurrency(grandTotal)}
          </div>
        </Card>
      </div>

      {/* No Data Banner - PATCH 8 */}
      {noData && (
        <div className="bg-amber-50 border border-amber-300 rounded-[4px] p-4 text-center" data-testid="banner-no-data">
          <p className="text-sm font-semibold text-amber-800">{message || 'NO PURCHASING DATA FOR THIS DATE'}</p>
          <p className="text-xs text-amber-600 mt-1">
            No purchasing data has been submitted for this date. Submit Daily Stock form to generate a shopping list.
          </p>
        </div>
      )}

      {/* Shopping List by Supplier */}
      {itemCount === 0 && !noData ? (
        <Card className="rounded-[4px] border-slate-200 p-8 text-center">
          <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No items in shopping list</p>
          <p className="text-xs text-slate-400 mt-1">
            Submit Form 2 (Daily Stock) with purchase quantities to generate a shopping list
          </p>
        </Card>
      ) : itemCount > 0 ? (
        <div className="space-y-4">
          {sortedSuppliers.map((supplier) => {
            const items = groupedBySupplier[supplier];
            const supplierTotal = getSupplierTotal(items);
            const supplierQty = getSupplierItemCount(items);
            
            return (
              <Card key={supplier} className="rounded-[4px] border-slate-200 overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Truck className="h-4 w-4 text-emerald-600" />
                      {supplier}
                      <span className="text-xs font-normal text-slate-500">
                        ({items.length} items, {supplierQty} units)
                      </span>
                    </CardTitle>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 mr-2">Subtotal:</span>
                      <span className="text-sm font-bold text-emerald-600">{formatCurrency(supplierTotal)}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs" data-testid={`table-supplier-${supplier.toLowerCase().replace(/\s+/g, '-')}`}>
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-slate-600">Item</th>
                          <th className="px-4 py-2 text-left font-medium text-slate-600">Brand</th>
                          <th className="px-4 py-2 text-left font-medium text-slate-600">SKU</th>
                          <th className="px-4 py-2 text-left font-medium text-slate-600">Order Unit</th>
                          <th className="px-4 py-2 text-center font-medium text-slate-600">Qty</th>
                          <th className="px-4 py-2 text-right font-medium text-slate-600">Unit Cost</th>
                          <th className="px-4 py-2 text-right font-medium text-slate-600">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((line, idx) => (
                          <tr 
                            key={idx} 
                            className="border-b border-slate-50 hover:bg-slate-50"
                            data-testid={`row-item-${line.item.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <td className="px-4 py-2 font-medium text-slate-900">{line.item}</td>
                            <td className="px-4 py-2 text-slate-600">{line.brand || '-'}</td>
                            <td className="px-4 py-2 text-slate-600">{line.sku || '-'}</td>
                            <td className="px-4 py-2 text-slate-600">{line.unitDescription || '-'}</td>
                            <td className="px-4 py-2 text-center font-bold text-slate-900">{line.quantity}</td>
                            <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(line.unitCost)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-emerald-600">{formatCurrency(line.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Grand Total Footer */}
          <Card className="rounded-[4px] border-emerald-300 bg-emerald-50 p-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm font-bold text-emerald-800">GRAND TOTAL</span>
                <span className="text-xs text-emerald-600 ml-2">({itemCount} items from {sortedSuppliers.length} suppliers)</span>
              </div>
              <span className="text-2xl font-bold text-emerald-700">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </Card>
        </div>
      ) : null}

      {/* Info Note */}
      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-[4px] border border-slate-200">
        <strong>Read-Only View:</strong> This shopping list shows what to purchase based on Form 2 submissions. 
        Item details and prices come from the Purchasing List. No ordering actions available - use this as a reference for manual purchasing.
      </div>
    </div>
  );
}

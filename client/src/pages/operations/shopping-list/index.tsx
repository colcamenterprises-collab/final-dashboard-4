// PATCH 1, 3, 4B, 15 — Shopping List with System-Generated Purchases
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Lock } from 'lucide-react';

interface SystemPurchaseItem {
  purchasingItemId: number;
  item: string;
  quantity: number;
  unit: string;
  target: number;
  endOfShift: number;
  unitCost: number;
  lineTotal: number;
  supplier: string;
  source: 'SYSTEM_RULE';
  rule: 'SHIFT_STOCK_TARGET';
}

interface SystemPurchaseResult {
  shiftDate: string;
  stockFormMissing: boolean;
  items: SystemPurchaseItem[];
  totalCost: number;
}

interface ShoppingListLine {
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
}

interface ShoppingListData {
  salesId: string | null;
  stockId: string | null;
  shiftDate: string | null;
  lines: ShoppingListLine[];
  grandTotal: number;
  itemCount: number;
  noData?: boolean;
}

export default function ShoppingListPage() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultDate = yesterday.toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const { data: manualData, isLoading: manualLoading, error: manualError } = useQuery<ShoppingListData>({
    queryKey: ['/api/purchasing-list/latest', selectedDate],
    queryFn: async () => {
      const res = await axios.get(`/api/purchasing-list/latest?date=${selectedDate}`);
      return res.data;
    },
    enabled: !!selectedDate,
  });

  const { data: systemData, isLoading: systemLoading } = useQuery<SystemPurchaseResult>({
    queryKey: ['/api/purchasing-list/system-purchases', selectedDate],
    queryFn: async () => {
      const res = await axios.get(`/api/purchasing-list/system-purchases?date=${selectedDate}`);
      return res.data;
    },
    enabled: !!selectedDate,
  });

  const isLoading = manualLoading || systemLoading;
  const lines = manualData?.lines || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          Shopping List
        </h1>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
              Select Date
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 rounded-[4px] p-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                data-testid="input-date"
              />
              <a
                href={`/api/purchasing-list/latest/csv?date=${selectedDate}`}
                download={`shopping-list-${selectedDate}.csv`}
                className="px-4 py-2 bg-slate-900 text-white rounded-[4px] text-xs font-medium hover:bg-slate-800 inline-flex items-center"
                data-testid="button-download-csv"
              >
                Download CSV
              </a>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="text-center py-8 text-xs text-slate-600 dark:text-slate-400">
            Loading shopping list...
          </div>
        )}

        {manualError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[4px]">
            <div className="text-xs text-red-600 dark:text-red-400">Failed to load shopping list.</div>
          </div>
        )}

        {!isLoading && !manualError && (
          <>
            {systemData?.stockFormMissing && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-[4px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Meat & Rolls Not Calculated
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Daily Stock Form not submitted for {selectedDate}. System-generated purchases unavailable.
                  </div>
                </div>
              </div>
            )}

            {systemData && !systemData.stockFormMissing && systemData.items.length > 0 && (
              <Card className="bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-[4px]">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      System-Generated Purchases
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 text-xs rounded-[4px]">
                      LOCKED
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="space-y-3">
                    {systemData.items.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-[4px]"
                        data-testid={`system-item-${idx}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.item}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              Supplier: {item.supplier}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                              {item.quantity} {item.unit}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {formatCurrency(item.lineTotal)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-700 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500">Target:</span>
                            <span className="ml-1 font-medium text-slate-900 dark:text-white">{item.target} {item.unit}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">End of Shift:</span>
                            <span className="ml-1 font-medium text-slate-900 dark:text-white">{item.endOfShift} {item.unit}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">To Buy:</span>
                            <span className="ml-1 font-bold text-emerald-700 dark:text-emerald-400">{item.quantity} {item.unit}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">System Total:</span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(systemData.totalCost)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {systemData && !systemData.stockFormMissing && systemData.items.length === 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[4px]">
                <div className="text-xs text-slate-600 dark:text-slate-400 text-center">
                  Stock levels meet targets. No system purchases needed.
                </div>
              </div>
            )}

            {lines.length > 0 && (
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px]">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Manual Purchases</span>
                    <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-[4px]">
                      {lines.length} items
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="space-y-2">
                    {lines.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                        data-testid={`manual-item-${idx}`}
                      >
                        <div className="flex-1">
                          <div className="text-xs font-medium text-slate-900 dark:text-white">{item.item}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {item.supplier || 'No supplier'} • {item.unitDescription || item.category || '—'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white">×{item.quantity}</div>
                          <div className="text-xs text-emerald-600">{formatCurrency(item.lineTotal)}</div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Manual Total:</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatCurrency(manualData?.grandTotal || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {manualData?.noData && lines.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500">
                No purchasing data for {selectedDate}.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 🔒 CANONICAL PURCHASING FLOW (VISIBILITY)
 * purchasing_items → Form 2 → purchasing_shift_items → Purchasing Log
 *
 * Navigation cleanup — no logic changes
 * Renamed: "Shift Log" → "Purchasing Log" for label consistency
 *
 * RULES:
 * - Shows ALL purchasing items as rows
 * - Columns = shifts
 * - Values = quantities entered
 * - Visual flags for anomalies (deterministic rules)
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CalendarDays, AlertCircle, Package } from "lucide-react";

type ShiftLogItem = {
  itemId: number;
  itemName: string;
  category: string | null;
  quantities: Record<string, number>;
  totalQty: number;
  avgQty: number;
};

type ShiftLogResponse = {
  items: ShiftLogItem[];
  shifts: { id: string; date: string; }[];
  dateRange: { start: string; end: string };
};

export default function PurchasingShiftLog() {
  const [days, setDays] = useState(7);
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery<ShiftLogResponse>({
    queryKey: ["/api/purchasing-shift-log", days],
    queryFn: async () => {
      const res = await fetch(`/api/purchasing-shift-log?days=${days}`);
      return res.json();
    },
  });

  const items = data?.items || [];
  const shifts = data?.shifts || [];
  const dateRange = data?.dateRange;

  const categories = useMemo(() => {
    return Array.from(new Set(items.map(i => i.category).filter(Boolean)));
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!categoryFilter) return items;
    return items.filter(i => i.category === categoryFilter);
  }, [items, categoryFilter]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const getQuantityFlag = (qty: number, avgQty: number): 'high' | 'zero' | 'normal' => {
    if (qty === 0 && avgQty > 0) return 'zero';
    if (avgQty > 0 && qty > avgQty * 2) return 'high';
    return 'normal';
  };

  const getQuantityClass = (flag: 'high' | 'zero' | 'normal') => {
    switch (flag) {
      case 'high': return 'bg-red-100 text-red-700 font-bold';
      case 'zero': return 'bg-amber-100 text-amber-700';
      default: return 'text-slate-900';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xs text-slate-500">Loading shift log...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-emerald-600" />
            Purchasing Log
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            What did we need, when, and why?
            {dateRange && (
              <span className="ml-2">
                • {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400">Source: purchasing_shift_items</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="text-xs px-3 py-2 border border-slate-200 rounded-[4px] bg-white"
            data-testid="select-days"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3 py-2 border border-slate-200 rounded-[4px] bg-white"
            data-testid="select-category"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat || ''}>{cat}</option>
            ))}
          </select>
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
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-red-100 border border-red-300"></span>
          <span className="text-slate-600">Unusually High</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-amber-100 border border-amber-300"></span>
          <span className="text-slate-600">Zero (normally used)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300"></span>
          <span className="text-slate-600">Normal</span>
        </div>
      </div>

      {/* Shift Log Table */}
      <Card className="rounded-[4px] border-slate-200 overflow-hidden">
        <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" />
            Quantity History
            <span className="text-xs font-normal text-slate-500">
              ({filteredItems.length} items, {shifts.length} shifts)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs" data-testid="table-shift-log">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600 sticky left-0 bg-slate-50 z-10">Item</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Category</th>
                  {shifts.map(shift => (
                    <th key={shift.id} className="px-3 py-2 text-center font-medium text-slate-600 whitespace-nowrap">
                      {formatDate(shift.date)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium text-slate-600 bg-emerald-50">Total</th>
                  <th className="px-3 py-2 text-center font-medium text-slate-600 bg-emerald-50">Avg</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.itemId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900 sticky left-0 bg-white z-10">
                      {item.itemName}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.category || '-'}</td>
                    {shifts.map(shift => {
                      const qty = item.quantities[shift.id] || 0;
                      const flag = getQuantityFlag(qty, item.avgQty);
                      return (
                        <td 
                          key={shift.id} 
                          className={`px-3 py-2 text-center ${getQuantityClass(flag)}`}
                        >
                          {qty > 0 ? qty : '-'}
                          {flag === 'high' && <span className="ml-1" title="Unusually high">🔴</span>}
                          {flag === 'zero' && item.avgQty > 0 && <span className="ml-1" title="Zero when normally used">🟡</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-bold text-emerald-700 bg-emerald-50">
                      {item.totalQty}
                    </td>
                    <td className="px-3 py-2 text-center text-emerald-600 bg-emerald-50">
                      {item.avgQty.toFixed(1)}
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={shifts.length + 4} className="px-3 py-8 text-center text-slate-500">
                      No purchasing data for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info Note */}
      <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-[4px] border border-slate-200">
        <strong>Note:</strong> This log shows all purchasing items and their quantities across shifts.
        Visual flags indicate anomalies: 🔴 unusually high quantities, 🟡 zero when normally used.
      </div>
    </div>
  );
}

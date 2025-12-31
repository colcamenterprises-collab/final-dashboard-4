/**
 * 🔒 CANONICAL PURCHASING FLOW (ANALYTICS)
 * purchasing_items → Form 2 → purchasing_shift_items → Analytics
 *
 * RULES:
 * - Manager-level metrics
 * - Top 10 by spend/quantity
 * - Supplier/Category breakdowns
 * - Time filters: 7/30 days, MTD, custom
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, TrendingUp, Package, Truck, Layers, DollarSign } from "lucide-react";

type TopItem = {
  itemId: number;
  itemName: string;
  category: string | null;
  supplier: string | null;
  totalQty: number;
  totalSpend: number;
  avgDailyQty: number;
};

type BreakdownItem = {
  name: string;
  totalSpend: number;
  totalQty: number;
  itemCount: number;
  percentage: number;
};

type AnalyticsResponse = {
  topBySpend: TopItem[];
  topByQuantity: TopItem[];
  supplierBreakdown: BreakdownItem[];
  categoryBreakdown: BreakdownItem[];
  totalSpend: number;
  totalItems: number;
  dateRange: { start: string; end: string };
  daysInRange: number;
};

export default function PurchasingAnalytics() {
  const [period, setPeriod] = useState<'7' | '30' | 'mtd' | 'custom'>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery<AnalyticsResponse>({
    queryKey: ["/api/purchasing-analytics", period, customStart, customEnd],
    queryFn: async () => {
      let url = `/api/purchasing-analytics?period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&start=${customStart}&end=${customEnd}`;
      }
      const res = await fetch(url);
      return res.json();
    },
  });

  const topBySpend = data?.topBySpend || [];
  const topByQuantity = data?.topByQuantity || [];
  const supplierBreakdown = data?.supplierBreakdown || [];
  const categoryBreakdown = data?.categoryBreakdown || [];
  const totalSpend = data?.totalSpend || 0;
  const totalItems = data?.totalItems || 0;
  const dateRange = data?.dateRange;
  const daysInRange = data?.daysInRange || 1;

  const formatCurrency = (amount: number) => {
    return `฿${amount.toLocaleString('en-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-xs text-slate-500">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Purchasing Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manager-level spend and usage metrics
            {dateRange && (
              <span className="ml-2">• {formatDate(dateRange.start)} - {formatDate(dateRange.end)}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="text-xs px-3 py-2 border border-slate-200 rounded-[4px] bg-white"
            data-testid="select-period"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="mtd">Month to Date</option>
            <option value="custom">Custom Range</option>
          </select>
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded-[4px]"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded-[4px]"
              />
            </>
          )}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-[4px] border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-slate-500">Total Spend</span>
          </div>
          <div className="text-xl font-bold text-slate-900" data-testid="text-total-spend">
            {formatCurrency(totalSpend)}
          </div>
        </Card>
        <Card className="rounded-[4px] border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-slate-500">Items Purchased</span>
          </div>
          <div className="text-xl font-bold text-slate-900">{totalItems}</div>
        </Card>
        <Card className="rounded-[4px] border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-slate-500">Avg Daily Spend</span>
          </div>
          <div className="text-xl font-bold text-slate-900">
            {formatCurrency(totalSpend / daysInRange)}
          </div>
        </Card>
        <Card className="rounded-[4px] border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-slate-500">Suppliers</span>
          </div>
          <div className="text-xl font-bold text-slate-900">{supplierBreakdown.length}</div>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="spend" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="spend" className="text-xs">Top Spend</TabsTrigger>
          <TabsTrigger value="quantity" className="text-xs">Top Quantity</TabsTrigger>
          <TabsTrigger value="supplier" className="text-xs">By Supplier</TabsTrigger>
          <TabsTrigger value="category" className="text-xs">By Category</TabsTrigger>
        </TabsList>

        <TabsContent value="spend">
          <Card className="rounded-[4px] border-slate-200">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Top 10 Items by Spend
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="min-w-full text-xs" data-testid="table-top-spend">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">#</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Item</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Supplier</th>
                    <th className="px-4 py-2 text-center font-medium text-slate-600">Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Total Spend</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Avg/Day</th>
                  </tr>
                </thead>
                <tbody>
                  {topBySpend.map((item, idx) => (
                    <tr key={item.itemId} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{item.itemName}</td>
                      <td className="px-4 py-2 text-slate-600">{item.supplier || '-'}</td>
                      <td className="px-4 py-2 text-center text-slate-900">{item.totalQty}</td>
                      <td className="px-4 py-2 text-right font-bold text-emerald-600">{formatCurrency(item.totalSpend)}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{item.avgDailyQty.toFixed(1)}</td>
                    </tr>
                  ))}
                  {topBySpend.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No data available for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quantity">
          <Card className="rounded-[4px] border-slate-200">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Top 10 Items by Quantity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="min-w-full text-xs" data-testid="table-top-quantity">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">#</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Item</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Category</th>
                    <th className="px-4 py-2 text-center font-medium text-slate-600">Total Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Spend</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Avg/Day</th>
                  </tr>
                </thead>
                <tbody>
                  {topByQuantity.map((item, idx) => (
                    <tr key={item.itemId} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{item.itemName}</td>
                      <td className="px-4 py-2 text-slate-600">{item.category || '-'}</td>
                      <td className="px-4 py-2 text-center font-bold text-emerald-600">{item.totalQty}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(item.totalSpend)}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{item.avgDailyQty.toFixed(1)}</td>
                    </tr>
                  ))}
                  {topByQuantity.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No data available for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplier">
          <Card className="rounded-[4px] border-slate-200">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Spend by Supplier
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="min-w-full text-xs" data-testid="table-supplier-breakdown">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Supplier</th>
                    <th className="px-4 py-2 text-center font-medium text-slate-600">Items</th>
                    <th className="px-4 py-2 text-center font-medium text-slate-600">Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Spend</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierBreakdown.map((item) => (
                    <tr key={item.name} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{item.itemCount}</td>
                      <td className="px-4 py-2 text-center text-slate-900">{item.totalQty}</td>
                      <td className="px-4 py-2 text-right font-bold text-emerald-600">{formatCurrency(item.totalSpend)}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{item.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category">
          <Card className="rounded-[4px] border-slate-200">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Spend by Category
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="min-w-full text-xs" data-testid="table-category-breakdown">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Category</th>
                    <th className="px-4 py-2 text-center font-medium text-slate-600">Items</th>
                    <th className="px-4 py-2 text-center font-medium text-slate-600">Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Spend</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown.map((item) => (
                    <tr key={item.name} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{item.name}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{item.itemCount}</td>
                      <td className="px-4 py-2 text-center text-slate-900">{item.totalQty}</td>
                      <td className="px-4 py-2 text-right font-bold text-emerald-600">{formatCurrency(item.totalSpend)}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{item.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

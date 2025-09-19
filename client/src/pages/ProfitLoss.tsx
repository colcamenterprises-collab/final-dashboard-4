import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PLData {
  sales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

interface PLResponse {
  success: boolean;
  year: number;
  monthlyData: Record<string, PLData>;
  ytdTotals: PLData;
  dataSource: {
    salesRecords: number;
    loyverseRecords: number;
    expenseRecords: number;
  };
}

export default function ProfitLoss() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  
  // Fetch P&L data
  const { data: plData, isLoading, error } = useQuery<PLResponse>({
    queryKey: ['/api/profit-loss', selectedYear],
    queryFn: async () => {
      return await apiRequest(`/api/profit-loss?year=${selectedYear}`);
    }
  });

  // Format currency values
  const formatCurrency = (amount: number) => {
    if (amount === 0) return "0";
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('THB', '฿');
  };

  // Get value for specific row and month
  const getValue = (rowType: string, month: string): number => {
    if (!plData?.monthlyData?.[month]) return 0;
    
    const monthData = plData.monthlyData[month];
    switch (rowType) {
      case 'Sales': return monthData.sales;
      case 'COGS': return monthData.cogs;
      case 'Gross Profit': return monthData.grossProfit;
      case 'Expenses': return monthData.expenses;
      case 'Net Profit': return monthData.netProfit;
      default: return 0;
    }
  };

  // Get YTD value for specific row
  const getYTDValue = (rowType: string): number => {
    if (!plData?.ytdTotals) return 0;
    
    switch (rowType) {
      case 'Sales': return plData.ytdTotals.sales;
      case 'COGS': return plData.ytdTotals.cogs;
      case 'Gross Profit': return plData.ytdTotals.grossProfit;
      case 'Expenses': return plData.ytdTotals.expenses;
      case 'Net Profit': return plData.ytdTotals.netProfit;
      default: return 0;
    }
  };

  // Get row styling based on type and value
  const getRowStyling = (rowType: string, value: number) => {
    const baseClass = "p-2 text-right";
    
    if (rowType === 'Net Profit') {
      return value >= 0 
        ? `${baseClass} text-green-600 font-semibold`
        : `${baseClass} text-red-600 font-semibold`;
    }
    
    if (rowType === 'Gross Profit') {
      return value >= 0
        ? `${baseClass} text-green-600`
        : `${baseClass} text-red-600`;
    }
    
    return baseClass;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold mb-2 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Profit & Loss
          </h1>
          <p className="text-neutral-600">
            Real-time P&L reporting from restaurant operations data
          </p>
        </div>
        
        {/* Year Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="year-select" className="text-sm font-medium">Year:</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            data-testid="year-selector"
          >
            {[2023, 2024, 2025].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Source Information */}
      {plData && (
        <div className="mb-4 text-xs text-gray-500 flex items-center gap-4">
          <span>Sources: {plData.dataSource.salesRecords} sales records</span>
          <span>•</span>
          <span>{plData.dataSource.loyverseRecords} POS records</span>
          <span>•</span>
          <span>{plData.dataSource.expenseRecords} expense records</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-2xl border bg-white p-8 shadow-sm flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading P&L data...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border bg-red-50 border-red-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Error loading P&L data</span>
          </div>
          <p className="text-red-600 text-sm">
            {error instanceof Error ? error.message : 'Failed to load financial data'}
          </p>
        </div>
      )}

      {/* P&L Table */}
      {plData && !isLoading && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm overflow-x-auto">
          <table className="min-w-[800px] w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 font-semibold">Account</th>
                {months.map(m => (
                  <th key={m} className="text-right p-2 font-semibold text-gray-700">{m}</th>
                ))}
                <th className="text-right p-2 font-semibold text-gray-900">YTD</th>
              </tr>
            </thead>
            <tbody>
              {["Sales","COGS","Gross Profit","Expenses","Net Profit"].map(row => {
                const ytdValue = getYTDValue(row);
                return (
                  <tr key={row} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{row}</td>
                    {months.map(m => {
                      const value = getValue(row, m);
                      return (
                        <td key={m} className={getRowStyling(row, value)}>
                          {formatCurrency(value)}
                        </td>
                      );
                    })}
                    <td className={`${getRowStyling(row, ytdValue)} font-bold border-l border-gray-200`}>
                      <div className="flex items-center justify-end gap-1">
                        {row === 'Net Profit' && (
                          ytdValue >= 0 
                            ? <TrendingUp className="w-3 h-3 text-green-600" />
                            : <TrendingDown className="w-3 h-3 text-red-600" />
                        )}
                        {formatCurrency(ytdValue)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
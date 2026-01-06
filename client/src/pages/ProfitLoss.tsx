import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PLMonthData {
  posCash: number;
  posQr: number;
  posOther: number;
  grabGross: number;
  onlineOrdering: number;
  totalRevenue: number;
  foodCogs: number;
  packagingCogs: number;
  totalCogs: number;
  grossProfit: number;
  grabCommission: number;
  grabAds: number;
  shiftWages: number;
  overtime: number;
  bonuses: number;
  rent: number;
  utilities: number;
  maintenance: number;
  cleaning: number;
  otherBusiness: number;
  totalOpex: number;
  operatingIncome: number;
  bankFees: number;
  interest: number;
  adjustments: number;
  incomeTax: number;
  netIncome: number;
}

interface PLResponse {
  success: boolean;
  year: number;
  monthlyData: Record<string, PLMonthData>;
  ytdTotals: PLMonthData;
  dataSource: {
    salesRecords: number;
    loyverseRecords: number;
    expenseRecords: number;
  };
}

interface YearsResponse {
  ok: boolean;
  years: number[];
}

export default function ProfitLoss() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const { data: yearsData } = useQuery<YearsResponse>({
    queryKey: ['/api/pnl/years'],
    queryFn: async () => apiRequest('/api/pnl/years'),
  });

  useEffect(() => {
    if (yearsData?.years?.length && selectedYear === null) {
      setSelectedYear(yearsData.years[0]);
    }
  }, [yearsData, selectedYear]);

  const { data: plData, isLoading, error } = useQuery<PLResponse>({
    queryKey: ['/api/pnl/year', selectedYear],
    queryFn: async () => apiRequest(`/api/pnl/year?year=${selectedYear}`),
    enabled: selectedYear !== null,
  });

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "0";
    const formatted = new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
    return amount < 0 ? `-฿${formatted}` : `฿${formatted}`;
  };

  const getValue = (data: PLMonthData | undefined, key: keyof PLMonthData): number => {
    if (!data) return 0;
    return data[key] || 0;
  };

  const getCellStyle = (value: number, isTotal: boolean = false, isSummary: boolean = false) => {
    const base = "p-2 text-right text-xs";
    const fontWeight = isTotal || isSummary ? "font-semibold" : "";
    const color = value < 0 ? "text-red-600" : value > 0 && isSummary ? "text-green-600" : "";
    return `${base} ${fontWeight} ${color}`.trim();
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <tr className="bg-slate-100">
      <td colSpan={14} className="p-2 font-semibold text-xs text-slate-700 uppercase tracking-wide">
        {title}
      </td>
    </tr>
  );

  const DataRow = ({ 
    label, 
    dataKey, 
    indent = false, 
    isTotal = false,
    isSummary = false 
  }: { 
    label: string; 
    dataKey: keyof PLMonthData; 
    indent?: boolean;
    isTotal?: boolean;
    isSummary?: boolean;
  }) => (
    <tr className={`border-t border-slate-100 ${isTotal ? 'bg-slate-50' : ''} ${isSummary ? 'bg-slate-100' : ''}`}>
      <td className={`p-2 text-xs ${indent ? 'pl-6' : ''} ${isTotal || isSummary ? 'font-semibold' : ''}`}>
        {label}
      </td>
      {months.map(m => {
        const value = getValue(plData?.monthlyData?.[m], dataKey);
        return (
          <td key={m} className={getCellStyle(value, isTotal, isSummary)}>
            {formatCurrency(value)}
          </td>
        );
      })}
      <td className={`${getCellStyle(getValue(plData?.ytdTotals, dataKey), isTotal, isSummary)} border-l border-slate-200`}>
        {formatCurrency(getValue(plData?.ytdTotals, dataKey))}
      </td>
    </tr>
  );

  const availableYears = yearsData?.years || [new Date().getFullYear()];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" data-testid="pnl-title">
            Profit & Loss Statement
          </h1>
          <p className="text-sm text-slate-600">
            Financial Year {selectedYear}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="year-select" className="text-sm font-medium text-slate-700">Year:</label>
          <select
            id="year-select"
            value={selectedYear || ''}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
            data-testid="year-selector"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {plData && (
        <div className="mb-4 text-xs text-slate-500 flex items-center gap-4">
          <span>Data: {plData.dataSource.salesRecords} sales records</span>
          <span>•</span>
          <span>{plData.dataSource.loyverseRecords} POS records</span>
          <span>•</span>
          <span>{plData.dataSource.expenseRecords} expense records</span>
        </div>
      )}

      {isLoading && (
        <div className="rounded border bg-white p-8 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading financial data...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded border bg-white border-red-200 p-6">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Error loading P&L data</span>
          </div>
          <p className="text-red-600 text-sm">
            {error instanceof Error ? error.message : 'Failed to load financial data'}
          </p>
        </div>
      )}

      {plData && !isLoading && (
        <div className="rounded border bg-white overflow-x-auto">
          <table className="w-full text-sm" data-testid="pnl-table">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left p-2 font-semibold text-slate-900 min-w-[200px]">Account</th>
                {months.map(m => (
                  <th key={m} className="text-right p-2 font-semibold text-slate-700 min-w-[70px]">{m}</th>
                ))}
                <th className="text-right p-2 font-semibold text-slate-900 min-w-[90px] border-l border-slate-200">YTD</th>
              </tr>
            </thead>
            <tbody>
              <SectionHeader title="Revenue" />
              <DataRow label="POS Cash" dataKey="posCash" indent />
              <DataRow label="POS QR" dataKey="posQr" indent />
              <DataRow label="POS Other" dataKey="posOther" indent />
              <DataRow label="Grab Gross Sales" dataKey="grabGross" indent />
              <DataRow label="Online Ordering" dataKey="onlineOrdering" indent />
              <DataRow label="Total Revenue" dataKey="totalRevenue" isTotal />

              <SectionHeader title="Cost of Goods Sold" />
              <DataRow label="Food COGS" dataKey="foodCogs" indent />
              <DataRow label="Packaging COGS" dataKey="packagingCogs" indent />
              <DataRow label="Total COGS" dataKey="totalCogs" isTotal />

              <DataRow label="Gross Profit" dataKey="grossProfit" isSummary />

              <SectionHeader title="Operating Expenses" />
              
              <tr className="border-t border-slate-100">
                <td colSpan={14} className="p-1 pl-4 text-xs text-slate-500 italic">Platform & Sales</td>
              </tr>
              <DataRow label="Grab Commission" dataKey="grabCommission" indent />
              <DataRow label="Grab Advertising" dataKey="grabAds" indent />

              <tr className="border-t border-slate-100">
                <td colSpan={14} className="p-1 pl-4 text-xs text-slate-500 italic">Staff & Shifts</td>
              </tr>
              <DataRow label="Shift Wages" dataKey="shiftWages" indent />
              <DataRow label="Overtime" dataKey="overtime" indent />
              <DataRow label="Bonuses" dataKey="bonuses" indent />

              <tr className="border-t border-slate-100">
                <td colSpan={14} className="p-1 pl-4 text-xs text-slate-500 italic">Store Operations</td>
              </tr>
              <DataRow label="Rent" dataKey="rent" indent />
              <DataRow label="Utilities" dataKey="utilities" indent />
              <DataRow label="Maintenance" dataKey="maintenance" indent />
              <DataRow label="Cleaning" dataKey="cleaning" indent />
              <DataRow label="Other Business Expenses" dataKey="otherBusiness" indent />

              <DataRow label="Total Operating Expenses" dataKey="totalOpex" isTotal />

              <DataRow label="Operating Income (EBIT)" dataKey="operatingIncome" isSummary />

              <SectionHeader title="Non-Operating Items" />
              <DataRow label="Bank Fees" dataKey="bankFees" indent />
              <DataRow label="Interest" dataKey="interest" indent />
              <DataRow label="Adjustments" dataKey="adjustments" indent />

              <DataRow label="Income Tax" dataKey="incomeTax" isTotal />

              <tr className="border-t-2 border-slate-300 bg-slate-100">
                <td className="p-3 font-bold text-sm">Net Income</td>
                {months.map(m => {
                  const value = getValue(plData?.monthlyData?.[m], 'netIncome');
                  return (
                    <td key={m} className={`p-3 text-right font-bold text-sm ${value < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(value)}
                    </td>
                  );
                })}
                <td className={`p-3 text-right font-bold text-sm border-l border-slate-300 ${getValue(plData?.ytdTotals, 'netIncome') < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(getValue(plData?.ytdTotals, 'netIncome'))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {plData && (
        <div className="mt-4 text-xs text-slate-400">
          Data sourced exclusively from P&L read model. No legacy aggregation.
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Calculator } from "lucide-react";

interface FinanceSummary {
  sales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  primeCostPct: number;
  foodCostPct: number;
  laborPct: number;
  occupancyPct: number;
  netMarginPct: number;
}

const formatTHB = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB'
  }).format(amount);
};

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/finance/summary');
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching finance data:', error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const triggerCalculation = async () => {
    try {
      setCalculating(true);
      const response = await fetch('/api/finance/calculate', { method: 'POST' });
      if (response.ok) {
        // Refresh data after calculation
        await fetchFinanceData();
      }
    } catch (error) {
      console.error('Error triggering calculation:', error);
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!summary || Object.keys(summary).length === 0) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
          <div className="flex space-x-2">
            <Button
              onClick={triggerCalculation}
              disabled={calculating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Calculator className="mr-2 h-4 w-4" />
              {calculating ? "Calculating..." : "Calculate Finance"}
            </Button>
            <Button
              onClick={fetchFinanceData}
              variant="outline"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500 mb-4">No finance data available.</p>
            <p className="text-sm text-gray-400">
              Please submit a daily sales form or click "Calculate Finance" to generate financial metrics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
        <div className="flex space-x-2">
          <Button
            onClick={triggerCalculation}
            disabled={calculating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Calculator className="mr-2 h-4 w-4" />
            {calculating ? "Calculating..." : "Recalculate"}
          </Button>
          <Button
            onClick={fetchFinanceData}
            variant="outline"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatTHB(summary.sales)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Gross Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{formatTHB(summary.grossProfit)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatTHB(summary.netProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Ratios */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Financial Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-500">Prime Cost</p>
              <p className="text-xl font-semibold">{summary.primeCostPct}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Food Cost</p>
              <p className="text-xl font-semibold">{summary.foodCostPct}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Labor</p>
              <p className="text-xl font-semibold">{summary.laborPct}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Occupancy</p>
              <p className="text-xl font-semibold">{summary.occupancyPct}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Net Margin</p>
              <p className={`text-xl font-semibold ${summary.netMarginPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.netMarginPct}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit & Loss Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <tbody className="space-y-2">
                <tr className="border-b">
                  <td className="py-2 font-medium">Sales Revenue</td>
                  <td className="py-2 text-right font-mono">{formatTHB(summary.sales)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Cost of Goods Sold (COGS)</td>
                  <td className="py-2 text-right font-mono text-red-600">({formatTHB(summary.cogs)})</td>
                </tr>
                <tr className="border-b bg-blue-50">
                  <td className="py-2 font-semibold">Gross Profit</td>
                  <td className="py-2 text-right font-mono font-semibold">{formatTHB(summary.grossProfit)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pl-4">Operating Expenses</td>
                  <td className="py-2 text-right font-mono text-red-600">({formatTHB(summary.expenses)})</td>
                </tr>
                <tr className={`border-b ${summary.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <td className="py-2 font-bold">Net Profit</td>
                  <td className={`py-2 text-right font-mono font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatTHB(summary.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
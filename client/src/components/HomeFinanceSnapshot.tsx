import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, DollarSign } from "lucide-react";

interface FinanceSummary {
  sales: number;
  netProfit: number;
  primeCostPct: number;
  topItem?: string;
  varianceAlert?: string;
}

const formatTHB = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB'
  }).format(amount);
};

export default function HomeFinanceSnapshot() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSnapshot = async () => {
      try {
        const response = await fetch('/api/finance/summary/today');
        const data = await response.json();
        setSummary(data);
      } catch (error) {
        console.error('Error fetching finance snapshot:', error);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshot();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5" />
            Finance Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary || Object.keys(summary).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5" />
            Finance Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">
            No finance data available. Submit a daily sales form to see financial metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="mr-2 h-5 w-5" />
          Finance Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Sales Today:</span>
          <span className="font-semibold text-green-600">{formatTHB(summary.sales)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Net Profit:</span>
          <span className={`font-semibold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatTHB(summary.netProfit)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Prime Cost:</span>
          <span className={`font-semibold ${summary.primeCostPct <= 60 ? 'text-green-600' : summary.primeCostPct <= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
            {summary.primeCostPct}%
          </span>
        </div>
        
        {summary.topItem && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Top Item:</span>
            <span className="font-semibold text-blue-600">{summary.topItem}</span>
          </div>
        )}
        
        {summary.varianceAlert && (
          <div className="flex items-start space-x-2 p-2 bg-red-50 rounded-md">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-red-700">{summary.varianceAlert}</span>
          </div>
        )}
        
        {!summary.varianceAlert && summary.sales > 0 && (
          <div className="text-xs text-gray-500 pt-2 border-t">
            Financial data from latest shift
          </div>
        )}
      </CardContent>
    </Card>
  );
}
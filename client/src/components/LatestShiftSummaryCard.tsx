import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Receipt, ShoppingCart, Coffee, Utensils, Download } from "lucide-react";
import { format } from "date-fns";

interface LatestShiftSummary {
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  firstReceipt: string;
  lastReceipt: string;
  totalReceipts: number;
  grossSales: number;
  netSales: number;
  paymentBreakdown: Record<string, { count: number; amount: number }>;
  itemsSold: Record<string, { quantity: number; total: number }>;
  drinkQuantities: Record<string, number>;
  burgerRollsUsed: number;
  meatUsedKg: number;
  modifiersSold: Record<string, { count: number; total: number }>;
  refunds: Array<{
    receiptNumber: string;
    amount: number;
    date: string;
  }>;
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null || isNaN(amount)) {
    return "฿0.00";
  }
  return `฿${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export default function LatestShiftSummaryCard() {
  const { data: shiftSummary, isLoading, refetch } = useQuery<LatestShiftSummary>({
    queryKey: ['/api/receipts/jussi-summary/latest'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const downloadCSVReport = async () => {
    try {
      const response = await fetch('/api/receipts/export/csv');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shift-summary-${shiftSummary?.shiftDate || 'latest'}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Latest Shift Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">Loading shift data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!shiftSummary) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Latest Shift Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">No shift data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topPaymentMethods = Object.entries(shiftSummary.paymentBreakdown)
    .sort(([,a], [,b]) => b.amount - a.amount)
    .slice(0, 3);

  const totalDrinks = Object.values(shiftSummary.drinkQuantities).reduce((sum, qty) => sum + qty, 0);

  return (
    <Card className="h-full border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-blue-600" />
            Latest Shift Summary
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            Live Data
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="h-4 w-4" />
          {format(new Date(shiftSummary.shiftDate), 'MMM dd, yyyy')}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-700">{formatCurrency(shiftSummary.netSales)}</div>
            <div className="text-xs text-green-600">Net Sales</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-lg font-bold text-blue-700">{shiftSummary.totalReceipts}</div>
            <div className="text-xs text-blue-600">Orders</div>
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="flex items-center justify-center gap-1">
              <Utensils className="h-3 w-3 text-orange-600" />
              <span className="text-sm font-semibold">{shiftSummary.burgerRollsUsed}</span>
            </div>
            <div className="text-xs text-gray-500">Rolls</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <Coffee className="h-3 w-3 text-purple-600" />
              <span className="text-sm font-semibold">{totalDrinks}</span>
            </div>
            <div className="text-xs text-gray-500">Drinks</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <ShoppingCart className="h-3 w-3 text-red-600" />
              <span className="text-sm font-semibold">{shiftSummary.meatUsedKg.toFixed(1)}kg</span>
            </div>
            <div className="text-xs text-gray-500">Meat</div>
          </div>
        </div>

        {/* Payment Methods */}
        <div>
          <div className="text-sm font-medium mb-2">Top Payment Methods</div>
          <div className="space-y-1">
            {topPaymentMethods.map(([method, data]) => (
              <div key={method} className="flex justify-between items-center text-xs">
                <span>{method}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {data.count}
                  </Badge>
                  <span className="font-medium">{formatCurrency(data.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button 
            onClick={downloadCSVReport}
            size="sm"
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            <Download className="h-3 w-3 mr-1" />
            Export Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
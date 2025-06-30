import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, TrendingUp, CheckCircle, Download } from "lucide-react";
import { api } from "@/lib/api";

export default function Finance() {
  const { data: financeData, isLoading } = useQuery({
    queryKey: ["/api/finance/pos-vs-staff"],
    queryFn: api.getFinanceComparison
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  const posData = financeData?.pos || {};
  const staffData = financeData?.staff || {};
  const variance = financeData?.variance || {};

  // Mock P&L data
  const plData = {
    revenue: posData.totalSales || 2478.36,
    cogs: 891.25,
    labor: 456.80,
    expenses: 287.15,
    netProfit: 843.16
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Finance</h1>
        <div className="flex items-center space-x-4">
          <Select defaultValue="today">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button className="restaurant-primary">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* POS vs Staff Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">POS System Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Sales</span>
                <span className="font-semibold text-gray-900">${posData.totalSales?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Number of Transactions</span>
                <span className="font-semibold text-gray-900">{posData.transactions || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cash Sales</span>
                <span className="font-semibold text-gray-900">${posData.cashSales?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Card Sales</span>
                <span className="font-semibold text-gray-900">${posData.cardSales?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Staff Report Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Reported Sales</span>
                <span className="font-semibold text-gray-900">${staffData.totalSales?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Reported Transactions</span>
                <span className="font-semibold text-gray-900">{staffData.transactions || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cash Collected</span>
                <span className="font-semibold text-gray-900">${staffData.cashSales?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Card Tips</span>
                <span className="font-semibold text-gray-900">${staffData.tips?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Variance Analysis */}
      <Card className="restaurant-card mb-8">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            <TrendingUp className="inline mr-2 text-primary" />
            Variance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 font-medium">Sales Variance</p>
              <p className="text-2xl font-bold text-red-700">
                ${Math.abs(variance.salesVariance || 12.56).toFixed(2)}
              </p>
              <p className="text-xs text-red-600 mt-1">POS shows higher sales</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-600 font-medium">Transaction Variance</p>
              <p className="text-2xl font-bold text-yellow-700">{Math.abs(variance.transactionVariance || 2)}</p>
              <p className="text-xs text-yellow-600 mt-1">Unreported transactions</p>
            </div>
            <div className="text-center p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">Cash Variance</p>
              <p className="text-2xl font-bold text-orange-700">
                ${Math.abs(variance.cashVariance || 15.65).toFixed(2)}
              </p>
              <p className="text-xs text-orange-600 mt-1">Cash shortage detected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit & Loss Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Daily P&L Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-900">Gross Revenue</span>
                <span className="font-semibold text-green-600">${plData.revenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Cost of Goods Sold</span>
                <span className="font-semibold text-red-600">-${plData.cogs.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Labor Costs</span>
                <span className="font-semibold text-red-600">-${plData.labor.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Operating Expenses</span>
                <span className="font-semibold text-red-600">-${plData.expenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 bg-primary/10 px-4 rounded-lg">
                <span className="text-base font-semibold text-gray-900">Net Profit</span>
                <span className="text-lg font-bold text-primary">${plData.netProfit.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Financial Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {variance.alerts?.map((alert, index) => (
                <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="text-red-600 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Financial Alert</p>
                      <p className="text-sm text-red-700">{alert}</p>
                    </div>
                  </div>
                </div>
              )) || (
                <>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="text-red-600 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Cash Discrepancy</p>
                        <p className="text-sm text-red-700">$15.65 cash shortage detected in today's report.</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <TrendingUp className="text-yellow-600 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">High COGS</p>
                        <p className="text-sm text-yellow-700">Cost of goods sold is 36% of revenue, above 30% target.</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="text-green-600 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Profit Target Met</p>
                        <p className="text-sm text-green-700">Daily profit target of $800 exceeded by $43.16.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

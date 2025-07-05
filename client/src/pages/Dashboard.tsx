import { useQuery } from "@tanstack/react-query";
import { DollarSign, ShoppingCart, Package, AlertTriangle, TrendingUp, Clock, CreditCard, Truck, CheckCircle, Bot, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import KPICard from "@/components/KPICard";
import SalesChart from "@/components/SalesChart";
import ShiftBalanceSummary from "@/components/ShiftBalanceSummary";
import SalesByPaymentType from "@/components/SalesByPaymentType";

import { api, mutations } from "@/lib/api";
import { useRealTimeData } from "@/hooks/useRealTimeData";
import { useMutation } from "@tanstack/react-query";
import restaurantHubLogo from "@assets/Restuarant Hub (2)_1751479657885.png";

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["/api/dashboard/kpis"],
    queryFn: api.getDashboardKPIs
  });

  const { data: topMenuItems, isLoading: topMenuItemsLoading, error: topMenuItemsError } = useQuery({
    queryKey: ["/api/dashboard/top-menu-items"],
    queryFn: api.getTopMenuItems
  });

  const { data: recentTransactions } = useRealTimeData(
    ["/api/dashboard/recent-transactions"],
    api.getRecentTransactions,
    30000
  );

  const { data: aiInsights } = useRealTimeData(
    ["/api/dashboard/ai-insights"],
    api.getAiInsights,
    10000
  );

  const { data: mtdExpenses } = useQuery<{ total: number }>({
    queryKey: ["/api/expenses/month-to-date"],
  });

  // Add Loyverse status query
  const { data: status } = useQuery<{ connected: boolean; message: string }>({
    queryKey: ["/api/loyverse/live/status"],
    refetchInterval: 10000, // Check every 10 seconds
  });

  const resolveInsightMutation = useMutation({
    mutationFn: mutations.resolveAiInsight
  });

  const handleResolveInsight = (id: number) => {
    resolveInsightMutation.mutate(id);
  };

  if (kpisLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="relative">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Restaurant Operations Hub</h1>
        <div className="flex flex-col xs:flex-row items-start xs:items-center space-y-2 xs:space-y-0 xs:space-x-4">
          <Select defaultValue="7days">
            <SelectTrigger className="w-full xs:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="3months">Last 3 months</SelectItem>
            </SelectContent>
          </Select>
          <Button className="restaurant-primary w-full xs:w-auto">
            <Bot className="mr-2 h-4 w-4" />
            <span className="hidden xs:inline">AI Analysis</span>
            <span className="xs:hidden">AI</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          title="Last Shift Sales"
          value={`฿${kpis?.lastShiftSales?.toLocaleString() || '0'}`}
          change={`${kpis?.shiftDate || 'Last'} Shift Net Sales`}
          changeType="positive"
          icon={DollarSign}
          iconColor="text-primary"
          iconBgColor="bg-primary/20"
        />
        <KPICard
          title="Orders Completed Last Shift"
          value={kpis?.lastShiftOrders || 0}
          change={`${kpis?.shiftDate || 'Last'} Shift`}
          changeType="positive"
          icon={ShoppingCart}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <KPICard
          title="Loyverse POS"
          value={status?.connected ? "Connected" : "Disconnected"}
          change={status?.connected ? "Live Sync Active" : "Connection Failed"}
          changeType={status?.connected ? "positive" : "negative"}
          icon={Wifi}
          iconColor={status?.connected ? "text-green-600" : "text-red-600"}
          iconBgColor={status?.connected ? "bg-green-100" : "bg-red-100"}
        />
        <KPICard
          title="MTD Expenses"
          value={`฿${mtdExpenses?.total?.toLocaleString() || '0'}`}
          change="This Month"
          changeType="neutral"
          icon={CreditCard}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-100"
        />
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-6 lg:mb-8">
        {/* Sales Chart */}
        <div className="lg:col-span-2">
          <SalesChart />
        </div>

        {/* Top Sales Items */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Top Sales Items</CardTitle>
            <p className="text-sm text-gray-500 mt-1">July 2025</p>
          </CardHeader>
          <CardContent>
            {topMenuItemsError ? (
              <div className="text-center py-8">
                <div className="text-red-500 text-sm font-medium mb-2">Loyverse Connection Error</div>
                <div className="text-gray-600 text-xs">Unable to connect to Loyverse POS system. Please check your API credentials.</div>
              </div>
            ) : topMenuItemsLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="flex items-center justify-between animate-pulse">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-gray-200 rounded-full" />
                      <div className="h-4 bg-gray-200 rounded w-32" />
                    </div>
                    <div className="text-right space-y-1">
                      <div className="h-4 bg-gray-200 rounded w-16" />
                      <div className="h-3 bg-gray-200 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topMenuItems && topMenuItems.length > 0 ? (
              <div className="space-y-4">
                {topMenuItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        index === 0 ? 'bg-primary' : 
                        index === 1 ? 'bg-yellow-400' : 
                        index === 2 ? 'bg-green-400' : 'bg-gray-400'
                      }`} />
                      <div>
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        {item.category && (
                          <div className="text-xs text-gray-500">{item.category}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">${item.sales.toFixed(2)}</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">{item.orders} orders</span>
                        {item.monthlyGrowth && (
                          <span className="text-xs text-green-600 font-medium">{item.monthlyGrowth}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-500 text-sm">No sales data available</div>
                <div className="text-gray-400 text-xs mt-1">Connect to Loyverse to view sales data</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Shift Balance Summary */}
        <ShiftBalanceSummary />
        
        {/* Sales by Payment Type */}
        <SalesByPaymentType />
        
        {/* Recent Transactions */}
        <Card className="restaurant-card">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold text-gray-900">Recent Transactions</CardTitle>
              <Button variant="ghost" className="text-primary hover:text-primary-dark text-sm font-medium">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions?.slice(0, 3).map((transaction, index) => (
                <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      transaction.paymentMethod === 'Credit Card' ? 'bg-green-100' : 
                      transaction.paymentMethod === 'Cash' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      {transaction.paymentMethod === 'Credit Card' ? (
                        <CreditCard className="text-green-600 text-sm" />
                      ) : transaction.paymentMethod === 'Cash' ? (
                        <DollarSign className="text-yellow-600 text-sm" />
                      ) : (
                        <Truck className="text-red-600 text-sm" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{transaction.orderId}</p>
                      <p className="text-xs text-gray-500">
                        {transaction.tableNumber ? `Table ${transaction.tableNumber}` : 'Supplier Payment'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      parseFloat(transaction.amount) > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {parseFloat(transaction.amount) > 0 ? '+' : ''}${Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{transaction.paymentMethod}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Insights */}
        <Card className="restaurant-card">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-semibold text-gray-900">
                <Bot className="inline mr-2 text-primary" />
                AI Insights
              </CardTitle>
              <Badge variant="secondary" className="restaurant-primary text-xs">Live</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiInsights?.slice(0, 3).map((insight) => (
                <div 
                  key={insight.id}
                  className={`p-4 rounded-lg border ${
                    insight.severity === 'high' ? 'bg-red-50 border-red-200' :
                    insight.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {insight.severity === 'high' ? (
                      <AlertTriangle className="text-red-600 mt-1" />
                    ) : insight.severity === 'medium' ? (
                      <AlertTriangle className="text-yellow-600 mt-1" />
                    ) : (
                      <TrendingUp className="text-blue-600 mt-1" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        insight.severity === 'high' ? 'text-red-800' :
                        insight.severity === 'medium' ? 'text-yellow-800' :
                        'text-blue-800'
                      }`}>
                        {insight.title}
                      </p>
                      <p className={`text-sm ${
                        insight.severity === 'high' ? 'text-red-700' :
                        insight.severity === 'medium' ? 'text-yellow-700' :
                        'text-blue-700'
                      }`}>
                        {insight.description}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleResolveInsight(insight.id)}
                        disabled={resolveInsightMutation.isPending}
                      >
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Restaurant Hub Logo and Copyright */}
      <div className="flex flex-col items-end mt-8 mb-4">
        <a 
          href="https://www.customli.io" 
          target="_blank" 
          rel="noopener noreferrer"
          className="block"
        >
          <img 
            src={restaurantHubLogo} 
            alt="Restaurant Hub" 
            className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity mb-2 cursor-pointer"
          />
        </a>
        <p className="text-xs text-gray-500 text-right">
          Copyright 2025 - www.customli.io - Restaurant Marketing & Management
        </p>
      </div>
    </div>
  );
}

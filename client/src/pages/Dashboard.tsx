import { useQuery } from "@tanstack/react-query";
import { DollarSign, ShoppingCart, Package, AlertTriangle, TrendingUp, Clock, CreditCard, Truck, CheckCircle, Bot, Wifi, Zap, Receipt, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import KPICard from "@/components/KPICard";
import MonthlyRevenueChart from "@/components/SalesChart";
import MonthlyExpensesChart from "@/components/MonthlyExpensesChart";
import AIInsightsCard from "@/components/AIInsightsCard";
import ShiftBalanceSummary from "@/components/ShiftBalanceSummary";
import SalesByPaymentType from "@/components/SalesByPaymentType";
import CompactShiftReports from "@/components/CompactShiftReports";
import SalesVsExpensesChart from "@/components/SalesVsExpensesChart";


import { api, mutations } from "@/lib/api";
import { useRealTimeData } from "@/hooks/useRealTimeData";
import { useMutation } from "@tanstack/react-query";
import restaurantHubLogo from "@assets/Restuarant Hub (2)_1751479657885.png";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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

  // Add Recent Receipts query for last 24 hours
  const { data: recentReceipts, isLoading: receiptsLoading } = useQuery({
    queryKey: ["/api/loyverse/receipts", "last24hours"],
    queryFn: () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      return api.getLoyverseReceipts(startDate.toISOString(), endDate.toISOString());
    },
    refetchInterval: 60000, // Refresh every minute
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
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

      {/* Quick Action Buttons - positioned below headline */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-5 w-5 text-gray-700" />
          <span className="text-lg font-semibold text-gray-900">Quick Actions</span>
        </div>
        <div className="flex flex-wrap gap-3 max-w-lg">
          <Link href="/expenses">
            <Button className="h-10 px-6 text-white font-medium" style={{ backgroundColor: '#0F766E' }}>
              <Receipt className="mr-2 h-4 w-4" />
              Submit Expense
            </Button>
          </Link>
          <Link href="/daily-stock-sales">
            <Button className="h-10 px-6 text-white font-medium" style={{ backgroundColor: '#0F766E' }}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Sales & Stock Form
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          title="Last Shift Sales"
          value={`฿${kpis?.lastShiftSales?.toLocaleString() || '0'}`}
          change={`${kpis?.shiftDate || 'Previous'} Shift`}
          changeType="positive"
          icon={DollarSign}
          iconColor="text-primary"
          iconBgColor="bg-primary/20"
        />
        <KPICard
          title="Live Orders Today"
          value={kpis?.liveReceiptCount || 0}
          change="Current Shift Period"
          changeType="positive"
          icon={ShoppingCart}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <KPICard
          title="MTD Sales"
          value={`฿${kpis?.monthToDateSales?.toLocaleString() || '0'}`}
          change="Month to Date"
          changeType="positive"
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
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

      {/* Sales vs Expenses Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Sales vs Expenses Chart (2 columns) */}
        <div className="lg:col-span-2">
          <SalesVsExpensesChart />
        </div>
        
        {/* Third column empty for now */}
        <div className="lg:col-span-1">
          {/* Reserved for future content */}
        </div>
      </div>

      {/* Three-column layout: Revenue Chart | Expenses Chart | Payment Type Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-6 lg:mb-8">
        {/* Column 1: Revenue Chart */}
        <div className="lg:col-span-1">
          <MonthlyRevenueChart />
        </div>

        {/* Column 2: Monthly Expenses Chart */}
        <div className="lg:col-span-1">
          <MonthlyExpensesChart />
        </div>

        {/* Column 3: Payment Type Pie Chart */}
        <div className="lg:col-span-1">
          <SalesByPaymentType />
        </div>
      </div>

      {/* Stock Insights - Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-6 lg:mb-8">
        {/* Bakery Stock Insights */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Bakery Stock Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiInsights?.slice(0, 2).map((insight) => (
                <div 
                  key={insight.id}
                  className={`p-4 rounded-lg border ${
                    insight.severity === 'high' ? 'bg-red-50 border-red-200' :
                    insight.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
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
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Drink Stock Insights */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Drink Stock Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiInsights?.slice(0, 2).map((insight) => (
                <div 
                  key={`drink-${insight.id}`}
                  className={`p-4 rounded-lg border ${
                    insight.severity === 'high' ? 'bg-red-50 border-red-200' :
                    insight.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
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
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Meat Stock Insights */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Meat Stock Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiInsights?.slice(0, 2).map((insight) => (
                <div 
                  key={`meat-${insight.id}`}
                  className={`p-4 rounded-lg border ${
                    insight.severity === 'high' ? 'bg-red-50 border-red-200' :
                    insight.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
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
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights - Full Width */}
      <div className="mb-6 lg:mb-8">
        <AIInsightsCard />
      </div>

      {/* Top Sales Items - Full Width */}
      <div className="mb-6 lg:mb-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Shift Balance Summary */}
        <ShiftBalanceSummary />
        
        {/* Additional space for future components */}
        <div className="space-y-4">
          {/* This space can be used for additional dashboard components */}
        </div>
      </div>

      {/* Stock Insights - Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-6 lg:mb-8">
        {/* Bakery Stock Insights */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Bakery Stock Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiInsights?.slice(0, 2).map((insight) => (
                <div 
                  key={insight.id}
                  className={`p-4 rounded-lg border ${
                    insight.severity === 'high' ? 'bg-red-50 border-red-200' :
                    insight.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
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
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Drink Stock Insights */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Drink Stock Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiInsights?.slice(0, 2).map((insight) => (
                <div 
                  key={`drink-${insight.id}`}
                  className={`p-4 rounded-lg border ${
                    insight.severity === 'high' ? 'bg-red-50 border-red-200' :
                    insight.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
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
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Meat Stock Insights */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Meat Stock Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiInsights?.slice(0, 2).map((insight) => (
                <div 
                  key={`meat-${insight.id}`}
                  className={`p-4 rounded-lg border ${
                    insight.severity === 'high' ? 'bg-red-50 border-red-200' :
                    insight.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
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

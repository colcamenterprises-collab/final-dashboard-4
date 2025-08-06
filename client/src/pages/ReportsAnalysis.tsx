import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, BarChart, DollarSign, Users, Target, PieChart, Calendar,
  ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import { LineChart, Line, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';

// Interfaces for reporting data
interface SalesSummary {
  period: string;
  totalSales: number;
  averageDailySales: number;
  salesByChannel: {
    grab: number;
    aroiDee: number;
    cash: number;
    qrScan: number;
  };
  dailyBreakdown: Array<{
    date: string;
    total: number;
    completedBy: string;
  }>;
}

interface FinancialOverview {
  period: string;
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  profitMargin: number;
  averageDailyRevenue: number;
  averageDailyExpenses: number;
  recentTrends: Array<{
    date: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
}

interface PerformanceMetrics {
  period: string;
  staffPerformance: Record<string, { shifts: number; totalSales: number; avgSales: number }>;
  operationalMetrics: {
    totalShiftsCompleted: number;
    uniqueStaffMembers: number;
    averageShiftSales: number;
    completionRate: string;
  };
}

const ReportsAnalysis = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [reportPeriod, setReportPeriod] = useState("7");

  // Fetch comprehensive reporting data
  const { data: salesSummary, isLoading: isLoadingSales } = useQuery({
    queryKey: ['/api/reports/sales-summary', reportPeriod],
    queryFn: () => fetch(`/api/reports/sales-summary?period=${reportPeriod}`).then(res => res.json())
  });

  const { data: financialOverview, isLoading: isLoadingFinancial } = useQuery({
    queryKey: ['/api/reports/financial-overview', reportPeriod],
    queryFn: () => fetch(`/api/reports/financial-overview?period=${reportPeriod}`).then(res => res.json())
  });

  const { data: performanceMetrics, isLoading: isLoadingPerformance } = useQuery({
    queryKey: ['/api/reports/performance-metrics'],
    queryFn: () => fetch('/api/reports/performance-metrics').then(res => res.json())
  });

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  const formatCurrency = (amount: number) => {
    return `฿${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    if (current < previous) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  // Overview Tab Content
  const OverviewContent = () => {
    if (isLoadingSales || isLoadingFinancial || isLoadingPerformance) {
      return <div className="flex items-center justify-center h-64">Loading comprehensive reports...</div>;
    }

    // Prepare chart data
    const salesChannelData = salesSummary ? [
      { name: 'Grab', value: salesSummary.salesByChannel.grab },
      { name: 'Aroi Dee', value: salesSummary.salesByChannel.aroiDee },
      { name: 'Cash', value: salesSummary.salesByChannel.cash },
      { name: 'QR Scan', value: salesSummary.salesByChannel.qrScan }
    ].filter(item => item.value > 0) : [];

    const dailyTrendsData = financialOverview?.recentTrends?.map(trend => ({
      date: formatDate(trend.date),
      revenue: trend.revenue,
      expenses: trend.expenses,
      profit: trend.profit
    })) || [];

    return (
      <div className="space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(salesSummary?.totalSales || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {salesSummary?.period} average: {formatCurrency(salesSummary?.averageDailySales || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(financialOverview?.grossProfit || 0)}</div>
              <p className="text-xs text-muted-foreground">
                Margin: {financialOverview?.profitMargin?.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shifts Completed</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{performanceMetrics?.operationalMetrics.totalShiftsCompleted || 0}</div>
              <p className="text-xs text-muted-foreground">
                Completion Rate: {performanceMetrics?.operationalMetrics.completionRate}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{performanceMetrics?.operationalMetrics.uniqueStaffMembers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Avg per shift: {formatCurrency(performanceMetrics?.operationalMetrics.averageShiftSales || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Channel Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Channel</CardTitle>
              <CardDescription>Revenue breakdown by sales channel</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <RechartsPieChart data={salesChannelData}>
                    {salesChannelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </RechartsPieChart>
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-4">
                {salesChannelData.map((entry, index) => (
                  <Badge key={entry.name} variant="secondary" className="flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {entry.name}: {formatCurrency(entry.value)}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Daily Trends Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Financial Trends</CardTitle>
              <CardDescription>Daily revenue, expenses, and profit</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis formatter={(value) => `฿${value}`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" stroke="#82ca9d" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="#ffc658" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Staff Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Performance Summary</CardTitle>
            <CardDescription>Performance metrics by staff member</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {performanceMetrics && Object.entries(performanceMetrics.staffPerformance).map(([staff, metrics]) => (
                <div key={staff} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {staff.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{staff}</p>
                      <p className="text-sm text-gray-500">{metrics.shifts} shifts completed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(metrics.totalSales)}</p>
                    <p className="text-sm text-gray-500">Avg: {formatCurrency(metrics.avgSales)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analysis</h1>
            <p className="text-gray-500 mt-1">Comprehensive business intelligence and performance analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={reportPeriod} onValueChange={setReportPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales Analysis</TabsTrigger>
          <TabsTrigger value="financial">Financial Reports</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <OverviewContent />
        </TabsContent>

        <TabsContent value="sales" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Analysis</CardTitle>
              <CardDescription>Detailed sales performance and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Detailed sales analysis coming soon</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("overview")}>
                  View Overview Instead
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Reports</CardTitle>
              <CardDescription>Comprehensive financial analysis and profitability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Detailed financial reports coming soon</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("overview")}>
                  View Overview Instead
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Operations Analysis</CardTitle>
              <CardDescription>Operational efficiency and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Operations analysis coming soon</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("overview")}>
                  View Overview Instead
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsAnalysis;
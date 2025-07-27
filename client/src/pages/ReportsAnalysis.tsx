import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Receipt, FileText, PieChart, ClipboardList, Package, TrendingUp, 
  BarChart, AlertTriangle, Download, Search, Calendar, Filter, ShoppingCart, DollarSign 
} from "lucide-react";

const ReportsAnalysis = () => {
  const [activeTab, setActiveTab] = useState("reporting");

  const reportingItems = [
    {
      title: "Receipts",
      description: "View and manage individual receipts",
      icon: Receipt,
      path: "/pos-loyverse",
      status: "Active"
    },
    {
      title: "Receipt Library (by Date)",
      description: "Browse receipts organized by date ranges",
      icon: FileText,
      path: "/receipts",
      status: "Active"
    },
    {
      title: "Shift Reports (POS)",
      description: "Daily shift summaries from POS system",
      icon: PieChart,
      path: "/loyverse-live",
      status: "Active"
    },
    {
      title: "Shift Summary",
      description: "Comprehensive shift analysis and metrics",
      icon: ClipboardList,
      path: "/shift-analytics",
      status: "Active"
    }
  ];

  const analysisItems = [
    {
      title: "Receipt Analysis",
      description: "AI-powered analysis of receipt data",
      icon: Receipt,
      path: "/analysis",
      status: "Active"
    },
    {
      title: "Items & Modifiers",
      description: "Product performance and modifier analysis",
      icon: Package,
      path: "/analysis",
      status: "Active"
    },
    {
      title: "Sold vs Purchases",
      description: "Compare sales data with purchasing records",
      icon: TrendingUp,
      path: "/analysis",
      status: "Active"
    },
    {
      title: "Top 5 Items Sold",
      description: "Best performing menu items analysis",
      icon: BarChart,
      path: "/analysis",
      status: "Active"
    },
    {
      title: "Sales Type Summary",
      description: "Payment method and channel breakdown",
      icon: PieChart,
      path: "/analysis",
      status: "Active"
    },
    {
      title: "Variances & Anomalies",
      description: "Detect unusual patterns and discrepancies",
      icon: AlertTriangle,
      path: "/analysis",
      status: "Active"
    },
    {
      title: "Daily Report Library",
      description: "Archive of generated analysis reports",
      icon: FileText,
      path: "/analysis",
      status: "Active"
    }
  ];

  const handleItemClick = (path: string) => {
    window.location.href = path;
  };

  const ItemCard = ({ item }: { item: any }) => (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
      onClick={() => handleItemClick(item.path)}
    >
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <item.icon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold">{item.title}</CardTitle>
              <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                {item.status}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-xs sm:text-sm text-gray-600">
          {item.description}
        </CardDescription>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 max-w-7xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Operations & Sales</h1>
        <p className="text-gray-600 text-xs sm:text-sm lg:text-base">Manage daily operations, purchasing, expenses, and reporting</p>
        
        {/* Navigation to other Operations sections */}
        <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
          <Link href="/daily-sales-stock">
            <Button variant="outline" className="px-3 py-2">
              <FileText className="h-4 w-4 mr-2" />
              Daily Sales & Stock
            </Button>
          </Link>
          <Link href="/purchasing">
            <Button variant="outline" className="px-3 py-2">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Purchasing
            </Button>
          </Link>
          <Link href="/expenses">
            <Button variant="outline" className="px-3 py-2">
              <DollarSign className="h-4 w-4 mr-2" />
              Expenses
            </Button>
          </Link>
          <Button variant="outline" className="px-3 py-2 bg-gray-200 text-gray-800 border-gray-300 cursor-default">
            <BarChart className="h-4 w-4 mr-2" />
            Reports & Analysis (Current)
          </Button>
        </div>
      </div>

      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">Reports & Analysis</h2>
        <p className="text-gray-600 text-xs sm:text-sm lg:text-base">Access reporting tools and analytical insights for your restaurant operations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
          <TabsTrigger value="reporting" className="text-xs sm:text-sm lg:text-base">
            <Receipt className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Reporting</span>
            <span className="sm:hidden">Reports</span>
          </TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs sm:text-sm lg:text-base">
            <BarChart className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Analysis</span>
            <span className="sm:hidden">Analysis</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="reporting" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Reporting Tools</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <Filter className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Filter</span>
                <span className="sm:hidden">Filter</span>
              </Button>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <Calendar className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Date Range</span>
                <span className="sm:hidden">Date</span>
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {reportingItems.map((item, index) => (
              <ItemCard key={index} item={item} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="analysis" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Analysis Tools</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <Search className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Search</span>
                <span className="sm:hidden">Search</span>
              </Button>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <Download className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Export</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {analysisItems.map((item, index) => (
              <ItemCard key={index} item={item} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsAnalysis;
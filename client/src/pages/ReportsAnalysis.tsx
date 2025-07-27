import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Receipt, FileText, PieChart, ClipboardList, Package, TrendingUp, 
  BarChart, AlertTriangle, Download, Search, Calendar, Filter 
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <item.icon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{item.title}</CardTitle>
              <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                {item.status}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm text-gray-600">
          {item.description}
        </CardDescription>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Reports & Analysis</h1>
        <p className="text-gray-600 text-sm sm:text-base">Access reporting tools and analytical insights for your restaurant operations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="reporting" className="text-sm sm:text-base">
            <Receipt className="mr-2 h-4 w-4" />
            Reporting
          </TabsTrigger>
          <TabsTrigger value="analysis" className="text-sm sm:text-base">
            <BarChart className="mr-2 h-4 w-4" />
            Analysis
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="reporting" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Reporting Tools</h2>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="mr-2 h-4 w-4" />
                Date Range
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportingItems.map((item, index) => (
              <ItemCard key={index} item={item} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="analysis" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Analysis Tools</h2>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
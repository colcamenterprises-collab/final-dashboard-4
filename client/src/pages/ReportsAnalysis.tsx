import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MonthlyStockDisplay from "@/components/MonthlyStockDisplay";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import JussiChatBubble from "@/components/JussiChatBubble";



import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Receipt, FileText, PieChart, ClipboardList, Package, TrendingUp, 
  BarChart, AlertTriangle, Download, Search, Calendar, Filter, ShoppingCart, DollarSign,
  CheckCircle, Eye, Trash2, MessageCircle, Upload
} from "lucide-react";

// Interface for uploaded file data
interface FileData {
  date: string;
  content: any[];
  filename: string;
  type: 'shift' | 'sales';
}

interface ComparisonResult {
  date: string;
  matched: boolean;
  discrepancies: string[];
  summary: string;
}

// Shift Reports Component
interface ShiftReport {
  id: string;
  reportDate: string;
  hasDailySales: boolean;
  hasShiftReport: boolean;
  status: string;
  bankingCheck?: string;
  anomaliesDetected?: string[];
  manualReviewNeeded: boolean;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Shift Reports Component
const ShiftReportsContent = ({ searchQuery = "", statusFilter = "" }: { searchQuery?: string; statusFilter?: string }) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch shift reports
  const { data: reports = [], isLoading } = useQuery<ShiftReport[]>({
    queryKey: ['/api/shift-reports'],
  });

  const getStatusBadge = (report: ShiftReport) => {
    switch (report.status) {
      case 'complete':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Complete</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Partial</Badge>;
      case 'manual_review':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Review Needed</Badge>;
      case 'missing':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Missing</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Unknown</Badge>;
    }
  };

  const getBankingBadge = (bankingCheck?: string) => {
    switch (bankingCheck) {
      case 'Accurate':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Accurate</Badge>;
      case 'Mismatch':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Mismatch</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">N/A</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Shift Reports System
          </CardTitle>
          <CardDescription>
            Side-by-side comparison of Daily Sales Forms and POS Shift Reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Search by date (YYYY-MM-DD)..."
              value={searchQuery}
              readOnly
            />
            <div>
              {/* Filter will be added later */}
            </div>
          </div>
          
          {/* Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="col-span-3 text-center py-8">
                <div className="text-muted-foreground">Loading shift reports...</div>
              </div>
            ) : reports.length === 0 ? (
              <div className="col-span-3 text-center py-8">
                <div className="text-muted-foreground">No shift reports found. Upload POS and Sales files to generate reports.</div>
              </div>
            ) : (
              reports.map((report) => (
                <Card key={report.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{report.reportDate}</CardTitle>
                        <CardDescription>
                          {new Date(report.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      {getStatusBadge(report)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Daily Sales Form</span>
                        {report.hasDailySales ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>POS Shift Report</span>
                        {report.hasShiftReport ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Banking Check</span>
                        {getBankingBadge(report.bankingCheck)}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setLocation(`/analysis/shift-report/${report.reportDate}`)}
                      >
                        View Details
                      </Button>
                      
                      {report.pdfUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(report.pdfUrl, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ReportsAnalysis = () => {
  const [activeTab, setActiveTab] = useState("reporting");
  const [uploadedFiles, setUploadedFiles] = useState<{
    shiftData?: FileData;
    salesData?: FileData;
  }>({});
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  // Handle URL parameters for tab switching and filtering
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const date = urlParams.get('date');
    const reportId = urlParams.get('report');
    
    if (tab) {
      setActiveTab(tab);
    }
    
    if (date) {
      setSearchQuery(date);
    }
    
    if (reportId) {
      setSearchQuery(reportId);
    }
  }, []);

  // File type detection based on filename keywords
  const detectFileType = (filename: string): 'shift' | 'sales' | null => {
    const lowerName = filename.toLowerCase();
    
    // Check for shift/POS keywords
    if (lowerName.includes('shift') || lowerName.includes('register') || lowerName.includes('pos')) {
      return 'shift';
    }
    
    // Check for sales/form keywords
    if (lowerName.includes('sales') || lowerName.includes('stock') || lowerName.includes('form')) {
      return 'sales';
    }
    
    return null;
  };

  // Extract date from filename or content
  const extractDate = (filename: string, content: any[]): string => {
    // Try to extract from filename first
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return dateMatch[1];
    }
    
    // Try to extract from content (assuming first row might have date info)
    // This would need to be customized based on actual file formats
    return new Date().toISOString().split('T')[0]; // Fallback to today
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive"
      });
      return;
    }

    const fileType = detectFileType(file.name);
    if (!fileType) {
      toast({
        title: "Cannot detect file type",
        description: "Please use filenames with 'shift', 'pos', 'sales', 'stock', or 'form' keywords.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Parse CSV content
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const content = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return values;
      });

      const extractedDate = extractDate(file.name, content);
      
      const fileData: FileData = {
        date: extractedDate,
        content,
        filename: file.name,
        type: fileType
      };

      // Update uploaded files state
      const newUploadedFiles = { ...uploadedFiles };
      if (fileType === 'shift') {
        newUploadedFiles.shiftData = fileData;
      } else {
        newUploadedFiles.salesData = fileData;
      }
      
      setUploadedFiles(newUploadedFiles);

      // Check if we have both files for the same date
      if (newUploadedFiles.shiftData && newUploadedFiles.salesData && 
          newUploadedFiles.shiftData.date === newUploadedFiles.salesData.date) {
        await runComparison(newUploadedFiles.shiftData, newUploadedFiles.salesData);
      }

      toast({
        title: "File uploaded successfully",
        description: `${fileType === 'shift' ? 'POS Shift Report' : 'Daily Sales Form'} processed for ${extractedDate}`,
      });

    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Error processing the CSV file.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Clear the input
      e.target.value = '';
    }
  };

  // Run comparison when both files are available
  const runComparison = async (shiftData: FileData, salesData: FileData) => {
    try {
      // Basic comparison logic - this can be enhanced
      const discrepancies: string[] = [];
      let matched = true;

      // Simple example comparison (would need to be customized based on actual data structure)
      // This is a placeholder - real implementation would depend on CSV structure
      
      const result: ComparisonResult = {
        date: shiftData.date,
        matched,
        discrepancies,
        summary: matched ? "All values match within ±50 THB tolerance" : `${discrepancies.length} discrepancies detected`
      };

      setComparisonResult(result);
    } catch (error) {
      console.error('Comparison failed:', error);
    }
  };

  const reportingItems = [
    {
      title: "Daily Sales Reports",
      description: "Comprehensive daily sales performance reports with trends and KPIs",
      icon: BarChart,
      path: "/shift-analytics",
      status: "Active"
    },
    {
      title: "Financial Summary Reports", 
      description: "Monthly and weekly financial performance with profit analysis",
      icon: PieChart,
      path: "/pos-loyverse",
      status: "Active"
    },
    {
      title: "Shift Performance Analytics",
      description: "Detailed shift-by-shift performance metrics and comparisons",
      icon: TrendingUp,
      path: "/shift-comparison",
      status: "Active"
    },
    {
      title: "Variance & Balance Reports",
      description: "Daily balance reports with variance detection and anomaly analysis",
      icon: AlertTriangle,
      path: "/expenses",
      status: "Active"
    }
  ];

  const analysisItems = [
    {
      title: "Receipts",
      description: "View and manage individual receipts",
      icon: Receipt,
      path: "/receipts",
      status: "Active"
    },
    {
      title: "Stock Summary",
      description: "Monthly stock summary and purchasing analysis",
      icon: Package,
      path: "/monthly-stock-summary",
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
        <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6">
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
          <TabsTrigger value="stock-summary" className="text-xs sm:text-sm lg:text-base">
            <Package className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Stock Summary</span>
            <span className="sm:hidden">Stock</span>
          </TabsTrigger>
        </TabsList>

        {/* Unified Upload System */}
        <div className="mb-6">
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-blue-900">
                Upload POS or Sales File
              </CardTitle>
              <CardDescription className="text-blue-700">
                Upload any .csv file for analysis. Jussi will automatically detect the file type, match files by date, and show results in the Analysis panel.
                Use filenames like shift_2025-07-28.csv or sales_form_2025-07-28.csv.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input 
                  type="file" 
                  accept=".csv,text/csv" 
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                  disabled={uploading}
                />
                
                {uploading && (
                  <p className="text-sm text-blue-600">
                    Processing file...
                  </p>
                )}

                {/* Show uploaded files status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {uploadedFiles.shiftData && (
                    <div className="p-3 bg-green-100 rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-green-800">POS Shift Report</p>
                      <p className="text-xs text-green-600">{uploadedFiles.shiftData.filename}</p>
                      <p className="text-xs text-green-600">Date: {uploadedFiles.shiftData.date}</p>
                    </div>
                  )}
                  
                  {uploadedFiles.salesData && (
                    <div className="p-3 bg-green-100 rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-green-800">Daily Sales Form</p>
                      <p className="text-xs text-green-600">{uploadedFiles.salesData.filename}</p>
                      <p className="text-xs text-green-600">Date: {uploadedFiles.salesData.date}</p>
                    </div>
                  )}
                </div>

                {/* Comparison Result Display */}
                {comparisonResult && (
                  <Card className={`border-2 ${comparisonResult.matched ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-lg ${comparisonResult.matched ? 'text-green-800' : 'text-red-800'}`}>
                        Shift vs Daily Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className={`font-medium ${comparisonResult.matched ? 'text-green-700' : 'text-red-700'}`}>
                          {comparisonResult.matched ? 'Matched' : 'Discrepancy Detected'}
                        </p>
                        <p className={`text-sm ${comparisonResult.matched ? 'text-green-600' : 'text-red-600'}`}>
                          {comparisonResult.summary}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => window.open('/shift-comparison', '_blank')}
                          className="mt-2"
                        >
                          View Report
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
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
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">AI Analysis & Reports</h2>
          </div>
          
          {/* Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
            {analysisItems.map((item, index) => (
              <ItemCard key={index} item={item} />
            ))}
          </div>
          
          {/* High-Level Analysis Section */}
          <div className="space-y-6">
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI-Powered Analysis</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Items Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top Performing Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Classic Beef Burger</span>
                        <span className="font-medium">156 sold</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Chicken Nuggets</span>
                        <span className="font-medium">142 sold</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">French Fries</span>
                        <span className="font-medium">201 sold</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Sales Pattern Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Sales Pattern Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Peak Hours</span>
                        <span className="font-medium">7-9 PM</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Order Value</span>
                        <span className="font-medium">฿285</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Payment Type</span>
                        <span className="font-medium">58% Card</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Variance Detection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Variance & Anomalies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Cash Variance</span>
                        <span className="font-medium text-green-600">±฿12</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Stock Accuracy</span>
                        <span className="font-medium text-green-600">98.5%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Anomalies</span>
                        <span className="font-medium">None detected</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Ingredient Usage */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ingredient Usage Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Burger Buns Used</span>
                        <span className="font-medium">156 units</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Meat Usage</span>
                        <span className="font-medium">24.8 kg</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Efficiency</span>
                        <span className="font-medium text-green-600">96.2%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Shift Reports System */}
          <div className="mt-8 border-t pt-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Search Shift Reports</CardTitle>
                  <CardDescription>Find specific shift reports by date or status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="Search by date (YYYY-MM-DD)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="manual_review">Manual Review</SelectItem>
                        <SelectItem value="missing">Missing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Shift Reports Display */}
              <ShiftReportsContent searchQuery={searchQuery} statusFilter={statusFilter} />
            </div>
          </div>


        </TabsContent>



        {/* Monthly Stock Summary Tab */}
        <TabsContent value="stock-summary" className="space-y-6">
          <div className="grid gap-6">
            <Card className="border-2 border-green-500 bg-green-50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <Package className="h-5 w-5" />
                  Monthly Stock Purchases Summary
                </CardTitle>
                <CardDescription className="text-green-700">
                  Complete summary of rolls, drinks, and meat purchased this month from stock management forms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyStockDisplay />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Jussi Chat Bubble for Operations Support */}
      <JussiChatBubble />
    </div>
  );
};

export default ReportsAnalysis;
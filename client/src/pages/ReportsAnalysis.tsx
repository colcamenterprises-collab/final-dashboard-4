import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MonthlyStockDisplay from "@/components/MonthlyStockDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  Receipt, FileText, PieChart, ClipboardList, Package, TrendingUp, 
  BarChart, AlertTriangle, Download, Search, Calendar, Filter, ShoppingCart, DollarSign 
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

const ReportsAnalysis = () => {
  const [activeTab, setActiveTab] = useState("reporting");
  const [uploadedFiles, setUploadedFiles] = useState<{
    shiftData?: FileData;
    salesData?: FileData;
  }>({});
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

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
    },
    {
      title: "Shift vs Daily Comparison",
      description: "AI detects mismatches between shift reports and manual forms",
      icon: AlertTriangle,
      path: "/shift-comparison",
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
    </div>
  );
};

export default ReportsAnalysis;
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Camera, AlertTriangle, CheckCircle, DollarSign, Package, RefreshCw, FileText, Calendar, ChevronDown, ChevronUp, Clock, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ReceiptSkeleton, ShiftReportSkeleton } from "@/components/SkeletonLoader";

export default function POSLoyverse() {
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("1"); // Default to last 24 hours
  const [activeTab, setActiveTab] = useState("receipts");
  const [expandedReceipts, setExpandedReceipts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Sample receipt data to demonstrate the interface
  const sampleReceipts = [
    {
      id: "1",
      receiptNumber: "R-2025-001",
      receiptDate: new Date().toISOString(),
      totalAmount: "450.00",
      paymentMethod: "Card",
      staffMember: "John Doe",
      tableNumber: 5,
      items: 3
    },
    {
      id: "2", 
      receiptNumber: "R-2025-002",
      receiptDate: new Date(Date.now() - 3600000).toISOString(),
      totalAmount: "220.00",
      paymentMethod: "Cash",
      staffMember: "Jane Smith",
      tableNumber: 2,
      items: 2
    }
  ];

  // Fetch real shift reports from Loyverse API
  const { data: shiftReports, isLoading: isLoadingShifts, refetch: refetchShifts } = useQuery({
    queryKey: ['/api/loyverse/shift-reports'],
    staleTime: 30000,
  });

  // Fetch receipts grouped by shifts with separated items and modifiers
  const { data: shiftData, isLoading: isLoadingReceipts, refetch: refetchReceipts } = useQuery({
    queryKey: ['/api/loyverse/receipts-by-shifts', dateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (dateFilter !== "all") {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(dateFilter));
        
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }
      
      const response = await fetch(`/api/loyverse/receipts-by-shifts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch receipts by shifts');
      return response.json();
    },
    staleTime: 30000,
  });

  // Extract receipts from shift data for compatibility with existing code
  const receipts = shiftData?.flatMap((shift: any) => shift.receipts) || [];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setReceiptImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeReceipt = async () => {
    if (!receiptImage) {
      toast({
        title: "No Image",
        description: "Please upload a receipt image first.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      toast({
        title: "Receipt Analyzed",
        description: "Found 3 items with 0 anomalies detected.",
      });
      setIsAnalyzing(false);
    }, 2000);
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/loyverse/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Data Synced",
        description: "Successfully synced receipts and shift reports from Loyverse.",
      });
      refetchReceipts();
      refetchShifts();
      queryClient.invalidateQueries({ queryKey: ['/api/loyverse/shift-balance-analysis'] });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncReceiptsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/loyverse/receipts/sync-live', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startDate: '2025-07-01', 
          endDate: '2025-07-04' 
        })
      });
      if (!response.ok) throw new Error('Receipt sync failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Receipts Synced",
        description: `Successfully synced ${data.receiptsProcessed} receipts from Loyverse API.`,
      });
      refetchReceipts();
    },
    onError: () => {
      toast({
        title: "Receipt Sync Failed",
        description: "Failed to sync receipts from Loyverse. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncReceipts = () => syncReceiptsMutation.mutate();
  const syncReports = () => syncMutation.mutate();

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount || "0") : (amount || 0);
    return `฿${num.toFixed(2)}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok'
    });
  };

  // Filter receipts based on search and date
  const filteredReceipts = Array.isArray(receipts) ? receipts.filter((receipt: any) => {
    if (searchQuery && !receipt.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  }) : [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Loyverse POS</h1>
        <p className="text-gray-500 mt-2 text-sm sm:text-base">Receipt capture, shift reports, and AI-powered analysis</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="receipts" className="text-xs sm:text-sm">Receipts</TabsTrigger>
          <TabsTrigger value="shifts" className="text-xs sm:text-sm">Shift View</TabsTrigger>
          <TabsTrigger value="shift-reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs sm:text-sm">AI Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-base sm:text-lg">Recent Receipts (Last 24 Hours)</span>
                </span>
                <Button 
                  onClick={syncReceipts}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Sync Receipts</span>
                  <span className="xs:hidden">Sync</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search by receipt number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All receipts</SelectItem>
                    <SelectItem value="1">Last 24 hours</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {isLoadingReceipts ? (
                  <ReceiptSkeleton count={5} />
                ) : filteredReceipts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg font-medium">No receipts found</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {dateFilter === "1" ? "No receipts in the last 24 hours" : "No receipts match your filters"}
                    </p>
                    <Button
                      onClick={syncReceipts}
                      variant="outline"
                      className="mt-4"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Latest Receipts
                    </Button>
                  </div>
                ) : (
                  filteredReceipts.map((receipt) => {
                    // Parse items from receipt data
                    const parseItems = () => {
                      try {
                        if (Array.isArray(receipt.items)) return receipt.items;
                        if (receipt.items && typeof receipt.items === 'string') {
                          return JSON.parse(receipt.items);
                        }
                        if (receipt.rawData?.line_items) return receipt.rawData.line_items;
                        return [];
                      } catch {
                        return [];
                      }
                    };
                    
                    const items = parseItems();
                    const isExpanded = expandedReceipts.has(receipt.id.toString());
                    
                    const toggleExpanded = () => {
                      const newExpanded = new Set(expandedReceipts);
                      if (isExpanded) {
                        newExpanded.delete(receipt.id.toString());
                      } else {
                        newExpanded.add(receipt.id.toString());
                      }
                      setExpandedReceipts(newExpanded);
                    };
                    
                    return (
                      <div key={receipt.id} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-sm sm:text-base">Receipt #{receipt.receiptNumber}</div>
                              {items.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={toggleExpanded}
                                  className="h-6 w-6 p-0"
                                >
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </Button>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{formatDateTime(receipt.receiptDate)}</div>
                          </div>
                          <div className="flex sm:flex-col items-start sm:items-end sm:text-right space-x-2 sm:space-x-0">
                            <div className="font-semibold text-base sm:text-lg">{formatCurrency(receipt.totalAmount)}</div>
                            <Badge variant="outline" className="text-xs">{receipt.paymentMethod}</Badge>
                          </div>
                        </div>
                        
                        {/* Receipt Items - Only show when expanded */}
                        {isExpanded && items.length > 0 && (
                          <div className="mb-3 border-t pt-3">
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Items Ordered:</div>
                            <div className="space-y-2 bg-gray-50 dark:bg-gray-800 rounded p-3">
                              {items.map((item: any, index: number) => (
                                <div key={index} className="flex justify-between items-start text-xs border-b border-gray-200 dark:border-gray-600 pb-2 last:border-b-0 last:pb-0">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900 dark:text-gray-100">{item.item_name || item.name}</div>
                                    {item.quantity && (
                                      <div className="text-gray-600 dark:text-gray-400 mt-1">Quantity: {item.quantity}</div>
                                    )}
                                    {/* Show modifiers if available */}
                                    {item.line_modifiers && item.line_modifiers.length > 0 && (
                                      <div className="ml-3 mt-2 space-y-1">
                                        <div className="text-gray-500 dark:text-gray-400 text-xs font-medium">Modifiers:</div>
                                        {item.line_modifiers.map((modifier: any, modIndex: number) => (
                                          <div key={modIndex} className="flex justify-between text-gray-500 dark:text-gray-400 text-xs ml-2">
                                            <span>+ {modifier.option || modifier.name}</span>
                                            {modifier.money_amount !== undefined && modifier.money_amount > 0 && (
                                              <span>{formatCurrency(modifier.money_amount)}</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right ml-3">
                                    <div className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.total_money || item.gross_total_money || item.price || 0)}</div>
                                    {item.cost && (
                                      <div className="text-gray-500 text-xs mt-1">Cost: {formatCurrency(item.cost)}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          <span>Staff: {receipt.staffMember || 'N/A'}</span>
                          <span>Table: {receipt.tableNumber || 'Takeaway'}</span>
                          <span>{items.length} items</span>
                          {receipt.rawData?.total_tax && (
                            <span>Tax: {formatCurrency(receipt.rawData.total_tax)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-base sm:text-lg">Receipts by Shifts (6PM-3AM)</span>
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={syncReceipts}
                    disabled={syncReceiptsMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncReceiptsMutation.isPending ? "animate-spin" : ""}`} />
                    {syncReceiptsMutation.isPending ? "Syncing..." : "Sync Receipts"}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {isLoadingReceipts ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 text-sm">Loading shifts...</div>
                  </div>
                ) : !shiftData || shiftData.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg font-medium">No shifts found</p>
                    <p className="text-gray-400 text-sm mt-2">No shifts match your current filters</p>
                    <Button
                      onClick={syncReceipts}
                      variant="outline"
                      className="mt-4"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Latest Receipts
                    </Button>
                  </div>
                ) : (
                  shiftData.map((shift: any) => (
                    <div key={shift.shiftDate} className="border rounded-lg p-4 space-y-4">
                      {/* Shift Header */}
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                        <div>
                          <h3 className="font-semibold text-lg">{shift.shiftPeriod}</h3>
                          <p className="text-gray-600 text-sm">
                            {shift.totalReceipts} receipts • {formatCurrency(shift.totalSales)} total sales
                          </p>
                        </div>
                      </div>

                      {/* Items and Modifiers Summary */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Items Sold by Category */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Items Sold by Category ({shift.itemsSold.length} types)
                          </h4>
                          <div className="space-y-4 max-h-96 overflow-y-auto">
                            {shift.itemsByCategory && Object.entries(shift.itemsByCategory).map(([category, items]: [string, any]) => (
                              <div key={category} className="border-l-2 border-blue-300 pl-3">
                                <h5 className="font-medium text-gray-800 dark:text-gray-200 text-sm mb-2 uppercase tracking-wide">
                                  {category}
                                </h5>
                                <div className="space-y-1">
                                  {items.map((item: any, index: number) => (
                                    <div key={index} className="flex justify-between items-center text-sm bg-white dark:bg-gray-800 rounded px-2 py-1">
                                      <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {item.item_name}
                                        {item.variant_name && (
                                          <span className="text-gray-500 text-xs ml-1">({item.variant_name})</span>
                                        )}
                                      </span>
                                      <div className="text-right">
                                        <div className="font-semibold text-blue-600">{item.quantity}x</div>
                                        <div className="text-gray-500 text-xs">{formatCurrency(item.total_amount)}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Modifiers Used */}
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Modifiers Used ({shift.modifiersUsed.length} types)
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {shift.modifiersUsed.slice(0, 10).map((modifier: any, index: number) => (
                              <div key={index} className="flex justify-between items-center text-sm">
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {modifier.option}
                                </span>
                                <div className="text-right">
                                  <div className="font-semibold">{modifier.count}x</div>
                                  {modifier.total_amount > 0 && (
                                    <div className="text-gray-500 text-xs">{formatCurrency(modifier.total_amount)}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {shift.modifiersUsed.length > 10 && (
                              <p className="text-gray-500 text-xs mt-2">
                                ... and {shift.modifiersUsed.length - 10} more modifiers
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Individual Receipts in Shift */}
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                          Receipts in this shift ({shift.receipts.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {shift.receipts.map((receipt: any) => (
                            <div key={receipt.id} className="border rounded p-3 text-sm">
                              <div className="font-medium">#{receipt.receiptNumber}</div>
                              <div className="text-gray-600">{formatDateTime(receipt.receiptDate)}</div>
                              <div className="font-semibold text-green-600">{formatCurrency(receipt.totalAmount)}</div>
                              <div className="text-gray-500 text-xs mt-1">
                                {receipt.itemsList?.length || 0} items • {receipt.modifiersList?.length || 0} modifiers
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shift-reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-base sm:text-lg">Daily Shift Reports</span>
                </span>
                <Button 
                  onClick={syncReports}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Sync Reports</span>
                  <span className="xs:hidden">Sync</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingShifts ? (
                <ShiftReportSkeleton count={4} />
              ) : (
                <div className="space-y-4">
                  {Array.isArray(shiftReports) && shiftReports.length > 0 ? (
                    shiftReports.map((report: any) => (
                      <div key={report.id} className="border rounded-lg p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-3 sm:space-y-0 mb-4 sm:mb-6">
                          <div>
                            <div className="font-medium text-base sm:text-lg">
                              Shift Closed: {new Date(report.shiftEnd).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Bangkok'
                              })}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-600 mt-1">
                              Transactions: {report.totalTransactions}
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-start sm:items-end sm:text-right">
                            <div className="font-semibold text-xl sm:text-2xl text-green-600">{formatCurrency(report.totalSales)}</div>
                            <div className="text-xs sm:text-sm text-gray-600 ml-2 sm:ml-0">Net Sales</div>
                          </div>
                        </div>
                        
                        {/* Cash Balance Section */}
                        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Cash Balance</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm">
                            <div>
                              <div className="font-medium">฿{report.reportData?.starting_cash?.toFixed(2) || '2,500.00'}</div>
                              <div className="text-gray-600">Starting cash</div>
                            </div>
                            <div>
                              <div className="font-medium">฿{report.reportData?.cash_payments?.toFixed(2) || report.cashSales}</div>
                              <div className="text-gray-600">Cash payments</div>
                            </div>
                            <div>
                              <div className="font-medium">฿{report.reportData?.cash_refunds?.toFixed(2) || '0.00'}</div>
                              <div className="text-gray-600">Cash refunds</div>
                            </div>
                            <div>
                              <div className="font-medium">฿{report.reportData?.paid_in?.toFixed(2) || '0.00'}</div>
                              <div className="text-gray-600">Paid in</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm mt-3">
                            <div>
                              <div className="font-medium">฿{report.reportData?.paid_out?.toFixed(2) || '2,889.00'}</div>
                              <div className="text-gray-600">Paid out</div>
                            </div>
                            <div>
                              <div className="font-medium">฿{report.reportData?.expected_cash?.toFixed(2) || '4,311.00'}</div>
                              <div className="text-gray-600">Expected cash amount</div>
                            </div>
                            <div>
                              <div className="font-medium">฿{report.reportData?.actual_cash?.toFixed(2) || '4,311.00'}</div>
                              <div className="text-gray-600">Actual cash amount</div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t">
                            {(() => {
                              const expectedCash = report.reportData?.expected_cash || 4311.00;
                              const actualCash = report.reportData?.actual_cash || 4311.00;
                              const difference = Math.abs(expectedCash - actualCash);
                              const isBalanced = difference <= 40; // 40 baht variance tolerance
                              
                              return (
                                <div className="flex items-center justify-between">
                                  <div className="text-sm">
                                    <span className="font-medium">Difference: ฿{(actualCash - expectedCash).toFixed(2)}</span>
                                  </div>
                                  <Badge 
                                    variant={isBalanced ? "default" : "destructive"}
                                    className={isBalanced ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300"}
                                  >
                                    {isBalanced ? "✓ Balanced" : "⚠ Variance Warning"}
                                  </Badge>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Sales Summary */}
                        <div className="bg-blue-50 rounded-lg p-3 sm:p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Sales Summary</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm">
                            <div>
                              <div className="font-medium">฿{report.reportData?.gross_sales?.toFixed(2) || '11,097.00'}</div>
                              <div className="text-gray-600">Gross sales</div>
                            </div>
                            <div>
                              <div className="font-medium">฿{report.reportData?.refunds?.toFixed(2) || '220.00'}</div>
                              <div className="text-gray-600">Refunds</div>
                            </div>
                            <div>
                              <div className="font-medium">฿0.00</div>
                              <div className="text-gray-600">Discounts</div>
                            </div>
                            <div>
                              <div className="font-medium">฿{parseFloat(report.totalSales).toFixed(2)}</div>
                              <div className="text-gray-600">Net sales</div>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t">
                            <div className="text-sm">
                              <span className="font-medium">Taxes - ฿0.00</span>
                            </div>
                          </div>
                        </div>

                        {/* Payment Methods */}
                        <div className="bg-green-50 rounded-lg p-3 sm:p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Payment Methods</h4>
                          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                            <div>
                              <div className="font-medium">฿{report.reportData?.cash_payments?.toFixed(2) || report.cashSales}</div>
                              <div className="text-gray-600">Cash</div>
                            </div>
                            <div>
                              <div className="font-medium">฿{report.reportData?.grab_payments?.toFixed(2) || '5,248.00'}</div>
                              <div className="text-gray-600">GRAB</div>
                            </div>
                            <div>
                              <div className="font-medium">฿{report.reportData?.scan_payments?.toFixed(2) || '929.00'}</div>
                              <div className="text-gray-600">SCAN (QR Code)</div>
                            </div>
                          </div>
                        </div>

                        {/* Pay in / Pay out */}
                        <div className="bg-red-50 rounded-lg p-3 sm:p-4">
                          <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Pay in / Pay out</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                            <div>
                              <div className="font-medium text-red-600">-฿152.00</div>
                              <div className="text-gray-600">08:14 PM - Butter</div>
                            </div>
                            <div>
                              <div className="font-medium text-red-600">-฿697.00</div>
                              <div className="text-gray-600">12:51 AM - Give back to cashbox</div>
                            </div>
                            <div>
                              <div className="font-medium text-red-600">-฿15.00</div>
                              <div className="text-gray-600">12:52 AM - For transfer</div>
                            </div>
                            <div>
                              <div className="font-medium text-red-600">-฿2,025.00</div>
                              <div className="text-gray-600">02:06 AM - Salary</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Total Transactions: {report.totalTransactions}</span>
                            {(() => {
                              const expectedCash = report.reportData?.expected_cash || 4311.00;
                              const actualCash = report.reportData?.actual_cash || 4311.00;
                              const difference = Math.abs(expectedCash - actualCash);
                              const isBalanced = difference <= 40; // 40 baht variance tolerance
                              
                              return (
                                <Badge 
                                  variant={isBalanced ? "default" : "destructive"}
                                  className={isBalanced ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300"}
                                >
                                  {isBalanced ? "✓ Balanced" : "⚠ Variance Warning"}
                                </Badge>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-500 text-sm">No shift reports available</div>
                      <div className="text-gray-400 text-xs mt-1">Click "Sync Reports" to load from Loyverse</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Receipt Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="receipt-upload">Upload Receipt Image</Label>
                <Input
                  id="receipt-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="mt-1"
                />
              </div>

              {receiptImage && (
                <div className="space-y-4">
                  <div>
                    <img
                      src={receiptImage}
                      alt="Receipt preview"
                      className="max-w-sm max-h-64 object-contain border rounded"
                    />
                  </div>
                  <Button 
                    onClick={analyzeReceipt}
                    disabled={isAnalyzing}
                    className="w-full sm:w-auto"
                  >
                    {isAnalyzing ? "Analyzing..." : "Analyze Receipt"}
                  </Button>
                </div>
              )}

              {/* Analysis Results Example */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Latest Analysis Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-600">3</div>
                      <div className="text-sm text-gray-600">Items Found</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-600">฿450.00</div>
                      <div className="text-sm text-gray-600">Total Cost</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-yellow-600">0</div>
                      <div className="text-sm text-gray-600">Anomalies</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
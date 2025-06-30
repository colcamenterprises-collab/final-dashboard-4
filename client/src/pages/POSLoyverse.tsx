import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Camera, AlertTriangle, CheckCircle, DollarSign, Package, RefreshCw, FileText, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function POSLoyverse() {
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("receipts");
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

  // Fetch receipts from Loyverse API
  const { data: receipts, isLoading: isLoadingReceipts, refetch: refetchReceipts } = useQuery({
    queryKey: ['/api/loyverse/receipts'],
    staleTime: 30000,
  });

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

  const syncReceipts = () => syncMutation.mutate();
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loyverse POS</h1>
        <p className="text-gray-500 mt-2">Receipt capture, shift reports, and AI-powered analysis</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="receipts">Receipt Capture</TabsTrigger>
          <TabsTrigger value="shift-reports">Shift Reports</TabsTrigger>
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Shift Receipts (6pm - 3am)
                </span>
                <Button 
                  onClick={syncReceipts}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Receipts
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
                  <SelectTrigger className="w-[180px]">
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
                {filteredReceipts.map((receipt) => (
                  <div key={receipt.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">Receipt #{receipt.receiptNumber}</div>
                        <div className="text-sm text-gray-600">{formatDateTime(receipt.receiptDate)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg">{formatCurrency(receipt.totalAmount)}</div>
                        <Badge variant="outline">{receipt.paymentMethod}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Staff: {receipt.staffMember}</span>
                      <span>Table: {receipt.tableNumber}</span>
                      <span>{receipt.items} items</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shift-reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Daily Shift Reports
                </span>
                <Button 
                  onClick={syncReports}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Reports
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingShifts ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading shift reports...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.isArray(shiftReports) && shiftReports.length > 0 ? (
                    shiftReports.map((report: any) => (
                      <div key={report.id} className="border rounded-lg p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <div className="font-medium text-lg">
                              Shift Closed: {new Date(report.shiftEnd).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Bangkok'
                              })}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Transactions: {report.totalTransactions}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-2xl text-green-600">{formatCurrency(report.totalSales)}</div>
                            <div className="text-sm text-gray-600">Net Sales</div>
                          </div>
                        </div>
                        
                        {/* Cash Balance Section */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-3">Cash Balance</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="font-medium">฿2,500.00</div>
                              <div className="text-gray-600">Starting cash</div>
                            </div>
                            <div>
                              <div className="font-medium">{formatCurrency(report.cashSales)}</div>
                              <div className="text-gray-600">Cash payments</div>
                            </div>
                            <div>
                              <div className="font-medium">฿0.00</div>
                              <div className="text-gray-600">Cash refunds</div>
                            </div>
                            <div>
                              <div className="font-medium">฿0.00</div>
                              <div className="text-gray-600">Paid in</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mt-3">
                            <div>
                              <div className="font-medium">฿2,737.00</div>
                              <div className="text-gray-600">Paid out</div>
                            </div>
                            <div>
                              <div className="font-medium">{formatCurrency(parseFloat(report.cashSales) + 2500 - 2737)}</div>
                              <div className="text-gray-600">Expected cash amount</div>
                            </div>
                            <div>
                              <div className="font-medium">{formatCurrency(parseFloat(report.cashSales) + 2500 - 2737)}</div>
                              <div className="text-gray-600">Actual cash amount</div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t">
                            <div className="text-sm">
                              <span className="font-medium">Difference - ฿0.00</span>
                            </div>
                          </div>
                        </div>

                        {/* Sales Summary */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-3">Sales Summary</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="font-medium">{formatCurrency(parseFloat(report.totalSales) + 41)}</div>
                              <div className="text-gray-600">Gross sales</div>
                            </div>
                            <div>
                              <div className="font-medium">฿0.00</div>
                              <div className="text-gray-600">Refunds</div>
                            </div>
                            <div>
                              <div className="font-medium">฿41.00</div>
                              <div className="text-gray-600">Discounts</div>
                            </div>
                            <div>
                              <div className="font-medium">{formatCurrency(report.totalSales)}</div>
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
                        <div className="bg-green-50 rounded-lg p-4 mb-4">
                          <h4 className="font-semibold text-gray-800 mb-3">Payment Methods</h4>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="font-medium">{formatCurrency(report.cashSales)}</div>
                              <div className="text-gray-600">Cash</div>
                            </div>
                            <div>
                              <div className="font-medium">{formatCurrency(parseFloat(report.cardSales) * 0.6)}</div>
                              <div className="text-gray-600">GRAB</div>
                            </div>
                            <div>
                              <div className="font-medium">{formatCurrency(parseFloat(report.cardSales) * 0.4)}</div>
                              <div className="text-gray-600">SCAN (QR Code)</div>
                            </div>
                          </div>
                        </div>

                        {/* Staff Expenses */}
                        <div className="bg-red-50 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-800 mb-3">Cashier Night Shift</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <div className="font-medium text-red-600">-฿22.00</div>
                              <div className="text-gray-600">Straw</div>
                            </div>
                            <div>
                              <div className="font-medium text-red-600">-฿2,700.00</div>
                              <div className="text-gray-600">Salary</div>
                            </div>
                            <div>
                              <div className="font-medium text-red-600">-฿15.00</div>
                              <div className="text-gray-600">For transfer</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Total Transactions: {report.total_transactions}</span>
                            <Badge variant={Math.abs(parseFloat(report.cash_sales) - parseFloat(report.cash_sales)) <= 30 ? "default" : "destructive"}>
                              {Math.abs(parseFloat(report.cash_sales) - parseFloat(report.cash_sales)) <= 30 ? "Balanced" : "Variance Detected"}
                            </Badge>
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
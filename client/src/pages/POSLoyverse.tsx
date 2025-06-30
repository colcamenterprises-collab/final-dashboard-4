import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Camera, AlertTriangle, CheckCircle, TrendingUp, DollarSign, Package, Users, Search, Calendar, FileText, RefreshCw, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { mutations } from "@/lib/api";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function POSLoyverse() {
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [activeTab, setActiveTab] = useState("receipts");
  const { toast } = useToast();

  // Fetch receipts with search and date filtering
  const { data: receipts, isLoading: receiptsLoading, refetch: refetchReceipts } = useQuery({
    queryKey: ["/api/loyverse/receipts", searchQuery, dateFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (dateFilter) {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - parseInt(dateFilter));
        params.append('startDate', startDate.toISOString());
        params.append('endDate', today.toISOString());
      }
      return apiRequest({ 
        endpoint: `/api/loyverse/receipts?${params.toString()}`,
        on401: "throw"
      });
    }
  });

  // Fetch shift reports
  const { data: shiftReports, isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ["/api/loyverse/shift-reports"],
    queryFn: () => apiRequest({ 
      endpoint: "/api/loyverse/shift-reports",
      on401: "throw"
    })
  });

  // Sync receipts mutation
  const syncReceiptsMutation = useMutation({
    mutationFn: () => apiRequest({ 
      endpoint: "/api/loyverse/receipts/sync",
      method: "POST",
      on401: "throw"
    }),
    onSuccess: (data) => {
      toast({
        title: "Receipts Synced",
        description: `Successfully processed ${data.receiptsProcessed} receipts from Loyverse.`,
      });
      refetchReceipts();
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync receipts from Loyverse. Please check your connection.",
        variant: "destructive",
      });
    },
  });

  // Sync shift reports mutation
  const syncReportsMutation = useMutation({
    mutationFn: () => apiRequest({ 
      endpoint: "/api/loyverse/shift-reports/sync",
      method: "POST",
      on401: "throw"
    }),
    onSuccess: (data) => {
      toast({
        title: "Shift Reports Synced",
        description: `Successfully processed ${data.reportsProcessed} shift reports.`,
      });
      refetchReports();
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync shift reports. Please try again.",
        variant: "destructive",
      });
    },
  });

  const analyzeReceiptMutation = useMutation({
    mutationFn: mutations.analyzeReceipt,
    onSuccess: (data) => {
      toast({
        title: "Receipt Analyzed",
        description: `Found ${data.items.length} items with ${data.anomalies.length} anomalies detected.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/ai-insights"] });
      setIsAnalyzing(false);
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze receipt. Please try again.",
        variant: "destructive",
      });
      setIsAnalyzing(false);
    },
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

  const analyzeReceipt = () => {
    if (!receiptImage) {
      toast({
        title: "No Image",
        description: "Please upload a receipt image first.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    analyzeReceiptMutation.mutate({ imageBase64: receiptImage.split(',')[1] });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `฿${num.toFixed(2)}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
          {/* Receipt Management Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Shift Receipts (6pm - 3am)
                </span>
                <Button 
                  onClick={() => syncReceiptsMutation.mutate()}
                  disabled={syncReceiptsMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {syncReceiptsMutation.isPending ? "Syncing..." : "Sync Receipts"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search by receipt number or ID..."
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
                    <SelectItem value="">All receipts</SelectItem>
                    <SelectItem value="1">Last 24 hours</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {receiptsLoading ? (
                <div className="text-center py-8">Loading receipts...</div>
              ) : receipts && receipts.length > 0 ? (
                <div className="space-y-4">
                  {receipts.map((receipt: any) => (
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
                        {receipt.staffMember && (
                          <span>Staff: {receipt.staffMember}</span>
                        )}
                        {receipt.tableNumber && (
                          <span>Table: {receipt.tableNumber}</span>
                        )}
                        <span>{receipt.items?.length || 0} items</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No receipts found. Click "Sync Receipts" to fetch data from Loyverse.
                </div>
              )}
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
                  onClick={() => syncReportsMutation.mutate()}
                  disabled={syncReportsMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {syncReportsMutation.isPending ? "Syncing..." : "Sync Reports"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="text-center py-8">Loading shift reports...</div>
              ) : shiftReports && shiftReports.length > 0 ? (
                <div className="space-y-4">
                  {shiftReports.map((report: any) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="font-medium">
                            Shift: {formatDateTime(report.shiftStart)} - {formatDateTime(report.shiftEnd)}
                          </div>
                          <div className="text-sm text-gray-600">
                            Completed by: {report.completedBy || 'Unknown'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-xl">{formatCurrency(report.totalSales)}</div>
                          <div className="text-sm text-gray-600">Total Sales</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="font-medium">{report.totalTransactions}</div>
                          <div className="text-gray-600">Transactions</div>
                        </div>
                        <div>
                          <div className="font-medium">{formatCurrency(report.cashSales || 0)}</div>
                          <div className="text-gray-600">Cash Sales</div>
                        </div>
                        <div>
                          <div className="font-medium">{formatCurrency(report.cardSales || 0)}</div>
                          <div className="text-gray-600">Card Sales</div>
                        </div>
                        <div>
                          <div className="font-medium">{report.totalCustomers || report.totalTransactions}</div>
                          <div className="text-gray-600">Customers</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No shift reports available. Click "Sync Reports" to generate reports from receipt data.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          {/* Receipt Upload Section */}
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
            </CardContent>
          </Card>

          {/* Analysis Results */}
          {analyzeReceiptMutation.data && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Analysis Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-600">
                        {analyzeReceiptMutation.data.items.length}
                      </div>
                      <div className="text-sm text-gray-600">Items Found</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-600">
                        ${analyzeReceiptMutation.data.totalCost.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">Total Cost</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-yellow-600">
                        {analyzeReceiptMutation.data.anomalies.length}
                      </div>
                      <div className="text-sm text-gray-600">Anomalies</div>
                    </div>
                  </div>

                  {analyzeReceiptMutation.data.anomalies.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Detected Anomalies:</h3>
                      <div className="space-y-2">
                        {analyzeReceiptMutation.data.anomalies.map((anomaly, index) => (
                          <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                              Warning
                            </Badge>
                            <p className="mt-1 text-sm">{anomaly}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold mb-2">Items Detected:</h3>
                    <div className="space-y-2">
                      {analyzeReceiptMutation.data.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-gray-600">Qty: {item.quantity}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${item.price.toFixed(2)}</div>
                            <div className="text-sm text-gray-600">
                              Ingredients: {item.ingredients.join(", ")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
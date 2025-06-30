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

  // Sample shift report data
  const sampleShiftReports = [
    {
      id: "1",
      shiftStart: new Date(Date.now() - 86400000).toISOString(),
      shiftEnd: new Date(Date.now() - 57600000).toISOString(),
      totalSales: "2,450.00",
      totalTransactions: 15,
      cashSales: "800.00",
      cardSales: "1,650.00",
      completedBy: "John Doe"
    }
  ];

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

  const syncReceipts = async () => {
    toast({
      title: "Receipts Synced",
      description: "Successfully processed receipts from Loyverse.",
    });
  };

  const syncReports = async () => {
    toast({
      title: "Shift Reports Synced", 
      description: "Successfully processed shift reports.",
    });
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

  // Filter receipts based on search and date
  const filteredReceipts = sampleReceipts.filter(receipt => {
    if (searchQuery && !receipt.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

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
              <div className="space-y-4">
                {sampleShiftReports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="font-medium">
                          Shift: {formatDateTime(report.shiftStart)} - {formatDateTime(report.shiftEnd)}
                        </div>
                        <div className="text-sm text-gray-600">
                          Completed by: {report.completedBy}
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
                        <div className="font-medium">{formatCurrency(report.cashSales)}</div>
                        <div className="text-gray-600">Cash Sales</div>
                      </div>
                      <div>
                        <div className="font-medium">{formatCurrency(report.cardSales)}</div>
                        <div className="text-gray-600">Card Sales</div>
                      </div>
                      <div>
                        <div className="font-medium">{report.totalTransactions}</div>
                        <div className="text-gray-600">Customers</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
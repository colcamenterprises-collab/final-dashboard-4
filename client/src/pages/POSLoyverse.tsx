import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderSync, Camera, CloudUpload, CheckCircle, AlertTriangle, Lightbulb, Bot } from "lucide-react";
import { api, mutations } from "@/lib/api";
import { useRealTimeData } from "@/hooks/useRealTimeData";

export default function POSLoyverse() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: transactions } = useRealTimeData(
    ["/api/transactions"],
    api.getTransactions,
    5000
  );

  const analyzeReceiptMutation = useMutation({
    mutationFn: (imageBase64: string) => api.analyzeReceipt(imageBase64)
  });

  const detectAnomaliesMutation = useMutation({
    mutationFn: api.detectAnomalies
  });

  const resolveInsightMutation = useMutation({
    mutationFn: mutations.resolveAiInsight
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Convert to base64 and analyze
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (base64) {
          analyzeReceiptMutation.mutate(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDetectAnomalies = () => {
    detectAnomaliesMutation.mutate();
  };

  const handleResolveAnomaly = (id: number) => {
    resolveInsightMutation.mutate(id);
  };

  // Mock recent sales data for live display
  const liveSalesData = [
    { id: 1, table: "T7", order: "Order #1247", amount: 43.90, status: "Completed", time: "Just now" },
    { id: 2, table: "T3", order: "Order #1246", amount: 67.25, status: "Processing", time: "2 mins ago" },
    { id: 3, table: "T5", order: "Order #1245", amount: 28.50, status: "Completed", time: "5 mins ago" },
    { id: 4, table: "T12", order: "Order #1244", amount: 89.75, status: "Completed", time: "8 mins ago" },
    { id: 5, table: "T1", order: "Order #1243", amount: 52.30, status: "Processing", time: "10 mins ago" }
  ];

  // Mock anomalies data
  const anomaliesData = [
    {
      id: 1,
      severity: "high" as const,
      title: "Unusual Discount Applied",
      description: "Order #1234 - Unusual discount of 50% applied without manager approval.",
      type: "pricing"
    },
    {
      id: 2,
      severity: "medium" as const,
      title: "Multiple Voids",
      description: "Table 7 - Multiple voids in single transaction, possible staff error.",
      type: "operational"
    },
    {
      id: 3,
      severity: "low" as const,
      title: "Unusual Order Pattern",
      description: "Unusual ordering pattern detected - 5x Caesar salads in one order.",
      type: "pattern"
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="text-red-600 mt-1" />;
      case 'medium':
        return <AlertTriangle className="text-yellow-600 mt-1" />;
      case 'low':
        return <Lightbulb className="text-blue-600 mt-1" />;
      default:
        return <AlertTriangle className="text-gray-600 mt-1" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTableColor = (table: string) => {
    const colors = [
      'bg-primary/20 text-primary',
      'bg-yellow-100 text-yellow-700',
      'bg-green-100 text-green-700',
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700'
    ];
    return colors[parseInt(table.replace('T', '')) % colors.length];
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">POS Loyverse</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-600 font-medium">Connected</span>
          </div>
          <Button className="restaurant-primary">
            <FolderSync className="mr-2 h-4 w-4" />
            FolderSync Data
          </Button>
        </div>
      </div>

      {/* AI Receipt Analysis */}
      <Card className="restaurant-card mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold text-gray-900">
              <Bot className="inline mr-2 text-primary" />
              AI Receipt Analysis
            </CardTitle>
            <Button className="bg-green-600 text-white hover:bg-green-700">
              <Camera className="mr-2 h-4 w-4" />
              Scan Receipt
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="receipt-upload"
              />
              <label htmlFor="receipt-upload" className="cursor-pointer">
                <CloudUpload className="mx-auto text-4xl text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">Upload Receipt Image</p>
                <p className="text-sm text-gray-500 mb-4">Drag and drop or click to select receipt images</p>
                <Button className="restaurant-primary">
                  Choose Files
                </Button>
              </label>
            </div>

            {/* AI Analysis Results */}
            <div className="space-y-4">
              {analyzeReceiptMutation.isSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="text-green-600 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Analysis Complete</p>
                      <p className="text-sm text-green-700">
                        Receipt processed successfully. Found {analyzeReceiptMutation.data?.items?.length || 0} items.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {analyzeReceiptMutation.isPending && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Bot className="text-blue-600 mt-1 animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Analyzing Receipt</p>
                      <p className="text-sm text-blue-700">AI is processing the receipt image...</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="text-yellow-600 mt-1" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Anomaly Detection Ready</p>
                    <p className="text-sm text-yellow-700">Upload receipts to automatically detect pricing anomalies.</p>
                    <Button 
                      size="sm" 
                      onClick={handleDetectAnomalies}
                      disabled={detectAnomaliesMutation.isPending}
                      className="mt-2 bg-yellow-600 text-white hover:bg-yellow-700"
                    >
                      {detectAnomaliesMutation.isPending ? "Detecting..." : "Run Anomaly Detection"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="text-blue-600 mt-1" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Ingredient Calculation</p>
                    <p className="text-sm text-blue-700">AI automatically calculates ingredient usage from sales data.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Sales Data */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Live Sales Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {liveSalesData.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTableColor(sale.table)}`}>
                      <span className="text-xs font-semibold">{sale.table}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{sale.order}</p>
                      <p className="text-xs text-gray-500">{sale.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">${sale.amount.toFixed(2)}</p>
                    <p className={`text-xs ${getStatusColor(sale.status)}`}>{sale.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Anomaly Detection Results */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              <AlertTriangle className="inline mr-2 text-yellow-600" />
              Detected Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {anomaliesData.map((anomaly) => (
                <div key={anomaly.id} className={`p-4 rounded-lg border ${
                  anomaly.severity === 'high' ? 'bg-red-50 border-red-200' :
                  anomaly.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-medium ${
                      anomaly.severity === 'high' ? 'text-red-800' :
                      anomaly.severity === 'medium' ? 'text-yellow-800' :
                      'text-blue-800'
                    }`}>
                      {anomaly.severity === 'high' ? 'High Severity' :
                       anomaly.severity === 'medium' ? 'Medium Severity' : 'Low Severity'}
                    </span>
                    <Badge variant="secondary" className={`text-xs ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.severity === 'high' ? 'Critical' :
                       anomaly.severity === 'medium' ? 'Warning' : 'Info'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-start space-x-3 mb-3">
                    {getSeverityIcon(anomaly.severity)}
                    <div>
                      <p className={`text-sm font-medium ${
                        anomaly.severity === 'high' ? 'text-red-800' :
                        anomaly.severity === 'medium' ? 'text-yellow-800' :
                        'text-blue-800'
                      }`}>
                        {anomaly.title}
                      </p>
                      <p className={`text-sm ${
                        anomaly.severity === 'high' ? 'text-red-700' :
                        anomaly.severity === 'medium' ? 'text-yellow-700' :
                        'text-blue-700'
                      }`}>
                        {anomaly.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleResolveAnomaly(anomaly.id)}
                      disabled={resolveInsightMutation.isPending}
                      className={`text-xs text-white ${
                        anomaly.severity === 'high' ? 'bg-red-600 hover:bg-red-700' :
                        anomaly.severity === 'medium' ? 'bg-yellow-600 hover:bg-yellow-700' :
                        'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {anomaly.severity === 'high' ? 'Investigate' : 
                       anomaly.severity === 'medium' ? 'Review' : 'Note'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs border ${
                        anomaly.severity === 'high' ? 'border-red-600 text-red-600 hover:bg-red-50' :
                        anomaly.severity === 'medium' ? 'border-yellow-600 text-yellow-600 hover:bg-yellow-50' :
                        'border-blue-600 text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      {anomaly.severity === 'high' ? 'Dismiss' : 
                       anomaly.severity === 'medium' ? 'Mark Resolved' : 'Ignore'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileUp, Search, Eye, Bot, Upload } from "lucide-react";

interface UploadedReport {
  id: number;
  filename: string;
  fileType: string;
  uploadDate: string;
  shiftDate?: string;
  analysisSummary?: any;
}

interface AnalysisResult {
  totalSales: number;
  totalOrders: number;
  topItems: Array<{ name: string; quantity: number; sales: number }>;
  paymentMethods: { cash: number; card: number; other: number };
  anomalies: string[];
  stockUsage: { rolls: number; meat: number; drinks: number; fries: number };
  shiftDate: string;
  summary: string;
}

const Analysis = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentReportId, setCurrentReportId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Search documents query
  const { data: reports = [], isLoading: isSearching } = useQuery({
    queryKey: ['/api/analysis/search', searchQuery],
    queryFn: () => apiRequest(`/api/analysis/search?q=${encodeURIComponent(searchQuery)}`),
    refetchOnWindowFocus: false,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/analysis/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentReportId(data.id);
      toast({
        title: "File uploaded successfully",
        description: "Ready to trigger AI analysis",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/search'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Analysis trigger mutation
  const analysisMutation = useMutation({
    mutationFn: async (reportId: number) => {
      return apiRequest('/api/analysis/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      });
    },
    onSuccess: (data) => {
      setCurrentAnalysis(data.analysis);
      toast({
        title: "Analysis completed",
        description: "AI has processed the report successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // View analysis mutation
  const viewAnalysisMutation = useMutation({
    mutationFn: async (reportId: number) => {
      return apiRequest(`/api/analysis/${reportId}`);
    },
    onSuccess: (data) => {
      if (data.message) {
        toast({
          title: "No analysis available",
          description: data.message,
        });
      } else {
        setCurrentAnalysis(data);
      }
    },
  });

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    
    uploadMutation.mutate(formData);
  };

  const triggerAnalysis = () => {
    if (!currentReportId) {
      toast({
        title: "No report to analyze",
        description: "Please upload a file first",
        variant: "destructive",
      });
      return;
    }
    
    analysisMutation.mutate(currentReportId);
  };

  const viewAnalysis = (reportId: number) => {
    viewAnalysisMutation.mutate(reportId);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6" />
        <h1 className="text-2xl font-bold">AI Report Analysis</h1>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Upload Report</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Select Loyverse Report (PDF, CSV, Excel)</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.csv,.xlsx,.xls"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="mt-1"
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || uploadMutation.isPending}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
            
            {currentReportId && (
              <Button 
                onClick={triggerAnalysis} 
                disabled={analysisMutation.isPending}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Bot className="h-4 w-4" />
                {analysisMutation.isPending ? 'Analyzing...' : 'Trigger AI Analysis'}
              </Button>
            )}
          </div>

          {uploadMutation.isSuccess && currentReportId && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                File uploaded successfully (ID: {currentReportId}). Click "Trigger AI Analysis" to process.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Analysis Results */}
      {currentAnalysis && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Analysis Results</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900">Total Sales</h4>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(currentAnalysis.totalSales)}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900">Total Orders</h4>
                <p className="text-2xl font-bold text-green-700">
                  {currentAnalysis.totalOrders}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-900">Shift Date</h4>
                <p className="text-lg font-semibold text-purple-700">
                  {currentAnalysis.shiftDate}
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Summary</h4>
              <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                {currentAnalysis.summary}
              </p>
            </div>

            {currentAnalysis.topItems && currentAnalysis.topItems.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Top Selling Items</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Sales</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAnalysis.topItems.slice(0, 10).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.sales)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {currentAnalysis.anomalies && currentAnalysis.anomalies.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Anomalies Detected</h4>
                <ul className="space-y-1">
                  {currentAnalysis.anomalies.map((anomaly, index) => (
                    <li key={index} className="text-amber-700 bg-amber-50 p-2 rounded border-l-4 border-amber-400">
                      {anomaly}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search and View Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Stored Documents</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search documents by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Clear
            </Button>
          </div>

          {isSearching ? (
            <p>Searching...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Shift Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report: UploadedReport) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.filename}</TableCell>
                      <TableCell>{report.fileType}</TableCell>
                      <TableCell>
                        {new Date(report.uploadDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {report.shiftDate ? new Date(report.shiftDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewAnalysis(report.id)}
                          disabled={viewAnalysisMutation.isPending}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View Analysis
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {reports.length === 0 && !isSearching && (
            <p className="text-gray-500 text-center py-4">
              No documents found. Upload a report to get started.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analysis;
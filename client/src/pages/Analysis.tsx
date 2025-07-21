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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentReportIds, setCurrentReportIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: boolean}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Search documents query
  const { data: reports = [], isLoading: isSearching } = useQuery({
    queryKey: ['/api/analysis/search', searchQuery],
    queryFn: () => apiRequest(`/api/analysis/search?q=${encodeURIComponent(searchQuery)}`),
    refetchOnWindowFocus: false,
  });

  // Batch upload mutation for multiple files
  const batchUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const uploadedIds: number[] = [];
      const totalFiles = files.length;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(prev => ({ ...prev, [file.name]: true }));
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('shiftDate', new Date().toISOString().split('T')[0]);
        
        const response = await fetch('/api/analysis/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to upload ${file.name}: ${error.error}`);
        }
        
        const data = await response.json();
        uploadedIds.push(data.id);
        setUploadProgress(prev => ({ ...prev, [file.name]: false }));
      }
      
      return { uploadedIds, totalFiles };
    },
    onSuccess: (data) => {
      setCurrentReportIds(data.uploadedIds);
      toast({
        title: "Batch upload completed",
        description: `Successfully uploaded ${data.totalFiles} files. Ready for AI analysis.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/search'] });
      setUploadProgress({});
    },
    onError: (error: Error) => {
      toast({
        title: "Batch upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress({});
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

  const handleBatchUpload = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select one or more files to upload",
        variant: "destructive",
      });
      return;
    }

    batchUploadMutation.mutate(selectedFiles);
  };

  // Batch analysis for multiple reports
  const handleBatchAnalysis = async () => {
    if (currentReportIds.length === 0) {
      toast({
        title: "No uploaded files",
        description: "Please upload files first before triggering analysis",
        variant: "destructive",
      });
      return;
    }

    try {
      // Send all report IDs in a single batch request
      const result = await apiRequest('/api/analysis/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: currentReportIds }),
      });
      
      toast({
        title: "Batch analysis completed",
        description: result.message || `Successfully processed ${currentReportIds.length} reports`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/search'] });
    } catch (error) {
      toast({
        title: "Batch analysis failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const triggerAnalysis = () => {
    if (currentReportIds.length === 0) {
      toast({
        title: "No reports to analyze",
        description: "Please upload files first",
        variant: "destructive",
      });
      return;
    }
    
    handleBatchAnalysis();
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
            <Label htmlFor="file-upload">Select Loyverse Reports (PDF, CSV, Excel) - Multiple files supported</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.csv,.xlsx,.xls"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setSelectedFiles(files);
              }}
              className="mt-1"
            />
            {selectedFiles.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                Selected: {selectedFiles.length} file(s) - {selectedFiles.map(f => f.name).join(', ')}
              </div>
            )}
          </div>

          {/* Upload Progress Display */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="space-y-1">
              <Label>Upload Progress:</Label>
              {Object.entries(uploadProgress).map(([filename, isUploading]) => (
                <div key={filename} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${isUploading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
                  {filename} {isUploading ? 'uploading...' : 'completed'}
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              onClick={handleBatchUpload} 
              disabled={selectedFiles.length === 0 || batchUploadMutation.isPending}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {batchUploadMutation.isPending ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
            </Button>
            
            {currentReportIds.length > 0 && (
              <Button 
                onClick={triggerAnalysis} 
                disabled={currentReportIds.length === 0}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Bot className="h-4 w-4" />
                Batch Analyze ({currentReportIds.length} files)
              </Button>
            )}
          </div>

          {batchUploadMutation.isSuccess && currentReportIds.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                Files uploaded successfully ({currentReportIds.length} files). Click "Batch Analyze" to process.
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
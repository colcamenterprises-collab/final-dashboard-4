import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Calendar, FileText, Download, Eye, Trash2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

export function ShiftReports() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedReport, setSelectedReport] = useState<ShiftReport | null>(null);
  const { toast } = useToast();

  // Fetch shift reports
  const { data: reports = [], isLoading } = useQuery<ShiftReport[]>({
    queryKey: ['/api/shift-reports'],
  });

  // Search shift reports
  const { data: searchResults = [] } = useQuery<ShiftReport[]>({
    queryKey: ['/api/shift-reports/search', { q: searchQuery, status: statusFilter }],
    enabled: searchQuery.length > 0 || statusFilter.length > 0,
  });

  // Generate PDF mutation
  const generatePdfMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/shift-reports/${reportId}/generate-pdf`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "PDF Generated",
        description: "Shift report PDF has been generated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shift-reports'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate PDF report.",
        variant: "destructive",
      });
    }
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/shift-reports/${reportId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete report');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Report Deleted",
        description: "Shift report has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shift-reports'] });
      setSelectedReport(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete shift report.",
        variant: "destructive",
      });
    }
  });

  // Sync Loyverse data mutation
  const syncLoyverseMutation = useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate: string, endDate: string }) => {
      const response = await fetch(`/api/loyverse/shift-reports?start_date=${startDate}&end_date=${endDate}`);
      if (!response.ok) throw new Error('Failed to sync Loyverse data');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Loyverse Sync Complete",
        description: `Processed ${data.summary.total} shift reports. Complete: ${data.summary.complete}, Partial: ${data.summary.partial}, Manual Review: ${data.summary.manual_review}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shift-reports'] });
    },
    onError: () => {
      toast({
        title: "Sync Error",
        description: "Failed to sync Loyverse shift reports. Please check your API connection.",
        variant: "destructive",
      });
    }
  });

  // Handle Loyverse sync
  const handleSyncLoyverse = () => {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
    syncLoyverseMutation.mutate({ startDate, endDate });
  };

  const displayReports = searchQuery || statusFilter ? searchResults : reports;

  const getStatusBadge = (report: ShiftReport) => {
    switch (report.status) {
      case 'complete':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Complete</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Partial</Badge>;
      case 'manual_review':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Review Needed</Badge>;
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
        return <Badge className="bg-red-100 text-red-800 border-red-200">Mismatch</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">N/A</Badge>;
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-white min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shift Reports System</h1>
            <p className="text-muted-foreground">
              Side-by-side comparison of Daily Sales Forms and POS Shift Reports
            </p>
          </div>
          <Button 
            onClick={handleSyncLoyverse}
            disabled={syncLoyverseMutation.isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {syncLoyverseMutation.isPending ? 'Syncing...' : 'Sync Loyverse Data'}
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Reports Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed View</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Search and Filter Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Search & Filter</CardTitle>
                <CardDescription>Find specific shift reports by date or status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Input
                      placeholder="Search by date (YYYY-MM-DD)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Statuses</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="manual_review">Manual Review</SelectItem>
                        <SelectItem value="missing">Missing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <div className="col-span-3 text-center py-8">
                  <div className="text-muted-foreground">Loading shift reports...</div>
                </div>
              ) : displayReports.length === 0 ? (
                <div className="col-span-3 text-center py-8">
                  <div className="text-muted-foreground">No shift reports found.</div>
                </div>
              ) : (
                displayReports.map((report) => (
                  <Card key={report.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => setSelectedReport(report)}>
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
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>POS Shift Report</span>
                          {report.hasShiftReport ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Banking Check</span>
                          {getBankingBadge(report.bankingCheck)}
                        </div>
                      </div>
                      
                      {report.anomaliesDetected && report.anomaliesDetected.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-2">
                          <div className="text-sm text-red-800 font-medium">
                            {report.anomaliesDetected.length} Anomal{report.anomaliesDetected.length === 1 ? 'y' : 'ies'} Detected
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReport(report);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        
                        {report.pdfUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(report.pdfUrl, '_blank');
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              generatePdfMutation.mutate(report.id);
                            }}
                            disabled={generatePdfMutation.isPending}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Generate PDF
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="detailed" className="space-y-4">
            {selectedReport ? (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Shift Report Details - {selectedReport.reportDate}</CardTitle>
                      <CardDescription>
                        Complete analysis and comparison data
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {selectedReport.pdfUrl && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(selectedReport.pdfUrl, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteReportMutation.mutate(selectedReport.id)}
                        disabled={deleteReportMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Daily Sales Form Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        Daily Sales Form
                        {selectedReport.hasDailySales ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                      </h3>
                      
                      {selectedReport.hasDailySales ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-green-800">Daily Sales Form available and processed</p>
                          {/* Add detailed sales data here when available */}
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-red-800">No Daily Sales Form found for this date</p>
                        </div>
                      )}
                    </div>

                    {/* POS Shift Report Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        POS Shift Report
                        {selectedReport.hasShiftReport ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                      </h3>
                      
                      {selectedReport.hasShiftReport ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-green-800">POS Shift Report available and processed</p>
                          {/* Add detailed shift data here when available */}
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-red-800">No POS Shift Report found for this date</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Analysis Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Analysis Results</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground">Banking Check</p>
                            {getBankingBadge(selectedReport.bankingCheck)}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground">Status</p>
                            {getStatusBadge(selectedReport)}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground">Manual Review</p>
                            <Badge className={selectedReport.manualReviewNeeded ? 
                              "bg-red-100 text-red-800 border-red-200" : 
                              "bg-green-100 text-green-800 border-green-200"}>
                              {selectedReport.manualReviewNeeded ? "Required" : "Not Required"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {selectedReport.anomaliesDetected && selectedReport.anomaliesDetected.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-red-600">Anomalies Detected</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {selectedReport.anomaliesDetected.map((anomaly, index) => (
                              <li key={index} className="flex items-center gap-2 text-red-700">
                                <AlertCircle className="h-4 w-4" />
                                {anomaly}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Select a Shift Report</h3>
                    <p className="text-muted-foreground">
                      Choose a report from the overview tab to view detailed analysis
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
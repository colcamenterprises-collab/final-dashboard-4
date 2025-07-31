import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface ShiftReportData {
  id: number;
  reportDate: string;
  hasDailySales: boolean;
  hasShiftReport: boolean;
  salesData: {
    qrSales?: number;
    cashSales?: number;
    grabSales?: number;
    aroiDeeSales?: number;
    totalSales: number;
    totalExpenses?: number;
    bankedAmount?: number;
  } | null;
  shiftData: {
    receipts: number;
    shiftTotal: number;
    registerBalance: number;
    cashPayments?: number;
    qrPayments?: number;
    grabPayments?: number;
    aroiDeePayments?: number;
  } | null;
  status: string;
  bankingCheck?: string;
  anomaliesDetected: string[];
  manualReviewNeeded: boolean;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ShiftReportModalProps {
  reportId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function ShiftReportModal({ reportId, open, onClose }: ShiftReportModalProps) {
  const [reportData, setReportData] = useState<ShiftReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('useEffect triggered - open:', open, 'reportId:', reportId);
    if (open && reportId) {
      setLoading(true);
      setError(null);
      console.log('Fetching report data for ID:', reportId);
      fetch(`/api/shift-reports/${reportId}`)
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to load report');
          const data = await res.json();
          console.log('Report data loaded:', data);
          setReportData(data);
        })
        .catch((err) => {
          console.error('Error loading report:', err);
          setError('Failed to load shift report details.');
        })
        .finally(() => setLoading(false));
    }
  }, [open, reportId]);

  // Manual recheck mutation
  const recheckMutation = useMutation({
    mutationFn: async () => {
      if (!reportData) throw new Error('No report data');
      const response = await fetch(`/api/shift-reports/${reportData.id}/recheck`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to recheck report');
      return response.json();
    },
    onSuccess: (data) => {
      setReportData(data);
      toast({
        title: "Recheck Complete",
        description: "Shift report has been rechecked and updated with latest data.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shift-reports'] });
    },
    onError: () => {
      toast({
        title: "Recheck Failed",
        description: "Failed to recheck shift report. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Download PDF mutation
  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      if (!reportData) throw new Error('No report data');
      const response = await fetch(`/api/shift-reports/${reportData.id}/generate-pdf`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shift-report-${reportData.reportDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "PDF Downloaded",
        description: "Shift report PDF has been downloaded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Failed to download PDF report. Please try again.",
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
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

  // Debug logging
  console.log('ShiftReportModal render - open:', open, 'reportId:', reportId, 'reportData:', reportData);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      console.log('Dialog onOpenChange:', isOpen);
      if (!isOpen) onClose();
    }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Shift Report Details</span>
            {reportData && (
              <div className="flex items-center gap-2">
                {getStatusBadge(reportData.status)}
                {getBankingBadge(reportData.bankingCheck)}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">Loading shift report details...</div>
          </div>
        )}
        
        {/* Debug info */}
        {!reportData && !loading && !error && (
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">
              Debug: open={String(open)}, reportId={reportId || 'null'}
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center py-8">
            <div className="text-red-500">{error}</div>
          </div>
        )}

        {reportData && (
          <div className="space-y-6">
            {/* Header Information */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">{reportData.reportDate}</h2>
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(reportData.createdAt).toLocaleString()} | 
                  Updated: {new Date(reportData.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Daily Sales Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Daily Sales Form
                    {reportData.hasDailySales ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">Available</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 border-red-200">Missing</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reportData.salesData ? (
                    <>
                      <div className="space-y-2">
                        <h4 className="font-medium">Sales Summary</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Cash Sales:</div>
                          <div className="text-right">฿{reportData.salesData.cashSales?.toLocaleString() || 'N/A'}</div>
                          <div>QR Sales:</div>
                          <div className="text-right">฿{reportData.salesData.qrSales?.toLocaleString() || 'N/A'}</div>
                          <div>Grab Sales:</div>
                          <div className="text-right">฿{reportData.salesData.grabSales?.toLocaleString() || 'N/A'}</div>
                          <div>Aroi Dee Sales:</div>
                          <div className="text-right">฿{reportData.salesData.aroiDeeSales?.toLocaleString() || 'N/A'}</div>
                          <Separator className="col-span-2" />
                          <div className="font-medium">Total Sales:</div>
                          <div className="text-right font-medium">฿{reportData.salesData.totalSales?.toLocaleString()}</div>
                          <div className="text-blue-600 bg-blue-50 col-span-2 p-2 rounded mt-2">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="font-medium">Expected Banked (Cash + QR):</div>
                              <div className="text-right font-medium">
                                ฿{((reportData.salesData.cashSales || 0) + (reportData.salesData.qrSales || 0)).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {reportData.salesData.totalExpenses && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Expenses</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Total Expenses:</div>
                            <div className="text-right">฿{reportData.salesData.totalExpenses.toLocaleString()}</div>
                          </div>
                        </div>
                      )}

                      {reportData.salesData.bankedAmount && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Banking</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Banked Amount:</div>
                            <div className="text-right">฿{reportData.salesData.bankedAmount.toLocaleString()}</div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No Daily Sales Form found for this date
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right Column: POS Shift Report */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    POS Shift Report
                    {reportData.hasShiftReport ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">Available</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 border-red-200">Missing</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reportData.shiftData ? (
                    <>
                      <div className="space-y-2">
                        <h4 className="font-medium">Shift Summary</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Total Receipts:</div>
                          <div className="text-right">{reportData.shiftData.receipts}</div>
                          <div>Shift Total:</div>
                          <div className="text-right">฿{reportData.shiftData.shiftTotal?.toLocaleString()}</div>
                          <div>Register Balance:</div>
                          <div className="text-right">฿{reportData.shiftData.registerBalance?.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">Payment Breakdown</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Cash Payments:</div>
                          <div className="text-right">฿{reportData.shiftData.cashPayments?.toLocaleString() || 'N/A'}</div>
                          <div>QR Payments:</div>
                          <div className="text-right">฿{reportData.shiftData.qrPayments?.toLocaleString() || 'N/A'}</div>
                          <div>Grab Payments:</div>
                          <div className="text-right">฿{reportData.shiftData.grabPayments?.toLocaleString() || 'N/A'}</div>
                          <div>Aroi Dee Payments:</div>
                          <div className="text-right">฿{reportData.shiftData.aroiDeePayments?.toLocaleString() || 'N/A'}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No POS Shift Report found for this date
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Anomalies Section */}
            {reportData.anomaliesDetected && reportData.anomaliesDetected.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Anomalies Detected</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                    {reportData.anomaliesDetected.map((anomaly, index) => (
                      <li key={index}>{anomaly}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Review Notes */}
            {reportData.reviewNotes && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{reportData.reviewNotes}</p>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => recheckMutation.mutate()}
                disabled={recheckMutation.isPending}
              >
                {recheckMutation.isPending ? 'Rechecking...' : 'Manual Recheck'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => downloadPdfMutation.mutate()}
                disabled={downloadPdfMutation.isPending}
              >
                {downloadPdfMutation.isPending ? 'Generating...' : 'Download PDF'}
              </Button>
              <Button onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
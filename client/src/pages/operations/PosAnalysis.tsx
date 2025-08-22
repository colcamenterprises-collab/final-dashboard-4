import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Upload, Eye } from 'lucide-react';
import { ReceiptsViewer } from '@/components/pos/ReceiptsViewer';

type ShiftAnalysis = {
  batchId: string;
  window: { start?: string; end?: string };
  staffForm: {
    salesId?: string;
    totalSales: number;
    totalExpenses: number;
    bankCash: number;
    bankQr: number;
    closingCash: number;
  };
  pos: {
    netSales: number;
    receiptCount: number;
    payments: Record<string, number>;
    cashSales: number;
    qrSales: number;
  };
  variances: {
    totalSalesDiff: number;
    bankCashVsCashSales: number;
    bankQrVsQrSales: number;
  };
  flags: string[];
};

const formatTHB = (amount: number) => 
  new Intl.NumberFormat('th-TH', { 
    style: 'currency', 
    currency: 'THB', 
    maximumFractionDigits: 0 
  }).format(amount || 0);

export default function PosAnalysis() {
  const [batchId, setBatchId] = useState('');
  const [activeView, setActiveView] = useState<'upload' | 'analysis' | 'receipts'>('upload');
  
  const { data: analysisData, isLoading, error } = useQuery({
    queryKey: ['/api/pos/analysis/shift', batchId],
    queryFn: () => fetch(`/api/pos/analysis/shift?batchId=${batchId}`).then(res => res.json()),
    enabled: !!batchId && activeView === 'analysis',
  });

  const handleUpload = async (formData: FormData) => {
    try {
      const response = await fetch('/api/pos/upload-bundle', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      if (result.ok) {
        setBatchId(result.batchId);
        setActiveView('analysis');
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const analysis: ShiftAnalysis | null = analysisData?.report || null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">POS Integration & Analysis</h1>
          <p className="text-muted-foreground">
            Upload POS data and reconcile with staff forms
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant={activeView === 'upload' ? 'default' : 'outline'} 
            onClick={() => setActiveView('upload')}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <Button 
            variant={activeView === 'analysis' ? 'default' : 'outline'} 
            onClick={() => setActiveView('analysis')}
            disabled={!batchId}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Analysis
          </Button>
          <Button 
            variant={activeView === 'receipts' ? 'default' : 'outline'} 
            onClick={() => setActiveView('receipts')}
            disabled={!batchId}
          >
            <Eye className="w-4 h-4 mr-2" />
            Receipts
          </Button>
        </div>
      </div>

      {activeView === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload POS Data Bundle</CardTitle>
            <CardDescription>
              Upload CSV exports from your POS system for analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Batch Title</label>
                <Input placeholder="e.g., Evening Shift - Nov 20" />
              </div>
              <div>
                <label className="text-sm font-medium">Batch ID</label>
                <Input 
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  placeholder="Enter batch ID to analyze"
                />
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Upload your POS CSV files (receipts, shift report, sales by item/modifier/payment)
              and they will be parsed into the database for reconciliation analysis.
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'analysis' && batchId && (
        <div className="space-y-6">
          {isLoading && (
            <Card>
              <CardContent className="py-8 text-center">
                <p>Analyzing shift data...</p>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card>
              <CardContent className="py-8 text-center text-red-600">
                <p>Error loading analysis: {error.message}</p>
              </CardContent>
            </Card>
          )}

          {analysis && (
            <>
              {/* Analysis Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {analysis.flags.length === 0 ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      )}
                      Shift Reconciliation Summary
                    </CardTitle>
                    <Badge variant={analysis.flags.length === 0 ? 'default' : 'destructive'}>
                      {analysis.flags.length === 0 ? 'BALANCED' : `${analysis.flags.length} FLAGS`}
                    </Badge>
                  </div>
                  <CardDescription>
                    Batch: {analysis.batchId} | Window: {analysis.window.start ? 
                      `${new Date(analysis.window.start).toLocaleString()} - ${new Date(analysis.window.end || '').toLocaleString()}` : 
                      'No window specified'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analysis.flags.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h4 className="font-medium text-red-600">Discrepancies Found:</h4>
                      <ul className="space-y-1">
                        {analysis.flags.map((flag, index) => (
                          <li key={index} className="text-sm text-red-600 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Staff Form Data</CardTitle>
                    <CardDescription>From daily sales submission</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Sales:</span>
                      <span className="font-mono">{formatTHB(analysis.staffForm.totalSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Expenses:</span>
                      <span className="font-mono">{formatTHB(analysis.staffForm.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash Banked:</span>
                      <span className="font-mono">{formatTHB(analysis.staffForm.bankCash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>QR Banked:</span>
                      <span className="font-mono">{formatTHB(analysis.staffForm.bankQr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Closing Cash:</span>
                      <span className="font-mono">{formatTHB(analysis.staffForm.closingCash)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>POS System Data</CardTitle>
                    <CardDescription>{analysis.pos.receiptCount} receipts processed</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Net Sales:</span>
                      <span className="font-mono">{formatTHB(analysis.pos.netSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash Sales:</span>
                      <span className="font-mono">{formatTHB(analysis.pos.cashSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>QR Sales:</span>
                      <span className="font-mono">{formatTHB(analysis.pos.qrSales)}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Payment Breakdown:</span>
                      {Object.entries(analysis.pos.payments).map(([method, amount]) => (
                        <div key={method} className="flex justify-between text-sm pl-4">
                          <span>{method}:</span>
                          <span className="font-mono">{formatTHB(amount)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {activeView === 'receipts' && batchId && (
        <ReceiptsViewer batchId={batchId} />
      )}
    </div>
  );
}
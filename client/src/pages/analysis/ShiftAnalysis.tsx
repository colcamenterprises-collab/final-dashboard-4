import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Search } from 'lucide-react';

type ShiftAnalysis = {
  batch: {
    id: string;
    window: { start?: string; end?: string };
  };
  staff: {
    salesId?: string;
    totalSales: number;
    totalExpenses: number;
    bankCash: number;
    bankQr: number;
    closingCash: number;
    rolls?: number;
    meat?: number;
  };
  pos: {
    netSales: number;
    receiptCount: number;
    methodBreakdown: Record<string, number>;
    cashSales: number;
    qrSales: number;
  };
  variances: {
    totalSales: number;
    bankCash: number;
    bankQr: number;
  };
  flags: string[];
};

const formatTHB = (amount: number) => 
  new Intl.NumberFormat('th-TH', { 
    style: 'currency', 
    currency: 'THB', 
    maximumFractionDigits: 0 
  }).format(amount || 0);

export default function ShiftAnalysis() {
  const [batchId, setBatchId] = useState('');
  
  const { data: analysisData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/pos/analysis/shift', batchId],
    queryFn: () => fetch(`/api/pos/${batchId}/analyze`).then(res => res.json()),
    enabled: false, // Manual trigger
  });

  const analysis: ShiftAnalysis | null = analysisData || null;

  const handleAnalyze = () => {
    if (batchId) {
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Shift Reconciliation Analysis
          </CardTitle>
          <CardDescription>
            Compare POS data with staff forms to identify discrepancies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="Enter batch ID to analyze"
              className="flex-1"
            />
            <Button onClick={handleAnalyze} disabled={!batchId || isLoading}>
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                Batch: {analysis.batch.id} | Window: {analysis.batch.window.start ? 
                  `${new Date(analysis.batch.window.start).toLocaleString()} - ${new Date(analysis.batch.window.end || '').toLocaleString()}` : 
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
                  <span className="font-mono">{formatTHB(analysis.staff.totalSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Expenses:</span>
                  <span className="font-mono">{formatTHB(analysis.staff.totalExpenses)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Banked:</span>
                  <span className="font-mono">{formatTHB(analysis.staff.bankCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span>QR Banked:</span>
                  <span className="font-mono">{formatTHB(analysis.staff.bankQr)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Closing Cash:</span>
                  <span className="font-mono">{formatTHB(analysis.staff.closingCash)}</span>
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
                  {Object.entries(analysis.pos.methodBreakdown).map(([method, amount]) => (
                    <div key={method} className="flex justify-between text-sm pl-4">
                      <span>{method}:</span>
                      <span className="font-mono">{formatTHB(Number(amount))}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Upload, TrendingUp, AlertTriangle, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const Analysis = () => {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(startDate);
  const { toast } = useToast();
  const location = useLocation();
  
  // Check if we're on the main analysis route (not a nested route)
  const isMainRoute = location.pathname === '/operations/analysis';

  // Jussi Daily Report State
  const [jussiData, setJussiData] = useState<any>(null);
  
  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/jussi/latest");
      const json = await res.json();
      setJussiData(json.data);
    }
    fetchData();
  }, []);

  // Fort Knox pre-sets for quick date selection
  const preSets = [
    { label: 'Today', start: new Date().toISOString().slice(0,10), end: new Date().toISOString().slice(0,10) },
    { label: 'Last 7 Days', start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0,10), end: new Date().toISOString().slice(0,10) },
    { label: 'MTD', start: new Date().toISOString().slice(0,7) + '-01', end: new Date().toISOString().slice(0,10) }
  ];

  // Stats query for dashboard cards using existing endpoints
  const { data: stats } = useQuery({
    queryKey: ['analysisStats', startDate, endDate],
    queryFn: () => axios.get('/api/operations/stats').then(res => res.data)
  });

  // Get last shift data for accurate KPIs
  const { data: lastShiftData } = useQuery({
    queryKey: ['lastShiftData'],
    queryFn: async () => {
      // Get recent shifts (last 3 days) to find the actual last shift
      const last3Days = new Date();
      last3Days.setDate(last3Days.getDate() - 3);
      const startDateStr = last3Days.toISOString().slice(0,10);
      const endDateStr = new Date().toISOString().slice(0,10);
      
      const shifts = await axios.get(`/api/loyverse/shifts?startDate=${startDateStr}&endDate=${endDateStr}`).then(res => res.data);
      const receipts = await axios.get(`/api/loyverse/receipts?startDate=${startDateStr}&endDate=${endDateStr}`).then(res => res.data);
      
      // Find actual last shift (most recent by date/time)
      const sortedShifts = shifts?.shifts?.sort((a: any, b: any) => {
        const dateA = new Date(a.closed_at || a.opened_at).getTime();
        const dateB = new Date(b.closed_at || b.opened_at).getTime();
        return dateB - dateA; // Descending order (most recent first)
      });
      
      const lastShift = sortedShifts?.[0];
      const lastShiftReceipts = lastShift ? receipts?.receipts?.filter((r: any) => {
        // Use closed_at for payment time, falling back to created_at
        const receiptTime = new Date(r.closed_at || r.created_at).getTime();
        const shiftStart = new Date(lastShift.opened_at).getTime();
        const shiftEnd = new Date(lastShift.closed_at || Date.now()).getTime();
        return receiptTime >= shiftStart && receiptTime <= shiftEnd;
      }) : [];
      
      // Filter anomalies to only the last shift time window
      const lastShiftAnomalies = lastShift && shifts?.anomalies ? shifts.anomalies.filter((anomaly: any) => {
        const anomalyTime = new Date(anomaly.timestamp || anomaly.created_at).getTime();
        const shiftStart = new Date(lastShift.opened_at).getTime();
        const shiftEnd = new Date(lastShift.closed_at || Date.now()).getTime();
        return anomalyTime >= shiftStart && anomalyTime <= shiftEnd;
      }) : [];
      
      return { lastShift, lastShiftReceipts, lastShiftAnomalies, allShifts: shifts, allReceipts: receipts };
    }
  });

  // MTD Loyverse aggregates
  const { data: loyverseMtdData } = useQuery({
    queryKey: ['loyverseMtdData'],
    queryFn: async () => {
      const now = new Date();
      const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
      const mtdEnd = now.toISOString().slice(0,10);
      
      const shifts = await axios.get(`/api/loyverse/shifts?startDate=${mtdStart}&endDate=${mtdEnd}`).then(res => res.data);
      const receipts = await axios.get(`/api/loyverse/receipts?startDate=${mtdStart}&endDate=${mtdEnd}`).then(res => res.data);
      
      // Calculate MTD net from Loyverse data
      const mtdNet = shifts?.shifts?.reduce((sum: number, shift: any) => {
        return sum + (parseFloat(shift.net_sales) || 0);
      }, 0) || 0;
      
      return { mtdNet, mtdShifts: shifts, mtdReceipts: receipts };
    }
  });

  // Upload mutation for Loyverse reports (existing /api/analysis/upload)
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/analysis/upload', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Report Uploaded", 
        description: data.message || "Loyverse report uploaded and parsed by Jussi AI" 
      });
    },
    onError: () => {
      toast({ 
        title: "Upload Failed", 
        description: "Failed to upload Loyverse report", 
        variant: "destructive" 
      });
    }
  });

  const uploadLoyverseReport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleUploadClick = () => {
    document.getElementById('loyverse-file-upload')?.click();
  };

  return (
    <div className="p-6 space-y-6" data-testid="analysis-page">
      {/* Header - Show only on main route */}
      {isMainRoute && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analysis Dashboard</h1>
          <p className="text-gray-600">Live POS analytics and reporting for restaurant operations</p>
        </div>
      )}

      {/* 🚨 Fort Knox: Always show Jussi report at top of Analysis page */}
      {isMainRoute && (
        <div className="mb-6 border rounded-lg p-4 bg-gray-100">
          <h2 className="text-xl font-semibold">
            Jussi Daily Report – {new Date().toISOString().slice(0,10)}
          </h2>
          {jussiData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {/* Top 5 Items */}
            <div>
              <h3 className="font-semibold mt-2 mb-2">Top 5 Items</h3>
              <table className="w-full text-sm border border-gray-300">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-300 px-2 py-1 text-left">Item</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {jussiData.top5Items?.map((i: any, idx: number) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-2 py-1">{i.item}</td>
                      <td className="border border-gray-300 px-2 py-1">{i.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Payment Breakdown */}
            <div>
              <h3 className="font-semibold mt-2 mb-2">Payment Breakdown</h3>
              <table className="w-full text-sm border border-gray-300">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-300 px-2 py-1 text-left">Method</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {jussiData.paymentBreakdown?.map((p: any, idx: number) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-2 py-1">{p.method}</td>
                      <td className="border border-gray-300 px-2 py-1">{p.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Stock Variances */}
            <div>
              <h3 className="font-semibold mt-2 mb-2">Stock Variances</h3>
              <table className="w-full text-sm border border-gray-300">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-gray-300 px-2 py-1 text-left">Item</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">Expected</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">Actual</th>
                    <th className="border border-gray-300 px-2 py-1 text-left">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {jussiData.variances?.stockUsage?.map((s: any, idx: number) => (
                    <tr key={idx} className={s.status === "🚨" ? "text-red-600" : ""}>
                      <td className="border border-gray-300 px-2 py-1">{s.item}</td>
                      <td className="border border-gray-300 px-2 py-1">{s.expected}</td>
                      <td className="border border-gray-300 px-2 py-1">{s.actual}</td>
                      <td className="border border-gray-300 px-2 py-1">{s.variance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Flags */}
            {jussiData.flags && jussiData.flags.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mt-2 mb-2">🚨 Flags</h3>
                <ul className="text-red-600 text-sm list-disc list-inside">
                  {jussiData.flags.map((f: string, idx: number) => <li key={idx}>{f}</li>)}
                </ul>
              </div>
            )}
          </div>
          ) : (
            <p className="text-sm text-gray-500 mt-4">No Jussi report available yet.</p>
          )}
        </div>
      )}

      {/* Date Range and Pre-sets - Show only on main route */}
      {isMainRoute && (
        <Card className="bg-white p-4 rounded shadow">
          <CardHeader>
            <CardTitle>Date Range Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div>
                <Label htmlFor="start-date">From</Label>
                <Input 
                  id="start-date"
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label htmlFor="end-date">To</Label>
                <Input 
                  id="end-date"
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            {/* Fort Knox Pre-sets */}
            <div className="flex space-x-2">
              {preSets.map(p => (
                <Button 
                  key={p.label}
                  variant="outline"
                  onClick={() => { 
                    setStartDate(p.start); 
                    setEndDate(p.end); 
                  }}
                  data-testid={`button-preset-${p.label.toLowerCase().replace(/\s+/g, '-')}`}
                > 
                  {p.label} 
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Summary Stats Cards (Sleek Tailwind styling) - Show only on main route */}
      {isMainRoute && (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-white p-4 rounded shadow">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-gray-600">Receipts Last Shift</Label>
                <div className="text-2xl font-bold" data-testid="card-receipts-last">
                  {lastShiftData?.lastShiftReceipts?.length || 0}
                </div>
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white p-4 rounded shadow">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-gray-600">Gross Last Shift</Label>
                <div className="text-2xl font-bold" data-testid="card-gross-last">
                  ฿{lastShiftData?.lastShift?.gross_sales || '0.00'}
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white p-4 rounded shadow">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-gray-600">Net MTD</Label>
                <div className="text-2xl font-bold" data-testid="card-net-mtd">
                  ฿{loyverseMtdData?.mtdNet?.toFixed(2) || '0.00'}
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white p-4 rounded shadow">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-gray-600">Anomalies</Label>
                <Badge variant="destructive" className="text-lg" data-testid="card-anomalies">
                  {lastShiftData?.lastShiftAnomalies?.length ?? 0}
                </Badge>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Upload Section - Show only on main route */}
      {isMainRoute && (
        <Card className="bg-white p-4 rounded shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Loyverse Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Input 
                id="loyverse-file-upload"
                type="file" 
                onChange={uploadLoyverseReport}
                accept=".csv,.xlsx,.json"
                disabled={uploadMutation.isPending}
                data-testid="input-upload-file"
              />
              <Button 
                onClick={handleUploadClick}
                disabled={uploadMutation.isPending} 
                data-testid="button-upload"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadMutation.isPending ? "Processing with Jussi AI..." : "Upload & Analyze"}
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Upload Loyverse reports for AI analysis, storage, and variance detection
            </p>
          </CardContent>
        </Card>
      )}

      {/* Analysis Modules - Show only on main route */}
      {isMainRoute && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white rounded shadow hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Loyverse Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Live receipts, items/modifiers sold, shifts data, and variance analysis from POS system.
              </p>
              <Link to="/operations/analysis/loyverse">
                <Button className="w-full" data-testid="button-loyverse-module">
                  View Live Receipts & Data
                </Button>
              </Link>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Outlet for nested routes */}
      <Outlet />
    </div>
  );
};
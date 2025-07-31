import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface ShiftReport {
  id: string;
  reportDate: string;
  status: string;
  salesData?: {
    cashSales?: number;
    qrSales?: number;
    grabSales?: number;
    aroiDeeSales?: number;
    totalSales?: number;
  };
  shiftData?: {
    registerBalance?: number;
    startingCash?: number;
    endingCash?: number;
  };
  anomalies?: string[];
  bankingDiff?: number;
}

export default function ShiftReportDetail() {
  const { date } = useParams();
  const [, setLocation] = useLocation();
  
  const { data: report, isLoading, error } = useQuery<ShiftReport>({
    queryKey: ['/api/shift-reports', date],
    queryFn: async () => {
      if (!date) throw new Error('No date provided');
      const response = await fetch(`/api/shift-reports?date=${encodeURIComponent(date)}`);
      if (!response.ok) throw new Error('Failed to fetch shift report');
      const reports = await response.json();
      return reports.find((r: ShiftReport) => r.reportDate === date) || null;
    },
    enabled: !!date
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="text-gray-500">Loading shift report...</div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6">
        <Card className="restaurant-card">
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Report Not Found</h2>
              <p className="text-gray-600 mb-4">No shift report found for {date}</p>
              <Button onClick={() => setLocation('/reports-analysis?tab=analysis')}>
                Back to Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (amount?: number) => {
    if (amount == null || isNaN(amount)) return 'N/A';
    return `฿${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const bankingDiff = report.bankingDiff || 0;
  const isBalanced = Math.abs(bankingDiff) <= 50;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Report Details</h1>
          <p className="text-gray-600">Report for {formatDate(report.reportDate)}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setLocation('/reports-analysis?tab=analysis')}
        >
          Back to Analysis
        </Button>
      </div>

      {/* Status Overview */}
      <Card className="restaurant-card">
        <CardHeader>
          <CardTitle>Balance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
            isBalanced 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isBalanced ? 'Balanced' : 'Requires Attention'}
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-gray-900">
              Banking Difference: {formatCurrency(bankingDiff)}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {isBalanced ? 'Within acceptable range (±฿50)' : 'Exceeds acceptable range (±฿50)'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sales Information */}
      {report.salesData && (
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle>Sales Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Cash Sales</div>
                <div className="font-semibold">{formatCurrency(report.salesData.cashSales)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">QR Sales</div>
                <div className="font-semibold">{formatCurrency(report.salesData.qrSales)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Grab Sales</div>
                <div className="font-semibold">{formatCurrency(report.salesData.grabSales)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Aroi Dee Sales</div>
                <div className="font-semibold">{formatCurrency(report.salesData.aroiDeeSales)}</div>
              </div>
              <div className="md:col-span-2 lg:col-span-1">
                <div className="text-sm text-gray-600">Total Sales</div>
                <div className="font-semibold text-lg">{formatCurrency(report.salesData.totalSales)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Register Information */}
      {report.shiftData && (
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle>Register Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Starting Cash</div>
                <div className="font-semibold">{formatCurrency(report.shiftData.startingCash)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Ending Cash</div>
                <div className="font-semibold">{formatCurrency(report.shiftData.endingCash)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Register Balance</div>
                <div className="font-semibold">{formatCurrency(report.shiftData.registerBalance)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anomalies */}
      {report.anomalies && report.anomalies.length > 0 && (
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle>Detected Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.anomalies.map((anomaly, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="text-sm text-gray-700">{anomaly}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, TrendingUp, AlertTriangle, CheckCircle, XCircle, BarChart3, Package, Users, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LoyverseData {
  shiftInfo: {
    reportId: string;
    shiftDate: string;
    shiftStart: string;
    shiftEnd: string;
    totalSales: string;
    totalReceipts: number;
  };
  items: Array<{
    name: string;
    quantity: number;
    totalSales: number;
  }>;
  modifiers: Array<{
    name: string;
    option: string;
    count: number;
    totalAmount: number;
  }>;
  summary: {
    totalUniqueItems: number;
    totalUniqueModifiers: number;
    totalItemsSold: number;
    totalModifiersUsed: number;
  };
}

interface StaffFormData {
  id: number;
  completedBy: string;
  shiftType: string;
  shiftDate: string;
  totalSales: string;
  cashSales: string;
  grabSales: string;
  foodPandaSales: string;
  aroiDeeSales: string;
  qrScanSales: string;
  burgerBunsStock: string;
  rollsOrderedCount: string;
  burgerMeatStock: string;
  cokeStock: string;
  cokeZeroStock: string;
  spriteStock: string;
  createdAt: string;
}

export default function Analysis() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Fetch Loyverse data for last completed shift
  const { data: loyverseData, isLoading: loyverseLoading } = useQuery<LoyverseData>({
    queryKey: ['/api/loyverse/last-shift-inventory'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch staff form data for selected date
  const { data: staffFormData, isLoading: staffFormLoading } = useQuery<StaffFormData[]>({
    queryKey: ['/api/daily-stock-sales/search', selectedDate],
    enabled: !!selectedDate,
  });

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `฿${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      timeZone: 'Asia/Bangkok',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVarianceStatus = (loyverse: number, staff: number, tolerance: number = 0.05) => {
    const variance = Math.abs(loyverse - staff) / loyverse;
    if (variance <= tolerance) return 'match';
    if (variance <= 0.1) return 'warning';
    return 'error';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'match':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'match':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  const currentStaffForm = staffFormData?.[0];
  const loyverseSales = loyverseData ? parseFloat(loyverseData.shiftInfo.totalSales) : 0;
  const staffSales = currentStaffForm ? parseFloat(currentStaffForm.totalSales) : 0;
  const salesVarianceStatus = getVarianceStatus(loyverseSales, staffSales);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Daily Operations Analysis
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Compare Loyverse POS data with staff form reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600"
          />
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate AI Analysis
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Data Status</p>
                <p className="text-lg font-semibold">
                  {loyverseData && currentStaffForm ? 'Complete' : 'Partial'}
                </p>
              </div>
              <div className="text-blue-500">
                {loyverseData && currentStaffForm ? 
                  <CheckCircle className="h-6 w-6" /> : 
                  <AlertTriangle className="h-6 w-6" />
                }
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Sales Variance</p>
                <p className="text-lg font-semibold">
                  {salesVarianceStatus === 'match' ? 'Match' : 
                   salesVarianceStatus === 'warning' ? 'Minor' : 'Major'}
                </p>
              </div>
              <div>
                {getStatusIcon(salesVarianceStatus)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Items Tracked</p>
                <p className="text-lg font-semibold">
                  {loyverseData?.summary.totalUniqueItems || 0}
                </p>
              </div>
              <Package className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Staff Reports</p>
                <p className="text-lg font-semibold">
                  {staffFormData?.length || 0}
                </p>
              </div>
              <Users className="h-6 w-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loyverse Column */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Loyverse POS Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loyverseLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                <div className="h-4 bg-gray-300 rounded w-full"></div>
              </div>
            ) : loyverseData ? (
              <>
                {/* Shift Summary */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Shift Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Total Sales</p>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(loyverseData.shiftInfo.totalSales)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Total Orders</p>
                      <p className="font-semibold">{loyverseData.shiftInfo.totalReceipts}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Items Sold</p>
                      <p className="font-semibold">{loyverseData.summary.totalItemsSold}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Modifiers Used</p>
                      <p className="font-semibold">{loyverseData.summary.totalModifiersUsed}</p>
                    </div>
                  </div>
                </div>

                {/* Top Items */}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Top Items Sold
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {loyverseData.items.slice(0, 8).map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.quantity} sold</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(item.totalSales)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Modifiers */}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Key Modifiers
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {loyverseData.modifiers.filter(mod => mod.count > 1).slice(0, 5).map((modifier, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{modifier.option}</span>
                        <Badge variant="secondary">{modifier.count}x</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No Loyverse data available for analysis.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Staff Form Column */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Staff Form Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {staffFormLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                <div className="h-4 bg-gray-300 rounded w-full"></div>
              </div>
            ) : currentStaffForm ? (
              <>
                {/* Staff Summary */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    Staff Report Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Completed By</p>
                      <p className="font-semibold">{currentStaffForm.completedBy}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Shift Type</p>
                      <p className="font-semibold">{currentStaffForm.shiftType}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Reported Sales</p>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(currentStaffForm.totalSales)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Submitted</p>
                      <p className="font-semibold text-xs">
                        {formatDateTime(currentStaffForm.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sales Breakdown */}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Sales Breakdown
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="font-medium text-sm">Cash Sales</span>
                      <span className="font-semibold text-sm">{formatCurrency(currentStaffForm.cashSales)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="font-medium text-sm">Grab Sales</span>
                      <span className="font-semibold text-sm">{formatCurrency(currentStaffForm.grabSales)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="font-medium text-sm">FoodPanda Sales</span>
                      <span className="font-semibold text-sm">{formatCurrency(currentStaffForm.foodPandaSales)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="font-medium text-sm">QR Scan Sales</span>
                      <span className="font-semibold text-sm">{formatCurrency(currentStaffForm.qrScanSales)}</span>
                    </div>
                  </div>
                </div>

                {/* Stock Levels */}
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Stock Levels Reported
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Burger Buns</span>
                      <Badge variant="outline">{currentStaffForm.burgerBunsStock}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Rolls Ordered</span>
                      <Badge variant="outline">{currentStaffForm.rollsOrderedCount}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Burger Meat</span>
                      <Badge variant="outline">{currentStaffForm.burgerMeatStock}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Coke Stock</span>
                      <Badge variant="outline">{currentStaffForm.cokeStock}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium">Coke Zero Stock</span>
                      <Badge variant="outline">{currentStaffForm.cokeZeroStock}</Badge>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No staff form data available for {selectedDate}.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Analysis */}
      {loyverseData && currentStaffForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-500" />
              Variance Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sales Comparison */}
              <div className={`p-4 rounded-lg border-2 ${getStatusColor(salesVarianceStatus)}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Sales Comparison</h4>
                  {getStatusIcon(salesVarianceStatus)}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Loyverse POS:</span>
                    <span className="font-semibold">{formatCurrency(loyverseSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Staff Report:</span>
                    <span className="font-semibold">{formatCurrency(staffSales)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span>Difference:</span>
                    <span className={`font-semibold ${loyverseSales > staffSales ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(loyverseSales - staffSales))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Item Analysis */}
              <div className="p-4 rounded-lg border-2 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                <h4 className="font-semibold mb-2">Item Analysis</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Unique Items:</span>
                    <span className="font-semibold">{loyverseData.summary.totalUniqueItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Sold:</span>
                    <span className="font-semibold">{loyverseData.summary.totalItemsSold}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg per Order:</span>
                    <span className="font-semibold">
                      {(loyverseData.summary.totalItemsSold / loyverseData.shiftInfo.totalReceipts).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stock Analysis */}
              <div className="p-4 rounded-lg border-2 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <h4 className="font-semibold mb-2">Stock Analysis</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Burger Buns:</span>
                    <span className="font-semibold">{currentStaffForm.burgerBunsStock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rolls Ordered:</span>
                    <span className="font-semibold">{currentStaffForm.rollsOrderedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Meat Stock:</span>
                    <span className="font-semibold">{currentStaffForm.burgerMeatStock}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
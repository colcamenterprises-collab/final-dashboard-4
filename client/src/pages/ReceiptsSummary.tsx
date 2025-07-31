import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, DollarSign, Receipt, Utensils, Plus } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

interface ReceiptsSummaryData {
  summary: {
    totalReceipts: number;
    grossSales: number;
    netSales: number;
    paymentTypes: Record<string, number>;
    itemsSold: Record<string, number>;
    modifiersSold: Record<string, number>;
    refunds: Array<{
      receipt_number: string;
      time: string;
      amount: number;
      reason: string;
    }>;
  };
  shiftStart: string;
  shiftEnd: string;
  shiftDate: string;
}

export default function ReceiptsSummary() {
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Query current shift receipts summary
  const { data: currentShiftData, isLoading: currentLoading } = useQuery<ReceiptsSummaryData>({
    queryKey: ['/api/receipts/summary'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Query specific date receipts summary when date is selected
  const { data: dateShiftData, isLoading: dateLoading } = useQuery<ReceiptsSummaryData>({
    queryKey: ['/api/receipts/summary', selectedDate],
    enabled: !!selectedDate,
  });

  const displayData = selectedDate ? dateShiftData : currentShiftData;
  const isLoading = selectedDate ? dateLoading : currentLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatShiftTime = (isoString: string) => {
    return format(new Date(isoString), 'PPp');
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Receipts Summary</h1>
        </div>
        <div className="text-center py-12">Loading receipts data...</div>
      </div>
    );
  }

  if (!displayData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Receipts Summary</h1>
        </div>
        <div className="text-center py-12">No data available</div>
      </div>
    );
  }

  const { summary, shiftStart, shiftEnd, shiftDate } = displayData;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Receipts Summary</h1>
          <p className="text-gray-600">
            Shift: {formatShiftTime(shiftStart)} - {formatShiftTime(shiftEnd)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
          {selectedDate && (
            <Button
              variant="outline"
              onClick={() => setSelectedDate('')}
              size="sm"
            >
              Current Shift
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
            <Receipt className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalReceipts}</div>
            <p className="text-xs text-gray-600">
              {selectedDate ? `Date: ${selectedDate}` : 'Current shift'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.grossSales)}</div>
            <p className="text-xs text-gray-600">Before deductions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.netSales)}</div>
            <p className="text-xs text-gray-600">After deductions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refunds</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.refunds.length}</div>
            <p className="text-xs text-gray-600">
              {summary.refunds.length > 0 
                ? `${formatCurrency(summary.refunds.reduce((sum, r) => sum + r.amount, 0))} total`
                : 'No refunds'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(summary.paymentTypes).length > 0 ? (
              Object.entries(summary.paymentTypes)
                .sort(([,a], [,b]) => b - a)
                .map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between">
                    <span className="font-medium">{method}</span>
                    <Badge variant="secondary">{count} receipts</Badge>
                  </div>
                ))
            ) : (
              <p className="text-gray-500 text-center py-4">No payment data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Items Sold */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Top Items Sold
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(summary.itemsSold).length > 0 ? (
              Object.entries(summary.itemsSold)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8)
                .map(([item, quantity]) => (
                  <div key={item} className="flex items-center justify-between">
                    <span className="font-medium truncate">{item}</span>
                    <Badge variant="outline">{quantity} sold</Badge>
                  </div>
                ))
            ) : (
              <p className="text-gray-500 text-center py-4">No items data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modifiers Section */}
      {Object.entries(summary.modifiersSold).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Popular Modifiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(summary.modifiersSold)
                .sort(([,a], [,b]) => b - a)
                .map(([modifier, count]) => (
                  <div key={modifier} className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="font-semibold text-lg">{count}</div>
                    <div className="text-sm text-gray-600 truncate">{modifier}</div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refunds Section */}
      {summary.refunds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Refunds & Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.refunds.map((refund, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Receipt #{refund.receipt_number}</div>
                    <div className="text-sm text-gray-600">{refund.reason}</div>
                    <div className="text-xs text-gray-500">{refund.time}</div>
                  </div>
                  <div className="text-red-600 font-semibold">
                    -{formatCurrency(refund.amount)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
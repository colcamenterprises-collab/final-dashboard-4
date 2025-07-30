import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, DollarSign, Receipt, Search, RefreshCw, ChevronLeft, ChevronRight, TrendingUp, ShoppingCart, Coffee, Users, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { JussiChatBubble } from '@/components/JussiChatBubble';
import { format } from 'date-fns';

interface DailySummary {
  id: number;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  firstReceipt?: string;
  lastReceipt?: string;
  totalReceipts: number;
  grossSales: string;
  netSales: string;
  paymentBreakdown: Record<string, { count: number; amount: number }>;
  itemsSold: Record<string, { quantity: number; total: number }>;
  modifiersSold: Record<string, { count: number; total: number }>;
  drinksSummary: Record<string, { quantity: number }>;
  rollsUsed: number;
  refunds: Array<{
    receiptNumber: string;
    amount: number;
    date: string;
  }>;
  processedAt: string;
  updatedAt: string;
}

interface LoyverseReceipt {
  id: string;
  receipt_number: string;
  total_money: number;
  points_earned?: number;
  points_deducted?: number;
  created_at: string;
  updated_at: string;
  receipt_date: string;
  note?: string;
  order_type_id?: string;
  dining_option?: string;
  customer_id?: string;
  customer_name?: string;
  line_items: Array<{
    id: string;
    item_name: string;
    variant_name?: string;
    quantity: number;
    line_note?: string;
    modifiers_applied?: Array<{
      modifier_name: string;
      modifier_option_name: string;
      quantity: number;
    }>;
  }>;
  payments: Array<{
    payment_type_id: string;
    amount: number;
  }>;
}

export default function Receipts() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'current' | 'search'>('current');

  // Query latest Jussi summary (most recent shift)
  const { data: latestSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<DailySummary>({
    queryKey: ['/api/receipts/jussi-summary/latest'],
    enabled: viewMode === 'current',
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Query summary by date when searching
  const { data: searchSummary, isLoading: searchLoading, refetch: refetchSearchSummary } = useQuery<DailySummary>({
    queryKey: ['/api/receipts/jussi-summary', selectedDate],
    enabled: viewMode === 'search' && !!selectedDate,
  });

  // Query all summaries for date picker
  const { data: allSummaries } = useQuery<DailySummary[]>({
    queryKey: ['/api/receipts/jussi-summaries'],
  });

  const formatCurrency = (amount: string | number) => {
    if (amount === null || amount === undefined) {
      return '฿0.00';
    }
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) {
      return '฿0.00';
    }
    return `฿${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM dd, yyyy HH:mm');
  };

  const formatShiftTime = (startStr: string, endStr: string) => {
    const start = format(new Date(startStr), 'h:mm a');
    const end = format(new Date(endStr), 'h:mm a');
    return `${start} - ${end}`;
  };

  // Determine which summary to display
  const displaySummary = viewMode === 'current' ? latestSummary : searchSummary;
  const isLoading = viewMode === 'current' ? summaryLoading : searchLoading;

  const handleDateSearch = () => {
    if (selectedDate) {
      setViewMode('search');
    }
  };

  const handleBackToCurrent = () => {
    setViewMode('current');
    setSelectedDate('');
  };

  const generateSummaryForDate = async (date: string) => {
    try {
      const response = await fetch(`/api/receipts/summary/generate/${date}`, {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success) {
        // Refetch the summary after generation
        if (viewMode === 'search') {
          refetchSearchSummary();
        } else {
          refetchSummary();
        }
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-lg">Loading receipt summaries...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="h-8 w-8 text-blue-600" />
              Daily Receipt Summaries
            </h1>
            <p className="text-gray-600 mt-1">
              {viewMode === 'current' ? 'Most Recent Shift Summary' : `Summary for ${selectedDate}`}
            </p>
          </div>
          
          {/* Date Search Controls */}
          <div className="flex items-center gap-3">
            {viewMode === 'search' && (
              <Button onClick={handleBackToCurrent} variant="outline" className="flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back to Current
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="date-search">Search Date:</Label>
              <Input
                id="date-search"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
              <Button onClick={handleDateSearch} disabled={!selectedDate} className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Display */}
        {displaySummary ? (
          <div className="grid gap-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displaySummary.totalReceipts}</div>
                  <p className="text-xs text-muted-foreground">
                    {displaySummary.firstReceipt && displaySummary.lastReceipt 
                      ? `${displaySummary.firstReceipt} - ${displaySummary.lastReceipt}`
                      : 'No receipt range'
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gross Sales</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(displaySummary.grossSales)}</div>
                  <p className="text-xs text-muted-foreground">
                    Net: {formatCurrency(displaySummary.netSales)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Burger Rolls Used</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{displaySummary.rollsUsed}</div>
                  <p className="text-xs text-muted-foreground">
                    Calculated from burger sales
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Shift Period</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {formatShiftTime(displaySummary.shiftStart, displaySummary.shiftEnd)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(displaySummary.date), 'MMM dd, yyyy')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Methods */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Payment Methods
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(displaySummary.paymentBreakdown).map(([method, data]) => (
                      <div key={method} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{method}</Badge>
                          <span className="text-sm text-gray-600">
                            {data.count} transaction{data.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <span className="font-medium">{formatCurrency(data.amount)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Items Sold */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Items Sold
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {Object.entries(displaySummary.itemsSold)
                      .sort(([,a], [,b]) => b.quantity - a.quantity)
                      .slice(0, 10)
                      .map(([item, data]) => (
                        <div key={item} className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item}</div>
                            <div className="text-xs text-gray-500">
                              Qty: {data.quantity} • Total: {formatCurrency(data.total)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Drinks Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coffee className="h-5 w-5" />
                    Drinks Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(displaySummary.drinksSummary).map(([drink, data]) => (
                      <div key={drink} className="flex items-center justify-between">
                        <span className="text-sm">{drink}</span>
                        <Badge variant="secondary">{data.quantity}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Modifiers */}
              {Object.keys(displaySummary.modifiersSold).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Modifiers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(displaySummary.modifiersSold).map(([modifier, data]) => (
                        <div key={modifier} className="flex items-center justify-between">
                          <span className="text-sm">{modifier}</span>
                          <div className="text-right">
                            <Badge variant="secondary">{data.count}</Badge>
                            <div className="text-xs text-gray-500">{formatCurrency(data.total)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Refunds Section */}
            {displaySummary.refunds.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Refunds ({displaySummary.refunds.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {displaySummary.refunds.map((refund, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div>
                          <div className="font-medium">Receipt #{refund.receiptNumber}</div>
                          <div className="text-sm text-gray-600">{formatDateTime(refund.date)}</div>
                        </div>
                        <Badge variant="destructive">{formatCurrency(Math.abs(refund.amount))}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generate Summary Button */}
            <div className="flex justify-center">
              <Button 
                onClick={() => generateSummaryForDate(displaySummary.date)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate Summary
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <Receipt className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {viewMode === 'current' ? 'No Recent Summary Available' : 'No Summary Found'}
              </h3>
              <p className="text-gray-600 text-center mb-4">
                {viewMode === 'current' 
                  ? 'No receipt summary has been generated for the most recent shift yet.'
                  : `No receipt summary found for ${selectedDate}. Try generating one below.`
                }
              </p>
              {viewMode === 'search' && selectedDate && (
                <Button 
                  onClick={() => generateSummaryForDate(selectedDate)}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate Summary for {selectedDate}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Jussi Chat Bubble */}
      <JussiChatBubble />
    </div>
  );
}
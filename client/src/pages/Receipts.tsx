import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, DollarSign, Receipt, Utensils, Search, BarChart3, RefreshCw, Plus } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

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
  paymentBreakdown: Array<{
    payment_method: string;
    count: number;
    amount: number;
  }>;
  itemsSold: Record<string, number>;
  modifiersSold: Record<string, number>;
  drinksSummary: Record<string, number>;
  rollsUsed: number;
  refunds: Array<{
    receipt_number: string;
    amount: number;
    reason?: string;
  }>;
  processedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function Receipts() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'latest' | 'search'>('latest');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{type: 'user' | 'assistant', message: string}>>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const queryClient = useQueryClient();

  // Query latest shift summary (default view)
  const { data: latestSummary, isLoading: latestLoading } = useQuery<DailySummary>({
    queryKey: ['/api/daily-summaries/latest'],
    enabled: viewMode === 'latest',
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Query specific date summary when searching
  const { data: datesSummary, isLoading: dateLoading } = useQuery<DailySummary>({
    queryKey: ['/api/daily-summaries', selectedDate],
    enabled: viewMode === 'search' && !!selectedDate,
  });

  // Query all summaries for search dropdown
  const { data: allSummaries } = useQuery<DailySummary[]>({
    queryKey: ['/api/daily-summaries'],
    enabled: viewMode === 'search',
  });

  // Mutation for processing a specific date
  const processSummaryMutation = useMutation({
    mutationFn: (date: string) => apiRequest(`/api/daily-summaries/process/${date}`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daily-summaries'] });
    },
  });

  // Determine which data to display
  const displayData = viewMode === 'latest' ? latestSummary : datesSummary;
  const isLoading = viewMode === 'latest' ? latestLoading : dateLoading;

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(numAmount);
  };

  const formatShiftTime = (isoString: string) => {
    return format(new Date(isoString), 'PPp');
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { type: 'user', message: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/chat/jussi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          context: displayData ? JSON.stringify(displayData) : null
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, { type: 'assistant', message: data.response }]);
      } else {
        setChatMessages(prev => [...prev, { type: 'assistant', message: 'Sorry, I encountered an error. Please try again.' }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { type: 'assistant', message: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleDateSearch = () => {
    if (selectedDate) {
      setViewMode('search');
    }
  };

  const resetToLatest = () => {
    setViewMode('latest');
    setSelectedDate('');
  };

  const handleGenerateSummary = (date: string) => {
    processSummaryMutation.mutate(date);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Receipts Summary</h1>
        </div>
        <div className="text-center py-12">Loading shift summary...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daily Shift Summaries</h1>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'latest' ? 'default' : 'outline'}
            onClick={resetToLatest}
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Latest Shift
          </Button>
          <Button
            variant={viewMode === 'search' ? 'default' : 'outline'}
            onClick={() => setViewMode('search')}
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            Search History
          </Button>
        </div>
      </div>

      {/* Search Section (only show when in search mode) */}
      {viewMode === 'search' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Search Historical Shifts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="search-date">Select Shift Date</Label>
                <Input
                  id="search-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <Button 
                onClick={handleDateSearch}
                disabled={!selectedDate}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                View Shift
              </Button>
              <Button 
                onClick={() => handleGenerateSummary(selectedDate)}
                disabled={!selectedDate || processSummaryMutation.isPending}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {processSummaryMutation.isPending ? 'Processing...' : 'Generate Summary'}
              </Button>
            </div>
            
            {/* Available dates dropdown */}
            {allSummaries && allSummaries.length > 0 && (
              <div>
                <Label>Available Shift Dates</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {allSummaries.map((summary) => (
                    <Button
                      key={summary.id}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(summary.date)}
                      className="text-xs"
                    >
                      {format(new Date(summary.date), 'MMM dd')}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Display current data */}
      {displayData ? (
        <div className="space-y-6">
          {/* Shift Info Header */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Shift Date</div>
                  <div className="text-lg font-bold">{format(new Date(displayData.date), 'PPPP')}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Shift Time</div>
                  <div className="text-lg font-bold">
                    {formatShiftTime(displayData.shiftStart)} - {formatShiftTime(displayData.shiftEnd)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Receipt Range</div>
                  <div className="text-lg font-bold text-blue-600">
                    {displayData.firstReceipt && displayData.lastReceipt
                      ? `${displayData.firstReceipt} → ${displayData.lastReceipt}`
                      : 'No receipts'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{displayData.totalReceipts}</div>
                <p className="text-xs text-muted-foreground">Receipts processed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(displayData.grossSales)}</div>
                <p className="text-xs text-muted-foreground">Total revenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Sales</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(displayData.netSales)}</div>
                <p className="text-xs text-muted-foreground">After adjustments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rolls Used</CardTitle>
                <Utensils className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{displayData.rollsUsed}</div>
                <p className="text-xs text-muted-foreground">Burger buns</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Payment Types */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Type Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {displayData.paymentBreakdown.map((payment, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="font-medium">{payment.payment_method}</span>
                    <div className="text-right">
                      <Badge variant="secondary">{payment.count} transactions</Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(payment.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Items Sold */}
            <Card>
              <CardHeader>
                <CardTitle>Top Items Sold</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(displayData.itemsSold)
                  .sort(([,a], [,b]) => (b as number) - (a as number))
                  .slice(0, 10)
                  .map(([item, quantity]) => (
                    <div key={item} className="flex justify-between items-center">
                      <span className="font-medium text-sm truncate">{item}</span>
                      <Badge variant="outline">{quantity}</Badge>
                    </div>
                  ))}
                {Object.keys(displayData.itemsSold).length > 10 && (
                  <p className="text-sm text-muted-foreground">
                    +{Object.keys(displayData.itemsSold).length - 10} more items...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Drinks Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Drinks Sold</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(displayData.drinksSummary).map(([drink, quantity]) => (
                  <div key={drink} className="flex justify-between items-center">
                    <span className="font-medium">{drink}</span>
                    <Badge variant="outline">{quantity}</Badge>
                  </div>
                ))}
                {Object.keys(displayData.drinksSummary).length === 0 && (
                  <p className="text-sm text-muted-foreground">No drinks data</p>
                )}
              </CardContent>
            </Card>

            {/* Refunds */}
            <Card>
              <CardHeader>
                <CardTitle>Refunds & Returns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {displayData.refunds.length > 0 ? (
                  displayData.refunds.map((refund, index) => (
                    <div key={index} className="border-b pb-2 last:border-b-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Receipt #{refund.receipt_number}</span>
                        <Badge variant="destructive">{formatCurrency(refund.amount)}</Badge>
                      </div>
                      {refund.reason && (
                        <p className="text-xs text-muted-foreground">{refund.reason}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No refunds for this shift</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Jussi Chat */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Chat with Jussi - Receipt Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chat Messages */}
              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-4 bg-muted/20">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    <p>Ask Jussi about this shift's receipts!</p>
                    <p className="text-xs mt-1">Try: "How many items were sold?" or "What were the top items?"</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg ${
                        msg.type === 'user'
                          ? 'bg-blue-500 text-white ml-8'
                          : 'bg-white border mr-8'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="bg-white border mr-8 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Jussi is analyzing...</p>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask Jussi about receipts, sales, or anomalies..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleChatSubmit} 
                  disabled={!chatInput.trim() || isChatLoading}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  Ask Jussi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">No shift summary available</p>
              <p className="text-sm mb-4">
                {viewMode === 'search' && selectedDate 
                  ? `No summary found for ${selectedDate}`
                  : 'No latest shift summary available'}
              </p>
              {viewMode === 'search' && selectedDate && (
                <Button 
                  onClick={() => handleGenerateSummary(selectedDate)}
                  disabled={processSummaryMutation.isPending}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {processSummaryMutation.isPending ? 'Processing...' : 'Generate Summary for This Date'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
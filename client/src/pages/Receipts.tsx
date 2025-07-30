import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, DollarSign, Receipt, Utensils, Search, BarChart3 } from 'lucide-react';
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

export default function Receipts() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{type: 'user' | 'assistant', message: string}>>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

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

  const clearSearch = () => {
    setSelectedDate('');
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
        <div className="text-center py-12">No receipt data available</div>
      </div>
    );
  }

  const { summary, shiftStart, shiftEnd, shiftDate } = displayData;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Receipts Summary</h1>
        <Badge variant="outline" className="text-sm">
          {selectedDate ? `Selected: ${selectedDate}` : 'Current Shift'}
        </Badge>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Previous Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search-date">Select Date</Label>
              <Input
                id="search-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <Button onClick={clearSearch} variant="outline">
              Clear & Show Current
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalReceipts}</div>
            <p className="text-xs text-muted-foreground">
              {formatShiftTime(shiftStart)} - {formatShiftTime(shiftEnd)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.grossSales)}</div>
            <p className="text-xs text-muted-foreground">
              Before refunds & adjustments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Sales</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.netSales)}</div>
            <p className="text-xs text-muted-foreground">
              Final sales amount
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shift Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shiftDate}</div>
            <p className="text-xs text-muted-foreground">
              5 PM - 3 AM shift cycle
            </p>
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
            {Object.entries(summary.paymentTypes).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="font-medium">{type}</span>
                <Badge variant="secondary">{count} transactions</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Items Sold */}
        <Card>
          <CardHeader>
            <CardTitle>Items Sold</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(summary.itemsSold).slice(0, 10).map(([item, quantity]) => (
              <div key={item} className="flex justify-between items-center">
                <span className="font-medium">{item}</span>
                <Badge variant="outline">{quantity} sold</Badge>
              </div>
            ))}
            {Object.keys(summary.itemsSold).length > 10 && (
              <p className="text-sm text-muted-foreground">
                +{Object.keys(summary.itemsSold).length - 10} more items...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Modifiers */}
        <Card>
          <CardHeader>
            <CardTitle>Modifiers Purchased</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(summary.modifiersSold).map(([modifier, count]) => (
              <div key={modifier} className="flex justify-between items-center">
                <span className="font-medium">{modifier}</span>
                <Badge variant="outline">{count} times</Badge>
              </div>
            ))}
            {Object.keys(summary.modifiersSold).length === 0 && (
              <p className="text-sm text-muted-foreground">No modifiers purchased</p>
            )}
          </CardContent>
        </Card>

        {/* Refunds */}
        <Card>
          <CardHeader>
            <CardTitle>Refunds & Returns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.refunds.length > 0 ? (
              summary.refunds.map((refund, index) => (
                <div key={index} className="border-b pb-2 last:border-b-0">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Receipt #{refund.receipt_number}</span>
                    <Badge variant="destructive">{formatCurrency(refund.amount)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{refund.reason}</p>
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
                <p className="text-xs mt-1">Try: "How many items were sold?" or "Any refunds yesterday?"</p>
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
            >
              Ask Jussi
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
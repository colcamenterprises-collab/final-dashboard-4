import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, DollarSign, Receipt, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'current' | 'search'>('current');

  // Query recent receipts (current shift)
  const { data: receipts, isLoading: receiptsLoading, refetch: refetchReceipts } = useQuery<LoyverseReceipt[]>({
    queryKey: ['/api/loyverse/receipts'],
    enabled: viewMode === 'current',
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Query receipts by date when searching
  const { data: searchReceipts, isLoading: searchLoading } = useQuery<LoyverseReceipt[]>({
    queryKey: ['/api/loyverse/receipts', selectedDate],
    enabled: viewMode === 'search' && !!selectedDate,
  });

  const formatCurrency = (amount: number) => {
    return `฿${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateTime = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM dd, yyyy HH:mm');
  };

  // Determine which receipts to display
  const displayReceipts = viewMode === 'current' ? receipts : searchReceipts;
  const isLoading = viewMode === 'current' ? receiptsLoading : searchLoading;

  // Filter receipts by search term
  const filteredReceipts = displayReceipts?.filter(receipt => 
    receipt.receipt_number?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    receipt.customer_name?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    receipt.line_items?.some(item => 
      item.item_name?.toLowerCase()?.includes(searchTerm.toLowerCase())
    )
  ) || [];

  // Pagination
  const itemsPerPage = 20;
  const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReceipts = filteredReceipts.slice(startIndex, startIndex + itemsPerPage);

  const handleDateSearch = () => {
    if (selectedDate) {
      setViewMode('search');
      setCurrentPage(1);
    }
  };

  const resetToCurrentShift = () => {
    setViewMode('current');
    setSelectedDate('');
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Receipts</h1>
        </div>
        <div className="text-center py-12">Loading receipts...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Receipts</h1>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'current' ? 'default' : 'outline'}
            onClick={resetToCurrentShift}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Clock className="mr-2 h-4 w-4" />
            Current Shift
          </Button>
          <Button
            variant={viewMode === 'search' ? 'default' : 'outline'}
            onClick={() => setViewMode('search')}
          >
            <Search className="mr-2 h-4 w-4" />
            Search by Date
          </Button>
          <Button
            onClick={() => refetchReceipts()}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search Controls */}
      {viewMode === 'search' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="date-search">Search by Date</Label>
                <Input
                  id="date-search"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button onClick={handleDateSearch} className="bg-blue-600 text-white hover:bg-blue-700">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Receipt Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search receipts by number, customer name, or item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Badge variant="secondary">
              {filteredReceipts.length} receipt{filteredReceipts.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Receipts List */}
      <div className="space-y-4">
        {paginatedReceipts.length > 0 ? (
          paginatedReceipts.map((receipt) => (
            <Card key={receipt.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">Receipt #{receipt.receipt_number}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(receipt.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(receipt.total_money)}
                    </div>
                    {receipt.customer_name && (
                      <p className="text-sm text-muted-foreground">{receipt.customer_name}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Items */}
                  <div>
                    <h4 className="font-medium mb-2">Items ({receipt.line_items.length})</h4>
                    <div className="space-y-1">
                      {receipt.line_items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <div className="flex-1">
                            <span className="font-medium">{item.quantity}x</span> {item.item_name}
                            {item.variant_name && (
                              <span className="text-muted-foreground"> ({item.variant_name})</span>
                            )}
                            {item.modifiers_applied && item.modifiers_applied.length > 0 && (
                              <div className="ml-4 text-xs text-muted-foreground">
                                {item.modifiers_applied.map((mod, modIndex) => (
                                  <span key={modIndex}>
                                    +{mod.modifier_option_name}
                                    {modIndex < item.modifiers_applied!.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Methods */}
                  {receipt.payments.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Payment</h4>
                      <div className="flex flex-wrap gap-2">
                        {receipt.payments.map((payment, index) => (
                          <Badge key={index} variant="outline">
                            {payment.payment_type_id}: {formatCurrency(payment.amount)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {receipt.note && (
                    <div>
                      <h4 className="font-medium mb-1">Note</h4>
                      <p className="text-sm text-muted-foreground">{receipt.note}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8">
              <div className="text-center text-muted-foreground">
                <Receipt className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No receipts found</p>
                <p className="text-sm">
                  {viewMode === 'search' && selectedDate 
                    ? `No receipts found for ${selectedDate}`
                    : searchTerm 
                    ? `No receipts match "${searchTerm}"`
                    : 'No receipts available for current shift'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredReceipts.length)} of {filteredReceipts.length} receipts
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Search, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StockItem {
  id: number;
  name: string;
  category: string;
  isDrink: boolean;
  isExcluded: boolean;
  displayOrder: number;
}

interface StockRequest {
  stockItemId: number;
  requestedQty: number | null;
}

interface StockData {
  shiftId: string;
  bunsCount: number;
  meatGrams: number;
}

export default function DailyStock() {
  const [searchParams] = useSearchParams();
  const shiftId = searchParams.get('shift') || '';
  const { toast } = useToast();
  
  // State
  const [stockData, setStockData] = useState<StockData>({
    shiftId,
    bunsCount: 0,
    meatGrams: 0,
  });
  const [stockRequests, setStockRequests] = useState<Record<number, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);

  // Fetch stock catalog
  const { data: catalogResponse, isLoading: catalogLoading } = useQuery({
    queryKey: ['/api/stock-catalog'],
    enabled: !!shiftId,
  });

  // Fetch existing stock data
  const { data: existingDataResponse, isLoading: dataLoading } = useQuery({
    queryKey: ['/api/daily-stock', shiftId],
    queryFn: () => fetch(`/api/daily-stock?shift=${shiftId}`).then(res => res.json()),
    enabled: !!shiftId,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/daily-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Stock data saved successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save stock data',
        variant: 'destructive',
      });
    },
  });

  // Load existing data
  useEffect(() => {
    if (existingDataResponse?.ok) {
      const { stock, requests } = existingDataResponse;
      if (stock) {
        setStockData({
          shiftId: stock.shiftId,
          bunsCount: stock.bunsCount || 0,
          meatGrams: stock.meatGrams || 0,
        });
      }
      if (requests && Array.isArray(requests)) {
        const requestsMap: Record<number, number> = {};
        requests.forEach((req: StockRequest) => {
          if (req.requestedQty !== null) {
            requestsMap[req.stockItemId] = req.requestedQty;
          }
        });
        setStockRequests(requestsMap);
      }
    }
  }, [existingDataResponse]);

  if (!shiftId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">No shift ID provided. Please navigate from Form 1.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (catalogLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">Loading stock catalog...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stockItems: StockItem[] = catalogResponse?.items || [];
  const filteredItems = stockItems.filter(item => 
    !item.isExcluded && 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, StockItem[]>);

  const handleSubmit = () => {
    const requests = Object.entries(stockRequests).map(([stockItemId, requestedQty]) => ({
      stockItemId: parseInt(stockItemId),
      requestedQty,
    }));

    saveMutation.mutate({
      shiftId,
      bunsCount: stockData.bunsCount,
      meatGrams: stockData.meatGrams,
      requests,
    });
  };

  const toggleAllSections = () => {
    const newExpanded = !allExpanded;
    setAllExpanded(newExpanded);
    const newOpenSections: Record<string, boolean> = {};
    Object.keys(groupedItems).forEach(category => {
      newOpenSections[category] = newExpanded;
    });
    setOpenSections(newOpenSections);
  };

  const toggleSection = (category: string) => {
    setOpenSections(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Daily Stock - Form 2
            </CardTitle>
            <p className="text-sm text-gray-600">Shift ID: {shiftId}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stock Counts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bunsCount">Burger Buns (end of shift count)</Label>
                <Input
                  id="bunsCount"
                  type="number"
                  value={stockData.bunsCount}
                  onChange={(e) => setStockData(prev => ({
                    ...prev,
                    bunsCount: parseInt(e.target.value) || 0
                  }))}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meatGrams">Meat Weight (grams remaining)</Label>
                <Input
                  id="meatGrams"
                  type="number"
                  value={stockData.meatGrams}
                  onChange={(e) => setStockData(prev => ({
                    ...prev,
                    meatGrams: parseInt(e.target.value) || 0
                  }))}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Search and Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              <Button
                variant="outline"
                onClick={toggleAllSections}
                className="text-sm"
              >
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </Button>
            </div>

            {/* Stock Items by Category */}
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([category, items]) => (
                <Collapsible
                  key={category}
                  open={openSections[category] || false}
                  onOpenChange={() => toggleSection(category)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                      <h3 className="font-medium text-gray-900">{category}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          {items.length} items
                        </span>
                        {openSections[category] ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 pl-4">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-white border rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {item.name}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`item-${item.id}`} className="text-sm text-gray-600">
                              Qty:
                            </Label>
                            <Input
                              id={`item-${item.id}`}
                              type="number"
                              min="0"
                              value={stockRequests[item.id] || ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                setStockRequests(prev => ({
                                  ...prev,
                                  [item.id]: value
                                }));
                              }}
                              className="w-20 text-sm"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
                className="px-8"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Stock Data'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
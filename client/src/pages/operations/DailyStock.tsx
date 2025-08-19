import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronRight } from 'lucide-react';
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
  
  // State - separate drinks from regular stock requests
  const [stockData, setStockData] = useState<StockData>({
    shiftId,
    bunsCount: 0,
    meatGrams: 0,
  });
  const [stockRequests, setStockRequests] = useState<Record<number, number>>({});
  const [drinkRequests, setDrinkRequests] = useState<Record<number, number>>({});

  // Fetch stock catalog - always fetch, don't require shiftId
  const { data: catalogResponse, isLoading: catalogLoading } = useQuery({
    queryKey: ['/api/stock-catalog'],
  });

  // Fetch existing stock data only if shiftId present
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
        const regularRequests: Record<number, number> = {};
        const drinksRequests: Record<number, number> = {};
        
        requests.forEach((req: StockRequest) => {
          if (req.requestedQty !== null) {
            // Need to check if this item is a drink from the catalog
            const item = (catalogResponse as any)?.items?.find((i: StockItem) => i.id === req.stockItemId);
            if (item?.isDrink) {
              drinksRequests[req.stockItemId] = req.requestedQty;
            } else {
              regularRequests[req.stockItemId] = req.requestedQty;
            }
          }
        });
        
        setStockRequests(regularRequests);
        setDrinkRequests(drinksRequests);
      }
    }
  }, [existingDataResponse, catalogResponse]);

  // Don't block UI if no shiftId - form should still be usable

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

  const stockItems: StockItem[] = (catalogResponse as any)?.items || [];
  
  // Separate drinks from regular stock items
  const drinkItems = stockItems.filter(item => item.isDrink && !item.isExcluded);
  const regularItems = stockItems.filter(item => 
    !item.isDrink && 
    !item.isExcluded
  );

  // Group regular items by category  
  const groupedItems = regularItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, StockItem[]>);

  const handleSubmit = () => {
    // Combine drink and stock requests
    const allRequests: { stockItemId: number; requestedQty: number }[] = [];
    
    // Add regular stock requests
    Object.entries(stockRequests).forEach(([stockItemId, requestedQty]) => {
      allRequests.push({
        stockItemId: parseInt(stockItemId),
        requestedQty,
      });
    });
    
    // Add drink requests
    Object.entries(drinkRequests).forEach(([stockItemId, requestedQty]) => {
      allRequests.push({
        stockItemId: parseInt(stockItemId),
        requestedQty,
      });
    });

    saveMutation.mutate({
      shiftId: shiftId || `temp-${Date.now()}`, // Allow saving without shiftId for testing
      bunsCount: stockData.bunsCount,
      meatGrams: stockData.meatGrams,
      requests: allRequests,
    });
  };

  // Remove unused functions for accordion (we're using grid layout now)

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Daily Stock
            </CardTitle>
            {shiftId ? (
              <p className="text-sm text-gray-600">Linked to shift: {shiftId}</p>
            ) : (
              <p className="text-sm text-gray-500">No shift ID provided</p>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            {/* End-of-Shift Counts */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">End-of-Shift Counts</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bunsCount" className="text-sm">Buns (pcs)</Label>
                  <Input
                    id="bunsCount"
                    type="number"
                    min="0"
                    value={stockData.bunsCount}
                    onChange={(e) => setStockData(prev => ({
                      ...prev,
                      bunsCount: Math.max(0, parseInt(e.target.value) || 0)
                    }))}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meatGrams" className="text-sm">Meat (grams)</Label>
                  <Input
                    id="meatGrams"
                    type="number"
                    min="0"
                    value={stockData.meatGrams}
                    onChange={(e) => setStockData(prev => ({
                      ...prev,
                      meatGrams: Math.max(0, parseInt(e.target.value) || 0)
                    }))}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Drinks</Label>
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    <div className="space-y-0">
                      {drinkItems.map((drink) => (
                        <div
                          key={drink.id}
                          className="flex items-center justify-between p-2 border-b last:border-b-0 bg-white"
                        >
                          <span className="text-sm font-medium text-gray-900 flex-1">
                            {drink.name}
                          </span>
                          <Input
                            type="number"
                            min="0"
                            value={drinkRequests[drink.id] || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                              setDrinkRequests(prev => ({
                                ...prev,
                                [drink.id]: value
                              }));
                            }}
                            className="w-16 text-sm"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Requisition List (by Category) */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Requisition List</h3>
              
              {Object.entries(groupedItems).map(([category, items], categoryIndex) => (
                <div key={category} className={categoryIndex > 0 ? "mt-8" : ""}>
                  <div className="mb-4">
                    <h4 className="text-base font-medium text-gray-800 bg-gray-100 px-3 py-2 rounded-md">
                      {category}
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white border rounded-lg hover:border-gray-300 transition-colors"
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`item-${item.id}`} className="text-sm font-medium text-gray-900 block">
                            {item.name}
                          </Label>
                          <Input
                            id={`item-${item.id}`}
                            type="number"
                            min="0"
                            value={stockRequests[item.id] || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                              setStockRequests(prev => ({
                                ...prev,
                                [item.id]: value
                              }));
                            }}
                            className="w-full text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions (bottom only) */}
            <div className="pt-6 border-t">
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={saveMutation.isPending}
                  className="px-8 text-sm"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
              
              {/* Success/Error Messages */}
              {saveMutation.isSuccess && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">Stock saved</p>
                </div>
              )}
              
              {saveMutation.isError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">
                    Error saving stock data
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight, Plus, Minus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StockItem {
  id: number;
  name: string;
  category: string;
  isDrink: boolean;
  isExcluded: boolean;
}

interface StockData {
  rolls: number;
  meatGrams: number;
}

export default function DailyStock() {
  const [searchParams] = useSearchParams();
  const shiftId = searchParams.get('shift');
  const { toast } = useToast();
  
  // State
  const [stockData, setStockData] = useState<StockData>({
    rolls: 0,
    meatGrams: 0,
  });
  const [requisition, setRequisition] = useState<Record<number, number>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [completedBy, setCompletedBy] = useState('');

  // Fetch stock catalog
  const { data: catalogResponse, isLoading: catalogLoading } = useQuery({
    queryKey: ['/api/stock-catalog'],
  });

  // Fetch existing data if shiftId present
  const { data: existingData, isLoading: dataLoading } = useQuery({
    queryKey: ['/api/forms', shiftId],
    queryFn: () => fetch(`/api/forms/${shiftId}`).then(res => res.json()),
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
    if (existingData?.stock) {
      setStockData({
        rolls: existingData.stock.rolls || 0,
        meatGrams: existingData.stock.meatGrams || 0,
      });
      
      if (existingData.stock.requisition) {
        setRequisition(existingData.stock.requisition);
      }
    }
    
    if (existingData?.shift?.completedBy) {
      setCompletedBy(existingData.shift.completedBy);
    }
  }, [existingData]);

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
  
  // Filter out excluded items and the first 4 meat items
  const availableItems = stockItems.filter(item => !item.isExcluded);
  
  // Define categories in order
  const categoryOrder = [
    'Fresh Food',
    'Dry Goods', 
    'Sauces & Condiments',
    'Packaging',
    'Cleaning',
    'Beverages',
    'Other'
  ];

  // Group items by category
  const groupedItems = categoryOrder.reduce((acc, category) => {
    acc[category] = availableItems.filter(item => item.category === category);
    return acc;
  }, {} as Record<string, StockItem[]>);

  // Filter items by search term
  const filteredGroupedItems = Object.fromEntries(
    Object.entries(groupedItems).map(([category, items]) => [
      category,
      items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    ]).filter(([_, items]) => items.length > 0)
  );

  const handleExpandAll = () => {
    const newExpanded = {};
    Object.keys(filteredGroupedItems).forEach(category => {
      newExpanded[category] = true;
    });
    setExpandedCategories(newExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedCategories({});
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleSubmit = () => {
    // Filter out zero quantities
    const nonZeroRequisition = Object.fromEntries(
      Object.entries(requisition).filter(([_, qty]) => qty > 0)
    );

    saveMutation.mutate({
      shiftId: shiftId || null,
      rolls: stockData.rolls,
      meatGrams: stockData.meatGrams,
      requisition: nonZeroRequisition,
    });
  };

  const formatShiftDate = (dateStr: string) => {
    if (!dateStr) return '';
    // Convert DD/MM/YYYY to readable format
    const [day, month, year] = dateStr.split('/');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl text-gray-900">Daily Stock</CardTitle>
                {shiftId ? (
                  <p className="text-sm text-gray-600 mt-1">
                    Shift: {formatShiftDate(existingData?.shift?.date)} • ID: {shiftId}
                  </p>
                ) : (
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      No shift ID provided
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Shift Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Shift Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700">Date</Label>
                  <Input
                    id="date"
                    type="text"
                    value={existingData?.shift?.date || ''}
                    readOnly={!!shiftId}
                    className="mt-1"
                    placeholder="DD/MM/YYYY"
                  />
                </div>
                <div>
                  <Label htmlFor="completedBy" className="text-sm font-medium text-gray-700">Completed By</Label>
                  <Input
                    id="completedBy"
                    type="text"
                    value={completedBy}
                    onChange={(e) => setCompletedBy(e.target.value)}
                    className="mt-1"
                    placeholder="Enter name"
                  />
                </div>
              </div>
            </div>

            {/* End-of-Shift Counts */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">End-of-Shift Counts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rolls" className="text-sm font-medium text-gray-700">Rolls (pcs)</Label>
                  <Input
                    id="rolls"
                    type="number"
                    min="0"
                    value={stockData.rolls}
                    onChange={(e) => setStockData(prev => ({
                      ...prev,
                      rolls: Math.max(0, parseInt(e.target.value) || 0)
                    }))}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="meat" className="text-sm font-medium text-gray-700">Meat (grams)</Label>
                  <Input
                    id="meat"
                    type="number"
                    min="0"
                    value={stockData.meatGrams}
                    onChange={(e) => setStockData(prev => ({
                      ...prev,
                      meatGrams: Math.max(0, parseInt(e.target.value) || 0)
                    }))}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Requisition List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Requisition List</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExpandAll}
                    className="text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Expand all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCollapseAll}
                    className="text-xs"
                  >
                    <Minus className="w-3 h-3 mr-1" />
                    Collapse all
                  </Button>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Categories */}
              {Object.entries(filteredGroupedItems).map(([category, items]) => (
                <div key={category} className="border rounded-lg">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 rounded-t-lg border-b"
                  >
                    <span className="font-medium text-gray-900">
                      {category} ({items.length} items)
                    </span>
                    {expandedCategories[category] ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  
                  {expandedCategories[category] && (
                    <div className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-white border rounded-lg"
                          >
                            <span className="text-sm font-medium text-gray-900 flex-1 mr-2">
                              {item.name}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              value={requisition[item.id] || ''}
                              onChange={(e) => {
                                const value = Math.max(0, parseInt(e.target.value) || 0);
                                setRequisition(prev => ({
                                  ...prev,
                                  [item.id]: value
                                }));
                              }}
                              className="w-16 text-sm"
                              placeholder="0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t">
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={saveMutation.isPending}
                  className="px-8"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
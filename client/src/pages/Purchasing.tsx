import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package, Plus, Search } from "lucide-react";

interface Supplier {
  id: number;
  item: string;
  category: string;
  supplier: string;
  brand: string;
  cost: number;
  packagingQty: string;
  unit: string;
  portionSize: string;
  minStock: string;
  reviewedDate?: string;
}

const Purchasing = () => {
  const [activeTab, setActiveTab] = useState("shopping");
  
  // Fetch suppliers data from JSON endpoint
  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers-json"],
  });

  // Group suppliers by category
  const grouped = suppliers.reduce((acc: Record<string, Supplier[]>, item: Supplier) => {
    const cat = item.category || 'Other';
    acc[cat] = acc[cat] || [];
    acc[cat].push(item);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="text-center text-lg">Loading purchasing data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Purchasing</h1>
        <p className="text-gray-600 text-sm sm:text-base">Manage shopping requirements and supplier information</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="shopping" className="text-sm sm:text-base">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Shopping Requirements
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="text-sm sm:text-base">
            <Package className="mr-2 h-4 w-4" />
            Suppliers
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="shopping" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Shopping Requirements</h2>
            <div className="flex space-x-2">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Quick Lodge
              </Button>
              <Button variant="outline">
                <Search className="mr-2 h-4 w-4" />
                Search Items
              </Button>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Lodge Items</CardTitle>
              <CardDescription>Enter purchasing quantities for common items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Burger Buns</label>
                  <input 
                    type="number" 
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Meat (kg)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="0.0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Rolls Ordered</label>
                  <input 
                    type="number" 
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Drinks Purchased</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Coke</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Coke Zero</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Sprite</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Schweppes Manow</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Fanta Orange</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Fanta Strawberry</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Soda Water</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Bottled Water</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Kids Juice Orange</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Kids Juice Apple</label>
                    <input 
                      type="number" 
                      className="w-full p-2 border border-gray-300 rounded-md text-xs sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <Button className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white">Submit Purchase Order</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="suppliers" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Supplier Management</h2>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="mr-2 h-4 w-4" />
              Add Ingredient
            </Button>
          </div>
          
          {Object.entries(grouped).map(([cat, catItems]) => (
            <Card key={cat} className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">{cat}</CardTitle>
                <Badge variant="secondary">{catItems.length} items</Badge>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left table-auto">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Name</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Package Price (THB)</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Packaging Quantity</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Portion Size</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Cost/Portion</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Supplier</th>
                        <th className="px-4 py-3 text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((item: Supplier) => {
                        // Calculate cost per portion
                        const portionValue = parseFloat(item.portionSize) || 1;
                        const costPerPortion = (item.cost / portionValue).toFixed(2);
                        
                        return (
                          <tr key={item.item} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.item}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">฿{item.cost.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{item.packagingQty}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{item.portionSize}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">฿{costPerPortion}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{item.supplier}</td>
                            <td className="px-4 py-3">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                Edit
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Purchasing;
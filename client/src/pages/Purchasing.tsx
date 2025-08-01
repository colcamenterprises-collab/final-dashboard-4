import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package, Plus, Search, FileText, DollarSign, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { JussiChatBubble } from "@/components/JussiChatBubble";


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
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 max-w-7xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Operations & Sales</h1>
        <p className="text-gray-600 text-xs sm:text-sm lg:text-base">Manage daily operations, purchasing, expenses, and reporting</p>
        
        {/* Navigation to other Operations sections */}
        <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
          <Link href="/daily-sales-stock">
            <Button variant="outline" className="px-3 py-2">
              <FileText className="h-4 w-4 mr-2" />
              Daily Sales & Stock
            </Button>
          </Link>
          <Button variant="outline" className="px-3 py-2 bg-gray-200 text-gray-800 border-gray-300 cursor-default">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Purchasing (Current)
          </Button>
          <Link href="/expenses">
            <Button variant="outline" className="px-3 py-2">
              <DollarSign className="h-4 w-4 mr-2" />
              Expenses
            </Button>
          </Link>
          <Link href="/reports-analysis">
            <Button variant="outline" className="px-3 py-2">
              <BarChart3 className="h-4 w-4 mr-2" />
              <span className="text-xs sm:text-sm font-medium">Reports & Analysis</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">Purchasing</h2>
        <p className="text-gray-600 text-xs sm:text-sm lg:text-base">Manage shopping requirements and supplier information</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
          <TabsTrigger value="shopping" className="text-xs sm:text-sm lg:text-base">
            <ShoppingCart className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Shopping Requirements</span>
            <span className="sm:hidden">Shopping</span>
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="text-xs sm:text-sm lg:text-base">
            <Package className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Suppliers</span>
            <span className="sm:hidden">Suppliers</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="shopping" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Shopping Requirements</h3>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <Search className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Search Items</span>
                <span className="sm:hidden">Search</span>
              </Button>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Shopping Requirements</CardTitle>
              <CardDescription>View and manage shopping requirements generated from daily forms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Shopping requirements will appear here when generated from Daily Sales & Stock forms.
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
                <Badge className="bg-black text-white rounded-md">{catItems.length} items</Badge>
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

      {/* Jussi Chat Bubble for Operations Support */}
      <JussiChatBubble />
    </div>
  );
};

export default Purchasing;
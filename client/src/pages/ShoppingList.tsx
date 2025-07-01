import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Bot, Send, Truck, Apple, Pizza, Croissant } from "lucide-react";
import { api, mutations } from "@/lib/api";

export default function ShoppingList() {
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: "",
    unit: "lbs",
    supplier: "",
    pricePerUnit: "",
    priority: "medium"
  });

  const { data: shoppingList, isLoading } = useQuery({
    queryKey: ["/api/shopping-list"],
    queryFn: api.getShoppingList
  });

  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
    queryFn: api.getSuppliers
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: any }) => 
      mutations.updateShoppingListItem(id, updates)
  });

  const deleteItemMutation = useMutation({
    mutationFn: mutations.deleteShoppingListItem
  });

  const generateListMutation = useMutation({
    mutationFn: mutations.generateShoppingList
  });

  const createItemMutation = useMutation({
    mutationFn: mutations.createShoppingListItem
  });

  const handleCheckboxChange = (id: number, selected: boolean) => {
    updateItemMutation.mutate({ id, updates: { selected } });
  };

  const handleDeleteItem = (id: number) => {
    deleteItemMutation.mutate(id);
  };

  const handleGenerateList = () => {
    generateListMutation.mutate();
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    createItemMutation.mutate({
      ...newItem,
      selected: false,
      aiGenerated: false
    });
    setNewItem({
      itemName: "",
      quantity: "",
      unit: "lbs",
      supplier: "",
      pricePerUnit: "",
      priority: "medium"
    });
  };

  const getItemIcon = (itemName: string) => {
    const name = itemName.toLowerCase();
    if (name.includes('tomato') || name.includes('apple') || name.includes('produce')) {
      return <Apple className="text-gray-600" />;
    } else if (name.includes('cheese') || name.includes('dairy')) {
      return <Pizza className="text-gray-600" />;
    } else if (name.includes('bread') || name.includes('flour') || name.includes('dough')) {
      return <Croissant className="text-gray-600" />;
    }
    return <Apple className="text-gray-600" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalCost = shoppingList?.reduce((total, item) => 
    total + (parseFloat(item.quantity) * parseFloat(item.pricePerUnit || '0')), 0
  ) || 0;

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Shopping List</h1>
        <div className="flex flex-col xs:flex-row items-start xs:items-center space-y-2 xs:space-y-0 xs:space-x-4">
          <Button 
            className="restaurant-primary w-full xs:w-auto"
            onClick={handleGenerateList}
            disabled={generateListMutation.isPending}
          >
            <Bot className="mr-2 h-4 w-4" />
            Auto Generate
          </Button>
          <Button className="bg-green-600 text-white hover:bg-green-700 w-full xs:w-auto">
            <Send className="mr-2 h-4 w-4" />
            Send Orders
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Shopping List */}
        <div className="lg:col-span-2">
          <Card className="restaurant-card">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold text-gray-900">Current Shopping List</CardTitle>
                <Button variant="ghost" className="text-primary hover:text-primary-dark text-sm font-medium">
                  <Plus className="mr-1 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {shoppingList?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={(checked) => handleCheckboxChange(item.id, checked as boolean)}
                      />
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          {getItemIcon(item.itemName)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                          <p className="text-xs text-gray-500">{item.supplier}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{item.quantity} {item.unit}</p>
                        <p className="text-xs text-gray-500">${item.pricePerUnit}/{item.unit}</p>
                      </div>
                      <Badge variant="secondary" className={`text-xs ${getPriorityColor(item.priority)}`}>
                        {item.priority === 'high' ? 'High Priority' : 
                         item.priority === 'medium' ? 'Medium' : 'Low'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-gray-400 hover:text-red-600"
                        disabled={deleteItemMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total Estimated Cost</span>
                  <span className="text-xl font-bold text-primary">${totalCost.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Item Form */}
          <Card className="restaurant-card mt-6">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Add New Item</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Item Name</Label>
                  <Input
                    value={newItem.itemName}
                    onChange={(e) => setNewItem(prev => ({ ...prev, itemName: e.target.value }))}
                    placeholder="Enter item name"
                    required
                  />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select value={newItem.unit} onValueChange={(value) => setNewItem(prev => ({ ...prev, unit: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lbs">lbs</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="pieces">pieces</SelectItem>
                      <SelectItem value="gallons">gallons</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Price per Unit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.pricePerUnit}
                    onChange={(e) => setNewItem(prev => ({ ...prev, pricePerUnit: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Input
                    value={newItem.supplier}
                    onChange={(e) => setNewItem(prev => ({ ...prev, supplier: e.target.value }))}
                    placeholder="Enter supplier name"
                    required
                  />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={newItem.priority} onValueChange={(value) => setNewItem(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="restaurant-primary" disabled={createItemMutation.isPending}>
                    Add Item
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Suppliers & AI Suggestions */}
        <div className="space-y-6">
          {/* Suppliers */}
          <Card className="restaurant-card">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Preferred Suppliers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suppliers?.map((supplier) => (
                  <div key={supplier.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <Truck className="text-primary text-sm" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
                        <p className="text-xs text-gray-500">{supplier.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-green-600">{supplier.status}</p>
                      <p className="text-xs text-gray-500">{supplier.deliveryTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Suggestions */}
          <Card className="restaurant-card">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                <Bot className="inline mr-2 text-primary" />
                AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">Bulk Discount Available</p>
                  <p className="text-sm text-gray-700 mt-1">Order 75+ lbs of tomatoes to get 15% discount from FreshCorp.</p>
                  <Button size="sm" className="mt-2 restaurant-primary">
                    Apply Suggestion
                  </Button>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">Alternative Supplier</p>
                  <p className="text-sm text-blue-700 mt-1">CheeseMart offers same quality mozzarella at $5.20/lb vs current $5.80/lb.</p>
                  <Button size="sm" variant="outline" className="mt-2 border-blue-600 text-blue-600 hover:bg-blue-50">
                    Switch Supplier
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

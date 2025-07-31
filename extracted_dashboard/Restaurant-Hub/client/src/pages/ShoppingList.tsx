import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Bot, Send, Truck, Apple, Pizza, Croissant, History, Calendar, CheckCircle, DollarSign } from "lucide-react";
import { api, mutations } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ShoppingList() {
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: "",
    unit: "lbs",
    supplier: "",
    pricePerUnit: "",
    priority: "medium"
  });
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [actualCost, setActualCost] = useState("");
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shoppingList, isLoading } = useQuery({
    queryKey: ["/api/shopping-list"],
  });

  const { data: shoppingListHistory } = useQuery({
    queryKey: ["/api/shopping-list/history"],
  });

  const { data: shoppingListByDate } = useQuery({
    queryKey: ["/api/shopping-list/by-date", selectedDate],
    enabled: !!selectedDate,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  const { data: ingredients } = useQuery({
    queryKey: ["/api/ingredients"],
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: any }) => 
      fetch(`/api/shopping-list/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list/history"] });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => 
      fetch(`/api/shopping-list/${id}`, { method: 'DELETE' }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list/history"] });
    }
  });

  const completeShoppingListMutation = useMutation({
    mutationFn: ({ listIds, actualCost }: { listIds: number[]; actualCost?: number }) =>
      fetch('/api/shopping-list/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listIds, actualCost })
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list/history"] });
      setSelectedItems([]);
      setActualCost("");
      setCompletionDialogOpen(false);
      toast({ title: "Shopping list completed successfully!" });
    }
  });

  const createItemMutation = useMutation({
    mutationFn: (item: any) =>
      fetch('/api/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list/history"] });
    }
  });

  const handleCheckboxChange = (id: number, selected: boolean) => {
    updateItemMutation.mutate({ id, updates: { selected } });
    
    // Update selected items for completion
    if (selected) {
      setSelectedItems(prev => [...prev, id]);
    } else {
      setSelectedItems(prev => prev.filter(itemId => itemId !== id));
    }
  };

  const handleDeleteItem = (id: number) => {
    deleteItemMutation.mutate(id);
  };

  const handleCompleteShoppingList = () => {
    if (selectedItems.length === 0) {
      toast({ title: "Please select items to complete", variant: "destructive" });
      return;
    }
    
    const cost = actualCost ? parseFloat(actualCost) : undefined;
    completeShoppingListMutation.mutate({ listIds: selectedItems, actualCost: cost });
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

  // Calculate total cost with estimated pricing from ingredient database
  const getEstimatedCost = (item: any) => {
    // Use the estimatedCost field if available (from enhanced generation)
    if (item.estimatedCost && parseFloat(item.estimatedCost) > 0) {
      return parseFloat(item.estimatedCost);
    }
    
    if (item.pricePerUnit && parseFloat(item.pricePerUnit) > 0) {
      return parseFloat(item.quantity) * parseFloat(item.pricePerUnit);
    }
    
    // Try to find matching ingredient for cost estimation
    if (Array.isArray(ingredients)) {
      const matchingIngredient = ingredients.find((ing: any) => 
        ing.name.toLowerCase().includes(item.itemName.toLowerCase()) ||
        item.itemName.toLowerCase().includes(ing.name.toLowerCase())
      );
      
      if (matchingIngredient) {
        const unitPrice = parseFloat(matchingIngredient.unitPrice);
        const packageSize = parseFloat(matchingIngredient.packageSize) || 1;
        const pricePerUnit = unitPrice / packageSize;
        return parseFloat(item.quantity) * pricePerUnit;
      }
    }
    
    return 0;
  };

  const totalCost = shoppingList?.reduce((total, item) => 
    total + getEstimatedCost(item), 0
  ) || 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(amount);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Shopping List</h1>
        <div className="flex flex-col xs:flex-row items-start xs:items-center space-y-2 xs:space-y-0 xs:space-x-4">
          <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-green-600 text-white hover:bg-green-700 w-full xs:w-auto"
                disabled={selectedItems.length === 0}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Shopping ({selectedItems.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Complete Shopping List</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="actualCost">Actual Total Cost (Optional)</Label>
                  <Input
                    id="actualCost"
                    type="number"
                    placeholder="Enter actual cost spent"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setCompletionDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCompleteShoppingList} disabled={completeShoppingListMutation.isPending}>
                    Complete Shopping List
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current">Current List</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="by-date">By Date</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Current Shopping List */}
            <div className="lg:col-span-2">
              <Card className="restaurant-card">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      Current Shopping List 
                      {totalCost > 0 && (
                        <span className="ml-2 text-sm font-normal text-green-600">
                          (Estimated: {formatCurrency(totalCost)})
                        </span>
                      )}
                    </CardTitle>
                    <Button variant="ghost" className="text-primary hover:text-primary-dark text-sm font-medium">
                      <Plus className="mr-1 h-4 w-4" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {shoppingList?.map((item) => (
                      <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors space-y-3 sm:space-y-0">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <Checkbox
                            checked={item.selected || selectedItems.includes(item.id)}
                            onCheckedChange={(checked) => handleCheckboxChange(item.id, checked as boolean)}
                          />
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              {getItemIcon(item.itemName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.itemName}</p>
                              <p className="text-xs text-gray-500 truncate">{item.supplier}</p>
                              {item.estimatedCost && parseFloat(item.estimatedCost) > 0 && (
                                <p className="text-xs text-green-600 font-medium">
                                  Est: {formatCurrency(parseFloat(item.estimatedCost))}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-4">
                          <div className="text-left sm:text-right">
                            <p className="text-sm font-medium text-gray-900">{item.quantity} {item.unit}</p>
                            <p className="text-xs text-gray-500">
                              ฿{item.pricePerUnit || (getEstimatedCost(item) / parseFloat(item.quantity || '1')).toFixed(2)}/{item.unit}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <Badge variant="secondary" className={`text-xs ${getPriorityColor(item.priority)}`}>
                              {item.priority === 'high' ? 'High' : 
                               item.priority === 'medium' ? 'Med' : 'Low'}
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
                  </div>
                ))}
                
                {(!shoppingList || shoppingList.length === 0) && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No items in your shopping list yet.</p>
                    <p className="text-sm text-gray-400">Add items manually or they'll be generated automatically from Daily Stock & Sales forms.</p>
                  </div>
                )}
              </div>

              {totalCost > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total Estimated Cost</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(totalCost)}</span>
                  </div>
                </div>
              )}
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
    </TabsContent>

    <TabsContent value="history" className="space-y-6">
      <Card className="restaurant-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <History className="mr-2 h-5 w-5" />
            Shopping List History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {shoppingListHistory?.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-gray-900">{item.itemName}</p>
                    <p className="text-sm text-gray-500">{item.quantity} {item.unit} from {item.supplier}</p>
                    {item.listName && (
                      <p className="text-xs text-blue-600">{item.listName}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {item.actualCost ? formatCurrency(parseFloat(item.actualCost)) : 
                     item.estimatedCost ? formatCurrency(parseFloat(item.estimatedCost)) : 
                     'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.completedAt ? formatDate(item.completedAt) : formatDate(item.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            
            {(!shoppingListHistory || shoppingListHistory.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-500">No completed shopping lists yet.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="by-date" className="space-y-6">
      <Card className="restaurant-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Shopping Lists by Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="date-filter">Select Date</Label>
            <Input
              id="date-filter"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="max-w-xs"
            />
          </div>
          
          <div className="space-y-4">
            {shoppingListByDate?.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    {getItemIcon(item.itemName)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.itemName}</p>
                    <p className="text-sm text-gray-500">{item.quantity} {item.unit} from {item.supplier}</p>
                    {item.notes && (
                      <p className="text-xs text-gray-400">{item.notes}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {item.estimatedCost ? formatCurrency(parseFloat(item.estimatedCost)) : 'N/A'}
                  </p>
                  <Badge variant="outline" className={`text-xs ${getPriorityColor(item.priority)}`}>
                    {item.priority}
                  </Badge>
                </div>
              </div>
            ))}
            
            {(!shoppingListByDate || shoppingListByDate.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-500">No shopping lists found for {formatDate(selectedDate)}.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</div>
  );
}

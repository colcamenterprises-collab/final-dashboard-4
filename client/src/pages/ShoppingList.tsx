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
import { Trash2, Plus, Bot, Send, Truck, Apple, Pizza, Croissant, History, Calendar, CheckCircle, DollarSign, Snowflake, Package, Droplets, ChefHat, ShoppingBag, Utensils } from "lucide-react";
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
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [actualCost, setActualCost] = useState("");
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shoppingListData, isLoading } = useQuery({
    queryKey: ["/api/shopping-list"],
  });

  const { groupedList = {}, totalItems = 0 } = shoppingListData || {};

  const { data: shoppingListHistory } = useQuery({
    queryKey: ["/api/shopping-list", { history: true, date: historyDate }],
    queryFn: () => fetch(`/api/shopping-list?history=true&date=${historyDate}`).then(res => res.json())
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
      // Invalidate all shopping-list related queries including history and by-date
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as string[];
          return queryKey[0] === "/api/shopping-list" || queryKey[0] === "/api/shopping-list/by-date";
        }
      });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => 
      fetch(`/api/shopping-list/${id}`, { method: 'DELETE' }).then(res => res.json()),
    onSuccess: () => {
      // Invalidate all shopping-list related queries including history and by-date
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as string[];
          return queryKey[0] === "/api/shopping-list" || queryKey[0] === "/api/shopping-list/by-date";
        }
      });
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
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list/by-date"] });
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
      // Invalidate all shopping-list related queries including history and by-date
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey as string[];
          return queryKey[0] === "/api/shopping-list" || queryKey[0] === "/api/shopping-list/by-date";
        }
      });
    }
  });

  const regenerateShoppingListMutation = useMutation({
    mutationFn: () =>
      fetch('/api/shopping-list/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(res => res.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-list/by-date"] });
      toast({ 
        title: "Shopping list regenerated successfully!",
        description: `Generated ${data.itemsGenerated} items from last completed form`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to regenerate shopping list",
        description: error.message || "Please try again later",
        variant: "destructive"
      });
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

  const getItemIcon = (item: any) => {
    // Use the notes field to determine category
    const notes = item.notes?.toLowerCase() || '';
    
    if (notes.includes('fresh food')) {
      return <Apple className="text-green-600" />;
    } else if (notes.includes('frozen food')) {
      return <Snowflake className="text-blue-600" />;
    } else if (notes.includes('shelf items')) {
      return <Package className="text-amber-600" />;
    } else if (notes.includes('drink stock')) {
      return <Droplets className="text-cyan-600" />;
    } else if (notes.includes('kitchen items')) {
      return <ChefHat className="text-purple-600" />;
    } else if (notes.includes('packaging items')) {
      return <ShoppingBag className="text-gray-600" />;
    } else if (notes.includes('stock count')) {
      // For main stock items (burger buns, meat, rolls)
      if (item.itemName?.toLowerCase().includes('bun')) {
        return <Croissant className="text-orange-600" />;
      } else if (item.itemName?.toLowerCase().includes('meat')) {
        return <Utensils className="text-red-600" />;
      } else if (item.itemName?.toLowerCase().includes('roll')) {
        return <Croissant className="text-orange-600" />;
      }
      return <Package className="text-gray-600" />;
    }
    
    // Fallback icon
    return <Package className="text-gray-600" />;
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

  // CSV Export function
  const exportCSV = () => {
    let csv = 'Category,Item,Quantity\n';
    for (const category in groupedList) {
      groupedList[category].forEach((item: any) => {
        csv += `${category},${item.name},${item.qty}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopping-list.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCost = 0; // Cost calculation removed as per requirements

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(amount);
  };

  // Helper function for rendering grouped shopping list
  const renderGroupedList = () => (
    Object.entries(groupedList || {}).map(([category, items]: [string, any[]]) => (
      <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 font-semibold text-gray-900">{category}</div>
        <div className="overflow-x-auto md:overflow-visible">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-3/4">Item</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-1/4">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((it: any, idx: number) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm text-gray-900 truncate">{it.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-center">{it.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ))
  );

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Shopping List</h1>
        <div className="flex flex-col xs:flex-row items-start xs:items-center space-y-2 xs:space-y-0 xs:space-x-4">
          <Button 
            onClick={() => regenerateShoppingListMutation.mutate()}
            disabled={regenerateShoppingListMutation.isPending}
            className="bg-blue-600 text-white hover:bg-blue-700 w-full xs:w-auto"
          >
            <Bot className="mr-2 h-4 w-4" />
            {regenerateShoppingListMutation.isPending ? "Regenerating..." : "Regenerate from Last Form"}
          </Button>
          <Button 
            onClick={exportCSV}
            variant="outline"
            disabled={totalItems === 0}
            className="w-full xs:w-auto"
          >
            <Package className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
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
                      Shopping List
                      <span className="ml-2 text-sm font-normal text-blue-600">
                        Total Items: {totalItems}
                      </span>
                    </CardTitle>
                    <Button variant="ghost" className="text-primary hover:text-primary-dark text-sm font-medium">
                      <Plus className="mr-1 h-4 w-4" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.keys(groupedList || {}).length > 0 ? (
                      renderGroupedList()
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500 mb-4">No items in your shopping list yet.</p>
                        <p className="text-sm text-gray-400">Click "Regenerate from Last Form" to generate items from your latest daily form.</p>
                      </div>
                    )}
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

      </div>
    </TabsContent>

    <TabsContent value="history" className="space-y-6">
      <Card className="restaurant-card">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
              <History className="mr-2 h-5 w-5" />
              Shopping List History
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Label htmlFor="history-date-picker">Date:</Label>
              <Input
                id="history-date-picker"
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto md:overflow-visible">
            {shoppingListHistory?.history && shoppingListHistory.history.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shoppingListHistory.history.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.total_items || 0}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{formatCurrency(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No history found for {new Date(historyDate).toLocaleDateString()}.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="by-date" className="space-y-6">
      <Card className="restaurant-card">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Shopping List by Date
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Label htmlFor="date-picker">Select Date:</Label>
              <Input
                id="date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.isArray(shoppingListByDate) && shoppingListByDate.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getItemIcon(item)}
                  <div>
                    <p className="font-medium text-gray-900">{item.itemName}</p>
                    <p className="text-sm text-gray-500">{item.quantity} {item.unit} from {item.supplier}</p>
                    <Badge className={getPriorityColor(item.priority)} variant="secondary">
                      {item.priority} priority
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(getEstimatedCost(item))}</p>
                  <p className="text-xs text-gray-500">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            ))}
            {(!Array.isArray(shoppingListByDate) || shoppingListByDate.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-500">No shopping list found for {formatDate(selectedDate)}.</p>
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
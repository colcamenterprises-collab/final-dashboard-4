import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Download, Upload, RefreshCw, Search, Crown, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateIngredientCosts, THB as formatTHB, formatUnitPrice, CalculatedIngredient } from "@/utils/ingredientCalculations";

// Types
type Ingredient = {
  id: string;
  name: string;
  category: string;
  supplier: string;
  brand?: string;
  cost: number;
  costDisplay?: string;
  unit: string;
  packageSize?: string;
  portionSize?: string;
  unitPrice?: number;
  costPerPortion?: number;
  lastReview?: string;
  source?: string; // 'god' | 'manual'
  calculations?: CalculatedIngredient;
};

// THB formatter moved to utils file

const categories = ["All", "Meat", "Drinks", "Fresh Food", "Frozen Food", "Kitchen Supplies", "Packaging", "Shelf Items"];

export default function IngredientManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    category: '',
    supplier: '',
    brand: '',
    packageSize: '',
    unitPrice: '',
    portion: ''
  });

  // Data queries - Direct from foodCostings.ts god file
  const { data: ingredients = [], isLoading, refetch, error } = useQuery({
    queryKey: ['ingredients-god-file'],
    queryFn: async () => {
      console.log('Fetching from god file endpoint...');
      const response = await fetch('/api/ingredients/god-file');
      if (!response.ok) {
        throw new Error('Failed to fetch god file data');
      }
      const data = await response.json();
      console.log('God file data received:', data.total, 'items');
      console.log('First item:', data.list?.[0]);
      
      return (data.list || []).map((x: any) => {
        // Calculate costs using utility functions
        const calculations = calculateIngredientCosts(
          x.cost || '฿0.00',
          x.packagingQty || '',
          x.averageMenuPortion || ''
        );
        
        return {
          id: x.id,
          name: x.item || x.name,
          category: x.category,
          supplier: x.supplier,
          brand: x.brand || '',
          cost: x.costNumber || Number(x.cost?.replace(/[^\d.]/g, '') || 0),
          costDisplay: x.cost || '',
          unit: 'various',
          packageSize: x.packagingQty || '',
          portionSize: x.averageMenuPortion || '',
          unitPrice: calculations.unitPrice,
          costPerPortion: calculations.costPerPortion,
          lastReview: x.lastReviewDate || '',
          source: 'god', // All from god file
          calculations
        };
      });
    }
  });

  console.log('Ingredients loaded:', ingredients.length);
  console.log('Loading state:', isLoading);
  console.log('Error state:', error);
  if (ingredients.length > 0) {
    console.log('First ingredient:', ingredients[0]);
  }

  // Mutations
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ingredients/sync-god', { method: 'POST' });
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "God File Synced", 
        description: data.message || "Synced from foodCostings.ts" 
      });
      refetch();
    },
    onError: () => {
      toast({ 
        title: "Sync Failed", 
        description: "Failed to sync from god file", 
        variant: "destructive" 
      });
    }
  });

  // Reverse sync mutation - sync TO god file
  const syncToGodFileMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/ingredients/sync-to-god', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: filteredIngredients })
      });
      if (!response.ok) throw new Error('Reverse sync failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Synced to God File", 
        description: data.message || "Updated foodCostings.ts with current data" 
      });
    },
    onError: () => {
      toast({ 
        title: "Sync to God File Failed", 
        description: "Failed to update god file", 
        variant: "destructive" 
      });
    }
  });

  // Filtered data
  const filteredIngredients = useMemo(() => {
    return ingredients.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                          item.supplier.toLowerCase().includes(search.toLowerCase()) ||
                          item.brand?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [ingredients, search, categoryFilter]);

  // Stats
  const stats = useMemo(() => {
    const godItems = ingredients.filter(i => i.source === 'god').length;
    const manualItems = ingredients.filter(i => i.source === 'manual').length;
    const categories = [...new Set(ingredients.map(i => i.category))].length;
    const suppliers = [...new Set(ingredients.map(i => i.supplier))].length;
    
    return { godItems, manualItems, categories, suppliers, total: ingredients.length };
  }, [ingredients]);

  function exportCSV() {
    const csvData = [
      ['Name', 'Category', 'Supplier', 'Brand', 'Package Cost', 'Package Size', 'Unit Price', 'Portion Size', 'Cost Per Portion', 'Last Review', 'Source'],
      ...filteredIngredients.map(item => [
        item.name,
        item.category,
        item.supplier,
        item.brand || '',
        item.costDisplay || '',
        item.packageSize || '',
        item.unitPrice ? formatUnitPrice(item.unitPrice, item.calculations?.packageSize?.unit || 'unit') : '',
        item.portionSize || '',
        item.costPerPortion ? formatTHB(item.costPerPortion) : '',
        item.lastReview || '',
        item.source || 'manual'
      ])
    ];
    
    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ingredients-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading foodCostings.ts data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">Error loading god file: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="bg-[#f5f7f8] min-h-screen px-6 sm:px-8 py-5" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-[32px] font-extrabold tracking-tight text-gray-900">Ingredient Management</h1>
        <div className="flex gap-3 items-center">
          <Button 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            <Crown className="h-4 w-4 mr-2" />
            {syncMutation.isPending ? "Syncing..." : "Sync from God File"}
          </Button>
          <Button 
            onClick={() => syncToGodFileMutation.mutate()}
            disabled={syncToGodFileMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Upload className="h-4 w-4 mr-2" />
            {syncToGodFileMutation.isPending ? "Syncing..." : "Sync to God File"}
          </Button>
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.godItems}</div>
            <div className="text-sm text-gray-600">God File Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.manualItems}</div>
            <div className="text-sm text-gray-600">Manual Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.categories}</div>
            <div className="text-sm text-gray-600">Categories</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.suppliers}</div>
            <div className="text-sm text-gray-600">Suppliers</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search ingredients, suppliers, brands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Ingredient</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
                Note: Manual items will be marked as 'manual' source. Use "Sync from God File" to reset to foodCostings.ts data.
              </div>
              <Input 
                placeholder="Ingredient name" 
                value={newItemForm.name}
                onChange={(e) => setNewItemForm(prev => ({...prev, name: e.target.value}))}
              />
              <Select 
                value={newItemForm.category}
                onValueChange={(value) => setNewItemForm(prev => ({...prev, category: value}))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c !== "All").map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                placeholder="Supplier" 
                value={newItemForm.supplier}
                onChange={(e) => setNewItemForm(prev => ({...prev, supplier: e.target.value}))}
              />
              <Input 
                placeholder="Brand" 
                value={newItemForm.brand}
                onChange={(e) => setNewItemForm(prev => ({...prev, brand: e.target.value}))}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Package Size (e.g., 1000g)</label>
                  <Input 
                    type="text" 
                    name="packageSize" 
                    placeholder="1000g" 
                    value={newItemForm.packageSize}
                    onChange={(e) => setNewItemForm(prev => ({...prev, packageSize: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unit Price (THB)</label>
                  <Input 
                    type="number" 
                    name="unitPrice" 
                    placeholder="319" 
                    value={newItemForm.unitPrice}
                    onChange={(e) => setNewItemForm(prev => ({...prev, unitPrice: e.target.value}))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Portion Size</label>
                <Input 
                  placeholder="e.g., 95g" 
                  value={newItemForm.portion}
                  onChange={(e) => setNewItemForm(prev => ({...prev, portion: e.target.value}))}
                />
              </div>
              <p className="text-sm">
                <strong>Cost per Portion:</strong> {
                  newItemForm.portion && newItemForm.packageSize && newItemForm.unitPrice ? 
                  (parseFloat(newItemForm.portion) / parseFloat(newItemForm.packageSize) * parseFloat(newItemForm.unitPrice)).toFixed(3) + ' THB' : 
                  'N/A'
                }
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={() => setIsAddDialogOpen(false)}
                  className="flex-1"
                  disabled
                >
                  Save (Coming Soon)
                </Button>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Ingredients Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Ingredients ({filteredIngredients.length} of {ingredients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Package Cost</TableHead>
                  <TableHead>Package Size</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead>Portion Size</TableHead>
                  <TableHead className="text-right">Cost/Portion</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.map((item, index) => (
                  <TableRow key={item.id} className={index % 2 === 0 ? "bg-gray-50/50" : ""}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
                    </TableCell>
                    <TableCell>{item.supplier}</TableCell>
                    <TableCell>{item.brand || "-"}</TableCell>
                    <TableCell className="text-right font-mono">{item.costDisplay || formatTHB(item.cost)}</TableCell>
                    <TableCell className="text-sm">{item.packageSize || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {item.unitPrice > 0 ? (
                        <div className="space-y-1">
                          <div>{formatUnitPrice(item.unitPrice, item.calculations?.packageSize?.unit || 'unit')}</div>
                          {item.calculations?.calculationNote && (
                            <div className="text-xs text-gray-500 max-w-32 truncate" title={item.calculations.calculationNote}>
                              <Calculator className="h-3 w-3 inline mr-1" />
                              Calculated
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{item.portionSize || "-"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {item.costPerPortion > 0 ? (
                        <div className="space-y-1">
                          <div className="text-green-700">{formatTHB(item.costPerPortion)}</div>
                          <div className="text-xs text-gray-500">per portion</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={item.source === 'god' ? "default" : "secondary"}
                        className={item.source === 'god' ? "bg-yellow-100 text-yellow-800" : ""}
                      >
                        {item.source === 'god' ? (
                          <><Crown className="h-3 w-3 mr-1" />God</>
                        ) : (
                          'Manual'
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{item.lastReview || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled
                          onClick={() => {
                            setEditingItem(item);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {item.source === 'manual' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Ingredient</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{item.name}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction disabled>Delete (Coming Soon)</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredIngredients.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No ingredients found matching your search criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Panel */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="text-sm text-gray-600 space-y-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-600" />
              <strong>God File Items:</strong> Sourced from foodCostings.ts (66 items). Use "Sync from God File" to reset any changes.
            </div>
            <div className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-blue-600" />
              <strong>Manual Items:</strong> Added via UI. Will persist until manually deleted or god file sync overwrites.
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-green-600" />
              <strong>Sync Strategy:</strong> foodCostings.ts is the permanent source of truth. Manual edits supplement but can be reset.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
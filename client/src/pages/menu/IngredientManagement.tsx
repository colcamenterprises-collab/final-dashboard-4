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

  // Data queries - Using enhanced database API
  const { data: apiResponse = { items: [] }, isLoading, refetch, error } = useQuery({
    queryKey: ['/api/ingredients'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Transform the enhanced API data (items array contains enriched ingredients)
  const rawIngredients = apiResponse.items || apiResponse || []; // Handle both {items:[]} and array formats
  const ingredients = rawIngredients.map((x: any) => {
    // Enhanced API returns: supplierName, packageCost, packageQty, packageUnit, etc.
    const costDisplay = `฿${Number(x.packageCost || 0).toFixed(2)}`;
    const packageSizeText = (x.packageQty && x.packageUnit) ? `${x.packageQty} ${x.packageUnit}` : 'N/A';
    const portionSizeText = (x.portionQty && x.portionUnit) ? `${x.portionQty} ${x.portionUnit}` : '';
    
    const calculations = calculateIngredientCosts(
      costDisplay,
      packageSizeText,
      portionSizeText
    );
    
    return {
      id: x.id,
      name: x.name,
      category: x.categoryId || x.category,
      supplier: x.supplierName || x.supplier || 'N/A',
      brand: x.brand || '',
      cost: Number(x.packageCost || 0),
      costDisplay: costDisplay,
      unit: x.packageUnit || 'unit',
      packageSize: packageSizeText,
      portionSize: portionSizeText,
      unitPrice: x.unitPrice || calculations.unitPrice,
      costPerPortion: x.costPerPortion || calculations.costPerPortion,
      lastReview: x.lastReview || '',
      source: 'api', // From new API
      calculations
    };
  });

  console.log('Ingredients loaded:', ingredients.length);
  console.log('Loading state:', isLoading);
  console.log('Error state:', error);
  if (ingredients.length > 0) {
    console.log('First ingredient:', ingredients[0]);
  }

  // Mutations - Refresh data from API
  const syncMutation = useMutation({
    mutationFn: async () => {
      // Just refresh the data from the API
      await queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      return { message: "Refreshed ingredient data" };
    },
    onSuccess: (data) => {
      toast({ 
        title: "Ingredients Refreshed", 
        description: data.message || "Refreshed ingredient data" 
      });
      refetch();
    },
    onError: () => {
      toast({ 
        title: "Refresh Failed", 
        description: "Failed to refresh ingredient data", 
        variant: "destructive" 
      });
    }
  });

  // Sync to God File - Frontend as god source
  const syncToGodFile = async () => {
    try {
      // Get current ingredients data (frontend as source of truth)
      const { data } = { data: ingredients }; // Use current frontend data
      
      // Generate CSV in exact format specified
      const csv = 'Name,Category,Supplier,Brand,SKU,Cost,Packaging,Portion,MinStock,Reviewed,Notes\n' + 
        data.map(i => `${i.name || ''},${i.category || ''},${i.supplier || ''},${i.brand || ''},${i.id || ''},${i.costDisplay || i.cost || ''},${i.packageSize || ''},${i.portionSize || ''},${i.minStock || ''},${i.lastReview || ''},${i.notes || ''}`).join('\n');
      
      console.log('Sync to God File - CSV Content:', csv.slice(0, 200) + '...');
      
      // Download CSV file
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'god_ingredients.csv';
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ 
        title: "Synced to God File", 
        description: `Exported ${data.length} ingredients to CSV` 
      });
      
      // v2: POST to Google Sheets API if token available
      // Future enhancement for direct Google Sheets integration
      
    } catch (error) {
      console.error('Sync to God File error:', error);
      toast({ 
        title: "Sync Failed", 
        description: "Failed to export ingredients", 
        variant: "destructive" 
      });
    }
  };

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
    <div className="p-4" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-baseline md:justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Ingredient Management</h1>
        <div className="flex flex-col gap-2 md:flex-row md:gap-3 md:items-center">
          <Button 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-[4px] w-full md:w-auto"
          >
            <Crown className="h-4 w-4 mr-2" />
            {syncMutation.isPending ? "Syncing..." : "Sync from God File"}
          </Button>
          <Button 
            onClick={syncToGodFile}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-[4px] w-full md:w-auto"
          >
            <Upload className="h-4 w-4 mr-2" />
            Sync to God File
          </Button>
          <Button onClick={exportCSV} variant="outline" className="text-xs rounded-[4px] border-slate-200 w-full md:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-600">Total Items</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">{stats.godItems}</div>
            <div className="text-xs text-slate-600">God File Items</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{stats.manualItems}</div>
            <div className="text-xs text-slate-600">Manual Items</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">{stats.categories}</div>
            <div className="text-xs text-slate-600">Categories</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">{stats.suppliers}</div>
            <div className="text-xs text-slate-600">Suppliers</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-3 mb-4 md:flex-row">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search ingredients, suppliers, brands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-xs rounded-[4px] border-slate-200 w-full"
            />
          </div>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-48 text-xs rounded-[4px] border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-[4px]">
            {categories.map(cat => (
              <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px] w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[4px]">
            <DialogHeader>
              <DialogTitle className="text-sm">Add New Ingredient</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-[4px]">
                Note: Manual items will be marked as 'manual' source. Use "Sync from God File" to reset to foodCostings.ts data.
              </div>
              <Input 
                placeholder="Ingredient name" 
                value={newItemForm.name}
                onChange={(e) => setNewItemForm(prev => ({...prev, name: e.target.value}))}
                className="text-xs rounded-[4px] border-slate-200"
              />
              <Select 
                value={newItemForm.category}
                onValueChange={(value) => setNewItemForm(prev => ({...prev, category: value}))}
              >
                <SelectTrigger className="text-xs rounded-[4px] border-slate-200">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="rounded-[4px]">
                  {categories.filter(c => c !== "All").map(cat => (
                    <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                placeholder="Supplier" 
                value={newItemForm.supplier}
                onChange={(e) => setNewItemForm(prev => ({...prev, supplier: e.target.value}))}
                className="text-xs rounded-[4px] border-slate-200"
              />
              <Input 
                placeholder="Brand" 
                value={newItemForm.brand}
                onChange={(e) => setNewItemForm(prev => ({...prev, brand: e.target.value}))}
                className="text-xs rounded-[4px] border-slate-200"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Package Size (e.g., 1000g)</label>
                  <Input 
                    type="text" 
                    name="packageSize" 
                    placeholder="1000g" 
                    value={newItemForm.packageSize}
                    onChange={(e) => setNewItemForm(prev => ({...prev, packageSize: e.target.value}))}
                    className="text-xs rounded-[4px] border-slate-200 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Unit Price (THB)</label>
                  <Input 
                    type="number" 
                    name="unitPrice" 
                    placeholder="319" 
                    value={newItemForm.unitPrice}
                    onChange={(e) => setNewItemForm(prev => ({...prev, unitPrice: e.target.value}))}
                    className="text-xs rounded-[4px] border-slate-200 mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Portion Size</label>
                <Input 
                  placeholder="e.g., 95g" 
                  value={newItemForm.portion}
                  onChange={(e) => setNewItemForm(prev => ({...prev, portion: e.target.value}))}
                  className="text-xs rounded-[4px] border-slate-200 mt-1"
                />
              </div>
              <p className="text-xs text-slate-700">
                <strong>Cost per Portion:</strong> {
                  newItemForm.portion && newItemForm.packageSize && newItemForm.unitPrice ? 
                  (parseFloat(newItemForm.portion) / parseFloat(newItemForm.packageSize) * parseFloat(newItemForm.unitPrice)).toFixed(3) + ' THB' : 
                  'N/A'
                }
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={() => setIsAddDialogOpen(false)}
                  className="flex-1 text-xs rounded-[4px]"
                  disabled
                >
                  Save (Coming Soon)
                </Button>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="text-xs rounded-[4px] border-slate-200">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Ingredients Table */}
      <Card className="border-slate-200" style={{ borderRadius: '4px' }}>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-900">
            Ingredients ({filteredIngredients.length} of {ingredients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {filteredIngredients.map((item) => (
              <Card key={item.id} className="border-slate-200" style={{ borderRadius: '4px' }}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{item.name}</div>
                      <Badge variant="outline" className="text-xs rounded-[4px] border-slate-200 mt-1">{item.category}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        disabled
                        className="text-xs h-7 w-7 p-0"
                        onClick={() => {
                          setEditingItem(item);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">Supplier</div>
                      <div className="text-slate-900">{item.supplier}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Brand</div>
                      <div className="text-slate-900">{item.brand || "-"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Package Cost</div>
                      <div className="font-mono text-slate-900">{item.costDisplay || formatTHB(item.cost)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Package Size</div>
                      <div className="text-slate-900">{item.packageSize || "-"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Portion Size</div>
                      <div className="text-slate-900">{item.portionSize || "-"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Cost/Portion</div>
                      <div className="font-mono font-semibold text-emerald-700">
                        {item.costPerPortion > 0 ? formatTHB(item.costPerPortion) : "-"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredIngredients.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500">
                No ingredients found matching your search criteria.
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200">
                  <TableHead className="text-xs font-medium text-slate-700">Name</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700">Category</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700">Supplier</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700">Brand</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700 text-right">Package Cost</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700">Package Size</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700 text-right">Unit Price</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700">Portion Size</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700 text-right">Cost/Portion</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700">Review</TableHead>
                  <TableHead className="text-xs font-medium text-slate-700 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.map((item, index) => (
                  <TableRow key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <TableCell className="text-xs font-medium text-slate-900">{item.name}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-xs rounded-[4px] border-slate-200">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">{item.supplier}</TableCell>
                    <TableCell className="text-xs text-slate-700">{item.brand || "-"}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-slate-900">{item.costDisplay || formatTHB(item.cost)}</TableCell>
                    <TableCell className="text-xs text-slate-700">{item.packageSize || "-"}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-slate-700">
                      {item.unitPrice > 0 ? (
                        <div className="space-y-1">
                          <div>{formatUnitPrice(item.unitPrice, item.calculations?.packageSize?.unit || 'unit')}</div>
                          {item.calculations?.calculationNote && (
                            <div className="text-xs text-slate-500 max-w-32 truncate" title={item.calculations.calculationNote}>
                              <Calculator className="h-3 w-3 inline mr-1" />
                              Calculated
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">{item.portionSize || "-"}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-semibold">
                      {item.costPerPortion > 0 ? (
                        <div className="space-y-1">
                          <div className="text-emerald-700">{formatTHB(item.costPerPortion)}</div>
                          <div className="text-xs text-slate-500 font-normal">per portion</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">{item.lastReview || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled
                          className="text-xs"
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
                              <Button variant="ghost" size="sm" disabled className="text-xs text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[4px]">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-sm">Delete Ingredient</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs">
                                  This will permanently delete "{item.name}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="text-xs rounded-[4px]">Cancel</AlertDialogCancel>
                                <AlertDialogAction disabled className="text-xs rounded-[4px]">Delete (Coming Soon)</AlertDialogAction>
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
              <div className="text-center py-8 text-xs text-slate-500">
                No ingredients found matching your search criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Panel */}
      <Card className="mt-4 border-slate-200" style={{ borderRadius: '4px' }}>
        <CardContent className="p-4">
          <div className="text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-600" />
              <strong>God File Items:</strong> Sourced from foodCostings.ts (66 items). Use "Sync from God File" to reset any changes.
            </div>
            <div className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-emerald-600" />
              <strong>Manual Items:</strong> Added via UI. Will persist until manually deleted or god file sync overwrites.
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-emerald-600" />
              <strong>Sync Strategy:</strong> foodCostings.ts is the permanent source of truth. Manual edits supplement but can be reset.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
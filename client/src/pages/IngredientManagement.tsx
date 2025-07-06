import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, Package, DollarSign, Building2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import type { Ingredient, InsertIngredient } from '@shared/schema';

const ingredientFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  unitPrice: z.string().min(1, "Unit price is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Unit price must be a positive number"),
  packageSize: z.string().min(1, "Package size is required"),
  unit: z.string().min(1, "Unit is required"),
  supplier: z.string().min(1, "Supplier is required"),
  notes: z.string().optional(),
});

const INGREDIENT_CATEGORIES = [
  'Fresh Food',
  'Frozen Food',
  'Shelf Stock',
  'Drinks',
  'Kitchen Supplies',
  'Packaging'
];

const COMMON_UNITS = [
  'grams',
  'kilograms',
  'pieces',
  'each',
  'units',
  'liters',
  'milliliters',
  'bottles',
  'cans',
  'packets',
  'bags',
  'boxes',
  'rolls',
  'sheets',
  'cups',
  'tablespoons',
  'teaspoons',
  'ounces',
  'pounds',
  'slices'
];

export default function IngredientManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  // Queries
  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['/api/ingredients'],
    queryFn: () => apiRequest('/api/ingredients'),
  });

  // Mutations
  const createIngredientMutation = useMutation({
    mutationFn: (data: InsertIngredient) => apiRequest('/api/ingredients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      setIsCreateDialogOpen(false);
      toast({ title: "Ingredient created successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create ingredient", description: error.message, variant: "destructive" });
    },
  });

  const updateIngredientMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertIngredient> }) => 
      apiRequest(`/api/ingredients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      setEditingIngredient(null);
      toast({ title: "Ingredient updated successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update ingredient", description: error.message, variant: "destructive" });
    },
  });

  const deleteIngredientMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/ingredients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      toast({ title: "Ingredient deleted successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete ingredient", description: error.message, variant: "destructive" });
    },
  });

  // Form setup
  const createForm = useForm<z.infer<typeof ingredientFormSchema>>({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: {
      name: '',
      category: '',
      unitPrice: '',
      packageSize: '',
      unit: '',
      supplier: '',
      notes: '',
    },
  });

  const editForm = useForm<z.infer<typeof ingredientFormSchema>>({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: {
      name: '',
      category: '',
      unitPrice: '',
      packageSize: '',
      unit: '',
      supplier: '',
      notes: '',
    },
  });

  // Filter ingredients
  const filteredIngredients = ingredients.filter((ingredient: Ingredient) => {
    const matchesSearch = ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ingredient.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || ingredient.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Form handlers
  const onCreateIngredient = (data: z.infer<typeof ingredientFormSchema>) => {
    createIngredientMutation.mutate({
      ...data,
      unitPrice: parseFloat(data.unitPrice).toString(),
    });
  };

  const onUpdateIngredient = (data: z.infer<typeof ingredientFormSchema>) => {
    if (!editingIngredient) return;
    updateIngredientMutation.mutate({
      id: editingIngredient.id,
      data: {
        ...data,
        unitPrice: parseFloat(data.unitPrice).toString(),
      },
    });
  };

  const handleEdit = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    editForm.reset({
      name: ingredient.name,
      category: ingredient.category,
      unitPrice: ingredient.unitPrice,
      packageSize: ingredient.packageSize,
      unit: ingredient.unit,
      supplier: ingredient.supplier,
      notes: ingredient.notes || '',
    });
  };

  const handleDelete = async (ingredient: Ingredient) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${ingredient.name}"?\n\nThis action cannot be undone.`
    );
    
    if (confirmed) {
      try {
        await deleteIngredientMutation.mutateAsync(ingredient.id);
      } catch (error: any) {
        console.error('Delete error:', error);
        const errorMessage = error?.message || 'An unknown error occurred';
        toast({ 
          title: "Failed to delete ingredient", 
          description: errorMessage,
          variant: "destructive" 
        });
      }
    }
  };

  const formatPrice = (price: string) => {
    return `฿${parseFloat(price).toFixed(2)}`;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Meat & Protein': 'bg-red-100 text-red-800',
      'Vegetables': 'bg-green-100 text-green-800',
      'Dairy & Eggs': 'bg-blue-100 text-blue-800',
      'Condiments & Sauces': 'bg-yellow-100 text-yellow-800',
      'Spices & Seasonings': 'bg-purple-100 text-purple-800',
      'Bread & Bakery': 'bg-orange-100 text-orange-800',
      'Packaging': 'bg-gray-100 text-gray-800',
      'Beverages': 'bg-cyan-100 text-cyan-800',
      'Oils & Fats': 'bg-amber-100 text-amber-800',
      'Other': 'bg-slate-100 text-slate-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Ingredient Management</h1>
          <p className="text-gray-600 mt-2">Manage your restaurant's ingredient inventory and pricing</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Ingredient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Ingredient</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateIngredient)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Beef Patty" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INGREDIENT_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={createForm.control}
                    name="unitPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price (฿)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="0.00" type="number" step="0.01" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="packageSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Package Size</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 1000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COMMON_UNITS.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createForm.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Metro Cash & Carry" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Additional notes about this ingredient" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createIngredientMutation.isPending}>
                    {createIngredientMutation.isPending ? 'Creating...' : 'Create Ingredient'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search ingredients by name or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {INGREDIENT_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ingredients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIngredients.map((ingredient: Ingredient) => (
          <Card key={ingredient.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{ingredient.name}</CardTitle>
                  <Badge className={`mt-2 ${getCategoryColor(ingredient.category)}`}>
                    {ingredient.category}
                  </Badge>
                </div>
                <div className="flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(ingredient)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(ingredient)}
                    disabled={deleteIngredientMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-600">Unit Price:</span>
                  </div>
                  <span className="font-semibold text-green-600">
                    {formatPrice(ingredient.unitPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-gray-600">Package:</span>
                  </div>
                  <span className="font-medium">
                    {ingredient.packageSize} {ingredient.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-gray-600">Supplier:</span>
                  </div>
                  <span className="font-medium text-sm">{ingredient.supplier}</span>
                </div>
                {ingredient.notes && (
                  <div className="flex items-start space-x-2">
                    <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                    <span className="text-sm text-gray-600">{ingredient.notes}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredIngredients.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No ingredients found</h3>
          <p className="text-gray-500 mt-2">
            {searchTerm || selectedCategory ? 'Try adjusting your search or filter.' : 'Get started by adding your first ingredient.'}
          </p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingIngredient} onOpenChange={(open) => !open && setEditingIngredient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Ingredient</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onUpdateIngredient)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Beef Patty" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INGREDIENT_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={editForm.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Price (฿)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0.00" type="number" step="0.01" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="packageSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Size</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 1000" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMMON_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Metro Cash & Carry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes about this ingredient" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setEditingIngredient(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateIngredientMutation.isPending}>
                  {updateIngredientMutation.isPending ? 'Updating...' : 'Update Ingredient'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Save, Edit, X, Upload, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { fetchWithLegacyFallback } from '@/lib/api';
import { LegacyDataAlert } from '@/components/ui/legacy-data-alert';
import type { Ingredient } from '@shared/schema';

interface EditableIngredient extends Ingredient {
  isEditing?: boolean;
  editValues?: Partial<Ingredient>;
  hasChanges?: boolean;
}

export default function IngredientsTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stockItems, setStockItems] = useState<EditableIngredient[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Queries with legacy fallback
  const { data: ingredientsResult, isLoading } = useQuery({
    queryKey: ['/api/ingredients', 'with-legacy'],
    queryFn: () => fetchWithLegacyFallback('/api/ingredients', '/api/legacy-bridge/ingredients'),
  });
  const fetchedIngredients = (ingredientsResult?.rows || []) as Ingredient[];
  const dataSource = ingredientsResult?.source || 'v2';

  // Update ingredients state when query data changes
  React.useEffect(() => {
    if (fetchedIngredients.length > 0) {
      setStockItems(fetchedIngredients.map((ingredient: Ingredient) => ({ 
        ...ingredient, 
        isEditing: false,
        editValues: {},
        hasChanges: false
      })));
    }
  }, [fetchedIngredients]);

  // Function to update field for specific item (live in-memory editing)
  const handleUpdate = (itemName: string, field: string, value: string) => {
    setStockItems((prevItems) =>
      prevItems.map((item) =>
        item.name === itemName
          ? { 
              ...item, 
              [field]: value,
              hasChanges: true,
              editValues: { ...item.editValues, [field]: value }
            }
          : item
      )
    );
    setHasUnsavedChanges(true);
  };

  // Update mutation
  const updateIngredientMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Ingredient> }) => 
      apiRequest(`/api/ingredients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      toast({ title: "Ingredient updated successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update ingredient", description: error.message, variant: "destructive" });
    },
  });

  // CSV Sync mutation
  const syncCsvMutation = useMutation({
    mutationFn: () => apiRequest('/api/ingredients/sync-csv', { method: 'POST' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      toast({ 
        title: "CSV Sync Complete", 
        description: `Imported: ${result.imported}, Updated: ${result.updated}` 
      });
    },
    onError: (error: any) => {
      toast({ title: "CSV sync failed", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (id: number) => {
    setStockItems(prev => prev.map(ingredient => 
      ingredient.id === id 
        ? { 
            ...ingredient, 
            isEditing: true, 
            editValues: {
              name: ingredient.name,
              category: ingredient.category,
              supplier: ingredient.supplier || '',
              price: ingredient.price?.toString() || '',
              packageSize: ingredient.packageSize?.toString() || '',
              portionSize: ingredient.portionSize?.toString() || '',
              unit: ingredient.unit || ''
            }
          }
        : ingredient
    ));
  };

  const handleCancel = (id: number) => {
    setStockItems(prev => prev.map(ingredient => 
      ingredient.id === id 
        ? { ...ingredient, isEditing: false, editValues: {}, hasChanges: false }
        : ingredient
    ));
    
    // Check if any items still have changes
    const stillHasChanges = stockItems.some(item => item.id !== id && item.hasChanges);
    setHasUnsavedChanges(stillHasChanges);
  };

  const handleSave = (id: number) => {
    const ingredient = stockItems.find(i => i.id === id);
    if (!ingredient?.editValues) return;

    const updates = { ...ingredient.editValues };
    
    // Convert numeric fields
    if (updates.price !== undefined) {
      updates.price = typeof updates.price === 'string' ? parseFloat(updates.price) || 0 : updates.price;
    }
    if (updates.packageSize !== undefined) {
      updates.packageSize = typeof updates.packageSize === 'string' ? parseFloat(updates.packageSize) || 0 : updates.packageSize;
    }
    if (updates.portionSize !== undefined) {
      updates.portionSize = typeof updates.portionSize === 'string' ? parseFloat(updates.portionSize) || 0 : updates.portionSize;
    }

    updateIngredientMutation.mutate({ id, updates });
    
    // Reset editing state and changes flag
    setStockItems(prev => prev.map(i => 
      i.id === id ? { ...i, isEditing: false, editValues: {}, hasChanges: false } : i
    ));
    
    // Check if any other items still have changes
    const stillHasChanges = stockItems.some(item => item.id !== id && item.hasChanges);
    setHasUnsavedChanges(stillHasChanges);
  };

  const handleFieldChange = (id: number, field: string, value: string) => {
    const ingredient = stockItems.find(i => i.id === id);
    if (ingredient) {
      handleUpdate(ingredient.name, field, value);
    }
  };

  // Save all changes at once
  const handleSaveAllChanges = () => {
    const itemsWithChanges = stockItems.filter(item => item.hasChanges);
    
    itemsWithChanges.forEach(ingredient => {
      if (ingredient.editValues && Object.keys(ingredient.editValues).length > 0) {
        const updates = { ...ingredient.editValues };
        
        // Convert numeric fields
        if (updates.price !== undefined) {
          updates.price = typeof updates.price === 'string' ? parseFloat(updates.price) || 0 : updates.price;
        }
        if (updates.packageSize !== undefined) {
          updates.packageSize = typeof updates.packageSize === 'string' ? parseFloat(updates.packageSize) || 0 : updates.packageSize;
        }
        if (updates.portionSize !== undefined) {
          updates.portionSize = typeof updates.portionSize === 'string' ? parseFloat(updates.portionSize) || 0 : updates.portionSize;
        }

        updateIngredientMutation.mutate({ id: ingredient.id, updates });
      }
    });

    // Clear all changes
    setStockItems(prev => prev.map(item => ({ 
      ...item, 
      hasChanges: false, 
      editValues: {},
      isEditing: false 
    })));
    setHasUnsavedChanges(false);
    
    toast({ 
      title: "Changes Saved", 
      description: `Updated ${itemsWithChanges.length} ingredients` 
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Fresh Food': 'bg-green-100 text-green-800',
      'Frozen Food': 'bg-blue-100 text-blue-800',
      'Meat': 'bg-red-100 text-red-800',
      'Vegetables': 'bg-emerald-100 text-emerald-800',
      'Beverages': 'bg-cyan-100 text-cyan-800',
      'Drinks': 'bg-purple-100 text-purple-800',
      'Condiments': 'bg-yellow-100 text-yellow-800',
      'Packaging': 'bg-gray-100 text-gray-800',
      'Supplies': 'bg-orange-100 text-orange-800',
      'Kitchen Supplies': 'bg-amber-100 text-amber-800',
      'Shelf Stock': 'bg-slate-100 text-slate-800',
      'Ingredients': 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading ingredients...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Ingredient Management</h1>
          <p className="text-gray-600 mt-2">Real-time editable ingredient database - click to edit</p>
          {hasUnsavedChanges && (
            <p className="text-orange-600 text-sm mt-1 font-medium">
              You have unsaved changes
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Button 
              onClick={handleSaveAllChanges}
              disabled={updateIngredientMutation.isPending}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4" />
              Save All Changes
            </Button>
          )}
          <Button 
            onClick={() => syncCsvMutation.mutate()}
            disabled={syncCsvMutation.isPending}
            className="flex items-center gap-2"
          >
            {syncCsvMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Sync from CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Ingredients Database</span>
            <Badge variant="outline">{stockItems.length} items</Badge>
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                {stockItems.filter(item => item.hasChanges).length} changed
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Price (฿)</TableHead>
                  <TableHead>Package Size</TableHead>
                  <TableHead>Portion Size</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockItems.map((ingredient) => (
                  <TableRow 
                    key={ingredient.id} 
                    className={`${ingredient.isEditing ? 'bg-blue-50' : ''} ${ingredient.hasChanges ? 'bg-yellow-50 border-l-4 border-l-orange-400' : ''}`}
                  >
                    <TableCell>
                      {ingredient.isEditing ? (
                        <Input
                          value={ingredient.editValues?.name || ''}
                          onChange={(e) => handleFieldChange(ingredient.id, 'name', e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        <span className="font-medium">{ingredient.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ingredient.isEditing ? (
                        <Input
                          value={ingredient.editValues?.category || ''}
                          onChange={(e) => handleFieldChange(ingredient.id, 'category', e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        <Badge className={getCategoryColor(ingredient.category)}>
                          {ingredient.category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {ingredient.isEditing ? (
                        <Input
                          value={ingredient.editValues?.supplier || ''}
                          onChange={(e) => handleFieldChange(ingredient.id, 'supplier', e.target.value)}
                          className="h-8"
                        />
                      ) : (
                        <span>{ingredient.supplier || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ingredient.isEditing ? (
                        <Input
                          type="number"
                          value={ingredient.editValues?.price || ''}
                          onChange={(e) => handleFieldChange(ingredient.id, 'price', e.target.value)}
                          className="h-8 w-20"
                          placeholder="0.00"
                          step="0.01"
                        />
                      ) : (
                        <span>฿{(typeof ingredient.price === 'number' ? ingredient.price : parseFloat(ingredient.price || '0') || 0).toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ingredient.isEditing ? (
                        <Input
                          type="number"
                          value={ingredient.editValues?.packageSize || ''}
                          onChange={(e) => handleFieldChange(ingredient.id, 'packageSize', e.target.value)}
                          className="h-8 w-20"
                          placeholder="0"
                          step="0.1"
                        />
                      ) : (
                        <span>{ingredient.packageSize || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ingredient.isEditing ? (
                        <Input
                          type="number"
                          value={ingredient.editValues?.portionSize || ''}
                          onChange={(e) => handleFieldChange(ingredient.id, 'portionSize', e.target.value)}
                          className="h-8 w-20"
                          placeholder="0"
                          step="0.1"
                        />
                      ) : (
                        <span>{ingredient.portionSize || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ingredient.isEditing ? (
                        <Input
                          value={ingredient.editValues?.unit || ''}
                          onChange={(e) => handleFieldChange(ingredient.id, 'unit', e.target.value)}
                          className="h-8 w-16"
                        />
                      ) : (
                        <span>{ingredient.unit || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {ingredient.isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSave(ingredient.id)}
                              disabled={updateIngredientMutation.isPending}
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(ingredient.id)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(ingredient.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
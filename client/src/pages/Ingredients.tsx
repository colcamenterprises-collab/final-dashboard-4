import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Save, X } from "lucide-react";

interface Ingredient {
  id: number;
  name: string;
  category: string;
  supplier: string;
  unitPrice: number;
  price?: number; // Package price
  packageSize: number; // Changed to number
  portionSize?: number; // Average per use
  costPerPortion?: number; // Auto-calculated cost per portion
  unit: string;
  notes?: string;
  updatedAt: string;
  createdAt: string;
}

const Ingredients = () => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ingredients
  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['/api/ingredients'],
    queryFn: () => apiRequest('/api/ingredients'),
  });

  // Get unique categories for filter
  const categories = ['all', ...new Set(ingredients.map((item: Ingredient) => item.category))];

  // Filter ingredients by category
  const filteredIngredients = categoryFilter === 'all' 
    ? ingredients 
    : ingredients.filter((item: Ingredient) => item.category === categoryFilter);

  // Add ingredient mutation
  const addMutation = useMutation({
    mutationFn: (data: Partial<Ingredient>) => apiRequest('/api/ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      toast({ title: "Ingredient added successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to add ingredient", 
        variant: "destructive" 
      });
    },
  });

  // Update ingredient mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: Partial<Ingredient> }) => 
      apiRequest(`/api/ingredients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      setEditingId(null);
      toast({ title: "Ingredient updated successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to update ingredient", 
        variant: "destructive" 
      });
    },
  });

  const handleAddIngredient = () => {
    addMutation.mutate({
      name: 'New Ingredient',
      category: 'Fresh Food',
      supplier: 'Supplier Name',
      unitPrice: 0,
      price: 0,
      packageSize: '300g',
      portionSize: 30,
      unit: 'g',
      notes: '',
    });
  };

  const handleUpdate = (id: number, data: Partial<Ingredient>) => {
    updateMutation.mutate({ id, data });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading ingredients...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Ingredients Management</h2>
          <Button onClick={handleAddIngredient} disabled={addMutation.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            Add Ingredient
          </Button>
        </CardHeader>
        <CardContent>
          {/* Category Filter */}
          <div className="mb-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ingredients Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Package Price</TableHead>
                  <TableHead>Package Size</TableHead>
                  <TableHead>Portion Size</TableHead>
                  <TableHead>Cost/Portion</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIngredients.map((ingredient: Ingredient) => (
                  <TableRow key={ingredient.id}>
                    {editingId === ingredient.id ? (
                      <EditForm 
                        ingredient={ingredient} 
                        onSave={handleUpdate} 
                        onCancel={() => setEditingId(null)}
                        isUpdating={updateMutation.isPending}
                      />
                    ) : (
                      <>
                        <TableCell className="font-medium">{ingredient.name}</TableCell>
                        <TableCell>{ingredient.category}</TableCell>
                        <TableCell>
                          ฿{ingredient.price || ingredient.unitPrice} / {ingredient.packageSize}{ingredient.unit}
                        </TableCell>
                        <TableCell>{ingredient.packageSize}{ingredient.unit}</TableCell>
                        <TableCell>
                          {ingredient.portionSize ? `${ingredient.portionSize}${ingredient.unit}` : '-'}
                        </TableCell>
                        <TableCell>
                          {ingredient.costPerPortion ? `฿${parseFloat(ingredient.costPerPortion.toString()).toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>{ingredient.supplier}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(ingredient.updatedAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setEditingId(ingredient.id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredIngredients.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No ingredients found for the selected category.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface EditFormProps {
  ingredient: Ingredient;
  onSave: (id: number, data: Partial<Ingredient>) => void;
  onCancel: () => void;
  isUpdating: boolean;
}

const EditForm = ({ ingredient, onSave, onCancel, isUpdating }: EditFormProps) => {
  const [data, setData] = useState<Partial<Ingredient>>({
    name: ingredient.name,
    category: ingredient.category,
    supplier: ingredient.supplier,
    price: ingredient.price || ingredient.unitPrice,
    packageSize: ingredient.packageSize || 0,
    portionSize: ingredient.portionSize || 0,
    unit: ingredient.unit,
    notes: ingredient.notes || '',
  });

  // Calculate cost per portion in real-time
  const calculateCostPerPortion = () => {
    const price = parseFloat(data.price?.toString() || '0');
    const packageSize = parseFloat(data.packageSize?.toString() || '1');
    const portionSize = parseFloat(data.portionSize?.toString() || '1');
    return price / (packageSize / portionSize) || 0;
  };

  const handleChange = (field: keyof Ingredient, value: string | number) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(ingredient.id, data);
  };

  return (
    <>
      <TableCell>
        <Input 
          value={data.name || ''} 
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full"
        />
      </TableCell>
      <TableCell>
        <Select 
          value={data.category || ''} 
          onValueChange={(value) => handleChange('category', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Fresh Food">Fresh Food</SelectItem>
            <SelectItem value="Frozen Food">Frozen Food</SelectItem>
            <SelectItem value="Shelf Stock">Shelf Stock</SelectItem>
            <SelectItem value="Drinks">Drinks</SelectItem>
            <SelectItem value="Kitchen Supplies">Kitchen Supplies</SelectItem>
            <SelectItem value="Packaging">Packaging</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input 
          type="number" 
          step="0.01"
          value={data.price || 0} 
          onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="number"
          step="0.01"
          value={data.packageSize || 0} 
          onChange={(e) => handleChange('packageSize', parseFloat(e.target.value) || 0)}
          placeholder="300"
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input 
            type="number" 
            step="0.01"
            value={data.portionSize || 0} 
            onChange={(e) => handleChange('portionSize', parseFloat(e.target.value) || 0)}
            className="w-16"
            placeholder="30"
          />
          <Input 
            value={data.unit || ''} 
            onChange={(e) => handleChange('unit', e.target.value)}
            className="w-12"
            placeholder="g"
          />
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm font-medium">
          ฿{calculateCostPerPortion().toFixed(2)}
        </span>
      </TableCell>
      <TableCell>
        <Input 
          value={data.supplier || ''} 
          onChange={(e) => handleChange('supplier', e.target.value)}
          className="w-full"
        />
      </TableCell>
      <TableCell>
        <span className="text-sm text-gray-500">Updating...</span>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={isUpdating}
          >
            <Save className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onCancel}
            disabled={isUpdating}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </>
  );
};

export default Ingredients;
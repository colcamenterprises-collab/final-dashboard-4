import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Save, X, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface RecipeIngredient {
  ingredientId: number;
  quantity: number;
  unit: string; // kg, grams, mg, litres, ml, each, cups, tablespoons, etc
  costPerUnit: number;
  totalCost: number;
}

interface Recipe {
  id: number;
  name: string; // Recipe title
  description?: string;
  category: string; // Burgers, Side Orders, Sauce, Beverages, Other
  
  // Recipe yield information
  yieldQuantity: number; // How much this recipe makes
  yieldUnit: string; // kg, litres, pieces, portions, each, etc
  
  // Recipe ingredients with proper measurements
  ingredients: RecipeIngredient[];
  
  // Costing information
  totalIngredientCost: number;
  costPerUnit: number; // Cost per yield unit
  costPerServing?: number; // If different from unit
  
  // Optional fields
  preparationTime?: number; // in minutes
  servingSize?: string; // Description of serving size
  profitMargin?: number; // percentage
  sellingPrice?: number;
  
  // Recipe management
  isActive: boolean;
  notes?: string; // Special instructions
  createdAt: string;
  updatedAt: string;
}

const UNIT_OPTIONS = [
  'kg', 'grams', 'mg', 'litres', 'ml', 'each', 'pieces', 'portions',
  'cups', '1/2 cup', '1/4 cup', 'tablespoons', 'teaspoons'
];

interface Ingredient {
  id: number;
  name: string;
  category: string;
  packageSize: string;
  costPerUnit: string;
  unit: string;
}

const Recipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newRecipe, setNewRecipe] = useState<Partial<Recipe>>({
    name: '',
    description: '',
    category: 'Burgers',
    yieldQuantity: 1,
    yieldUnit: 'portions',
    ingredients: [],
    preparationTime: 0,
    servingSize: '',
    notes: '',
    isActive: true
  });
  const [editing, setEditing] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadRecipes();
    loadIngredients();
  }, []);

  const loadRecipes = async () => {
    try {
      setIsLoading(true);
      const data = await fetch('/api/recipes').then(r => r.json());
      setRecipes(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load recipes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadIngredients = async () => {
    try {
      const data = await fetch('/api/ingredients').then(r => r.json());
      setIngredients(data);
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to load ingredients",
        variant: "destructive",
      });
    }
  };

  const addIngredient = () => {
    setNewRecipe({
      ...newRecipe,
      ingredients: [...(newRecipe.ingredients || []), { 
        ingredientId: 0, 
        quantity: 0, 
        unit: 'grams',
        costPerUnit: 0,
        totalCost: 0
      }]
    });
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    const updated = [...(newRecipe.ingredients || [])];
    if (field === 'unit') {
      updated[index][field] = value as string;
    } else {
      updated[index][field] = value as number;
    }
    
    // Auto-calculate total cost and cost per unit when ingredient or quantity changes
    if (field === 'ingredientId' || field === 'quantity') {
      const ingredient = ingredients.find(ing => ing.id === updated[index].ingredientId);
      if (ingredient && updated[index].quantity > 0) {
        const costPerKg = parseFloat(ingredient.costPerUnit || '0');
        let costPerUnit = 0;
        
        // Convert quantity to kg for cost calculation
        const quantity = updated[index].quantity;
        const unit = updated[index].unit;
        
        if (unit === 'kg') {
          costPerUnit = costPerKg * quantity;
        } else if (unit === 'grams') {
          costPerUnit = costPerKg * (quantity / 1000);
        } else if (unit === 'litres') {
          costPerUnit = costPerKg * quantity; // Assuming 1L = 1kg for liquids
        } else if (unit === 'ml') {
          costPerUnit = costPerKg * (quantity / 1000);
        } else {
          costPerUnit = costPerKg * quantity; // Default calculation
        }
        
        updated[index].costPerUnit = costPerKg;
        updated[index].totalCost = costPerUnit;
      }
    }
    
    setNewRecipe({ ...newRecipe, ingredients: updated });
  };

  const removeIngredient = (index: number) => {
    const updated = [...(newRecipe.ingredients || [])];
    updated.splice(index, 1);
    setNewRecipe({ ...newRecipe, ingredients: updated });
  };

  const calculateTotalCost = () => {
    if (!newRecipe.ingredients?.length) return 0;
    
    return (newRecipe.ingredients || []).reduce((total, ingredient) => {
      return total + (ingredient.totalCost || 0);
    }, 0);
  };

  const calculateCostPerUnit = () => {
    const totalCost = calculateTotalCost();
    const yieldQuantity = newRecipe.yieldQuantity || 1;
    return totalCost / yieldQuantity;
  };

  const handleSave = async () => {
    try {
      if (!newRecipe.name?.trim()) {
        toast({
          title: "Error",
          description: "Recipe name is required",
          variant: "destructive",
        });
        return;
      }

      if (!newRecipe.yieldQuantity || newRecipe.yieldQuantity <= 0) {
        toast({
          title: "Error",
          description: "Yield quantity must be greater than 0",
          variant: "destructive",
        });
        return;
      }

      const recipeData = {
        ...newRecipe,
        totalIngredientCost: calculateTotalCost().toString(),
        costPerUnit: calculateCostPerUnit().toString(),
      };

      const url = editing ? `/api/recipes/${editing}` : '/api/recipes';
      const method = editing ? 'PUT' : 'POST';
      
      await apiRequest(url, {
        method,
        body: JSON.stringify(recipeData),
        headers: {'Content-Type': 'application/json'}
      });

      toast({
        title: "Success",
        description: editing ? "Recipe updated successfully" : "Recipe created successfully",
      });

      resetForm();
      loadRecipes();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save recipe",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditing(null);
    setNewRecipe({
      name: '',
      description: '',
      category: 'Burgers',
      yieldQuantity: 1,
      yieldUnit: 'portions',
      ingredients: [],
      preparationTime: 0,
      servingSize: '',
      notes: '',
      isActive: true
    });
  };

  const handleEdit = (recipe: Recipe) => {
    setNewRecipe({
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
      yieldQuantity: recipe.yieldQuantity,
      yieldUnit: recipe.yieldUnit,
      ingredients: recipe.ingredients || [],
      preparationTime: recipe.preparationTime,
      servingSize: recipe.servingSize,
      notes: recipe.notes,
      isActive: recipe.isActive
    });
    setEditing(recipe.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this recipe?')) return;
    
    try {
      await apiRequest(`/api/recipes/${id}`, { method: 'DELETE' });
      toast({
        title: "Success",
        description: "Recipe deleted successfully",
      });
      loadRecipes();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete recipe",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading recipes...</div>
      </div>
    );
  }

  return (
    <div className="bg-app min-h-screen px-6 sm:px-8 py-5" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* READ-ONLY BANNER */}
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
        <strong>Read-only</strong> — Recipe editing is managed in{" "}
        <Link to="/recipe-management" className="text-emerald-600 underline">Recipe Management</Link>
      </div>
      
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-[32px] font-extrabold tracking-tight text-[var(--heading)]">Menu Management</h1>
      </div>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-[18px] font-semibold text-[var(--heading)]">Recipe Management</h2>
              <div className="text-xs sm:text-sm text-gray-600">
                Create industry-standard recipes with proper measurements and costing
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {/* Recipe Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg">
              <Input
                placeholder="Recipe title (e.g., Smash Burger, BBQ Sauce)"
                value={newRecipe.name || ''}
                onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                className="text-sm"
              />
              <Select
                value={newRecipe.category || ''}
                onValueChange={(value) => setNewRecipe({ ...newRecipe, category: value })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Burgers">Burgers</SelectItem>
                  <SelectItem value="Side Orders">Side Orders</SelectItem>
                  <SelectItem value="Sauce">Sauce</SelectItem>
                  <SelectItem value="Beverages">Beverages</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              

              
              <Input
                type="number"
                placeholder="Preparation time (minutes)"
                value={newRecipe.preparationTime || ''}
                onChange={(e) => setNewRecipe({ ...newRecipe, preparationTime: parseInt(e.target.value) || 0 })}
              />
              <Input
                placeholder="Serving size description"
                value={newRecipe.servingSize || ''}
                onChange={(e) => setNewRecipe({ ...newRecipe, servingSize: e.target.value })}
              />
              
              <div className="md:col-span-2">
                <Input
                  placeholder="Description (optional)"
                  value={newRecipe.description || ''}
                  onChange={(e) => setNewRecipe({ ...newRecipe, description: e.target.value })}
                />
              </div>
              
              <div className="md:col-span-2">
                <Input
                  placeholder="Special instructions or notes"
                  value={newRecipe.notes || ''}
                  onChange={(e) => setNewRecipe({ ...newRecipe, notes: e.target.value })}
                />
              </div>
            </div>

            {/* Ingredients Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Ingredients</h3>
                <div className="text-sm text-gray-600">
                  Total Cost: ฿{calculateTotalCost().toFixed(2)}
                </div>
              </div>
              
              {(newRecipe.ingredients || []).map((ingredient, index) => (
                <div key={index} className="grid grid-cols-5 gap-2 p-2 border rounded">
                  <Select
                    value={ingredient.ingredientId?.toString() || ''}
                    onValueChange={(value) => updateIngredient(index, 'ingredientId', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ingredient" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients.map(ing => (
                        <SelectItem key={ing.id} value={ing.id.toString()}>
                          {ing.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="Quantity"
                    value={ingredient.quantity || ''}
                    onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                  <Select
                    value={ingredient.unit}
                    onValueChange={(value) => updateIngredient(index, 'unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map(unit => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Cost per unit (฿)"
                    value={ingredient.costPerUnit || ''}
                    onChange={(e) => updateIngredient(index, 'costPerUnit', parseFloat(e.target.value) || 0)}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">฿{ingredient.totalCost.toFixed(2)}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeIngredient(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <Button 
                onClick={addIngredient}
                variant="outline" 
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Ingredient
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="bg-black text-white hover:bg-gray-800">
                <Save className="h-4 w-4 mr-2" />
                {editing ? 'Update Recipe' : 'Save Recipe'}
              </Button>
              {editing && (
                <Button onClick={resetForm} variant="outline">
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recipes List */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Existing Recipes</h3>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Cost per Unit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipes.map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="font-medium">{recipe.name}</TableCell>
                      <TableCell>{recipe.category}</TableCell>
                      <TableCell>฿{parseFloat(recipe.totalIngredientCost || '0').toFixed(2)}</TableCell>
                      <TableCell>฿{parseFloat(recipe.costPerUnit || '0').toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(recipe)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(recipe.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  );
};

export default Recipes;
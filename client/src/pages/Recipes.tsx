import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Save, X, Download, ChefHat, Package2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import jsPDF from 'jspdf';

interface Ingredient {
  id: number;
  name: string;
  costPerPortion: number;
  unit: string;
}

interface RecipeIngredient {
  ingredientId: number;
  portion: number;
}

interface Recipe {
  id: number;
  name: string;
  description?: string;
  category: string;
  servingSize: number;
  preparationTime?: number;
  ingredients: RecipeIngredient[];
  costPerServing: number;
  breakDown: { name: string; portion: number; cost: number }[];
  totalCost: number;
  profitMargin?: number;
  sellingPrice?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const Recipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [newRecipe, setNewRecipe] = useState<Partial<Recipe>>({
    name: '',
    description: '',
    category: 'Main Course',
    servingSize: 1,
    preparationTime: 0,
    ingredients: [],
    isActive: true
  });
  const [editing, setEditing] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [recipesData, ingredientsData] = await Promise.all([
        fetch('/api/recipes').then(r => r.json()),
        fetch('/api/ingredients').then(r => r.json())
      ]);
      setRecipes(recipesData);
      setIngredients(ingredientsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addIngredient = () => {
    setNewRecipe({
      ...newRecipe,
      ingredients: [...(newRecipe.ingredients || []), { ingredientId: 0, portion: 0 }]
    });
  };

  const updateIngredient = (index: number, key: 'ingredientId' | 'portion', value: number) => {
    const updated = [...(newRecipe.ingredients || [])];
    updated[index][key] = value;
    setNewRecipe({ ...newRecipe, ingredients: updated });
  };

  const removeIngredient = (index: number) => {
    const updated = [...(newRecipe.ingredients || [])];
    updated.splice(index, 1);
    setNewRecipe({ ...newRecipe, ingredients: updated });
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

      const url = editing ? `/api/recipes/${editing}` : '/api/recipes';
      const method = editing ? 'PUT' : 'POST';
      
      await apiRequest(url, {
        method,
        body: JSON.stringify(newRecipe),
        headers: {'Content-Type': 'application/json'}
      });

      toast({
        title: "Success",
        description: editing ? "Recipe updated successfully" : "Recipe created successfully",
      });

      setEditing(null);
      setNewRecipe({
        name: '',
        description: '',
        category: 'Main Course',
        servingSize: 1,
        preparationTime: 0,
        ingredients: [],
        isActive: true
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save recipe",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (recipe: Recipe) => {
    setNewRecipe({
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
      servingSize: recipe.servingSize,
      preparationTime: recipe.preparationTime,
      ingredients: recipe.ingredients || [],
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
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete recipe",
        variant: "destructive",
      });
    }
  };

  const downloadPDF = (recipe: Recipe) => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text(`Recipe: ${recipe.name}`, 10, 20);
    
    // Basic info
    doc.setFontSize(12);
    doc.text(`Category: ${recipe.category}`, 10, 35);
    doc.text(`Serving Size: ${recipe.servingSize}`, 10, 45);
    doc.text(`Preparation Time: ${recipe.preparationTime || 0} minutes`, 10, 55);
    doc.text(`Cost per Serving: ฿${parseFloat(recipe.costPerServing?.toString() || '0').toFixed(2)}`, 10, 65);
    
    // Description
    if (recipe.description) {
      doc.text('Description:', 10, 80);
      doc.text(recipe.description, 10, 90);
    }
    
    // Ingredients breakdown
    doc.text('Ingredient Breakdown:', 10, 105);
    let yPos = 115;
    
    (recipe.breakDown || []).forEach((ing, i) => {
      doc.text(`${ing.name}: ${ing.portion} units - ฿${ing.cost.toFixed(2)}`, 15, yPos);
      yPos += 10;
    });
    
    // Footer
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`, 10, yPos + 15);
    doc.text('Smash Brothers Burgers - Recipe Management System', 10, yPos + 25);
    
    doc.save(`${recipe.name.replace(/[^a-zA-Z0-9]/g, '_')}_Recipe.pdf`);
    
    toast({
      title: "Success",
      description: "Recipe PDF downloaded successfully",
    });
  };

  const calculateEstimatedCost = () => {
    let total = 0;
    (newRecipe.ingredients || []).forEach(recipeIng => {
      const ingredient = ingredients.find(ing => ing.id === recipeIng.ingredientId);
      if (ingredient && ingredient.costPerPortion) {
        total += recipeIng.portion * parseFloat(ingredient.costPerPortion.toString());
      }
    });
    return total;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading recipes...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Menu Management</h1>
        <p className="text-gray-600 text-sm sm:text-base">Manage recipes, ingredients, and menu items</p>
        
        {/* Navigation to Menu Management sections */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2 bg-gray-200 text-gray-800 border-gray-300 cursor-default">
            <ChefHat className="h-5 w-5" />
            <span className="text-sm font-medium">Recipes</span>
            <span className="text-xs text-gray-600">(Current)</span>
          </Button>
          <Link href="/ingredients">
            <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2 bg-blue-600 text-white hover:bg-blue-700 border-blue-600">
              <Package2 className="h-5 w-5" />
              <span className="text-sm font-medium">Ingredients</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Recipes Management</h2>
              <div className="text-sm text-gray-600">
                Create recipes with ingredient portions and auto-calculated costs
              </div>
            </div>
          </CardHeader>
        <CardContent className="space-y-4">
          {/* Recipe Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
            <Input
              placeholder="Recipe name (e.g., Smash Burger)"
              value={newRecipe.name || ''}
              onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
            />
            <Select
              value={newRecipe.category || ''}
              onValueChange={(value) => setNewRecipe({ ...newRecipe, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Main Course">Main Course</SelectItem>
                <SelectItem value="Sides">Sides</SelectItem>
                <SelectItem value="Beverages">Beverages</SelectItem>
                <SelectItem value="Desserts">Desserts</SelectItem>
              </SelectContent>
            </Select>
            
            <Input
              type="number"
              placeholder="Serving size"
              value={newRecipe.servingSize || 1}
              onChange={(e) => setNewRecipe({ ...newRecipe, servingSize: parseInt(e.target.value) || 1 })}
            />
            <Input
              type="number"
              placeholder="Preparation time (minutes)"
              value={newRecipe.preparationTime || 0}
              onChange={(e) => setNewRecipe({ ...newRecipe, preparationTime: parseInt(e.target.value) || 0 })}
            />
            
            <div className="md:col-span-2">
              <Input
                placeholder="Description (optional)"
                value={newRecipe.description || ''}
                onChange={(e) => setNewRecipe({ ...newRecipe, description: e.target.value })}
              />
            </div>
          </div>

          {/* Ingredients Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Ingredients</h3>
              <div className="text-sm text-gray-600">
                Estimated Cost: ฿{calculateEstimatedCost().toFixed(2)}
              </div>
            </div>
            
            {(newRecipe.ingredients || []).map((recipeIng, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border rounded">
                <Select
                  value={recipeIng.ingredientId?.toString() || ''}
                  onValueChange={(value) => updateIngredient(index, 'ingredientId', parseInt(value))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients.map(ing => (
                      <SelectItem key={ing.id} value={ing.id.toString()}>
                        {ing.name} (฿{parseFloat(ing.costPerPortion?.toString() || '0').toFixed(2)}/{ing.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Portion"
                  className="w-24"
                  value={recipeIng.portion || 0}
                  onChange={(e) => updateIngredient(index, 'portion', parseFloat(e.target.value) || 0)}
                />
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeIngredient(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Button variant="outline" onClick={addIngredient}>
              <Plus className="h-4 w-4 mr-2" />
              Add Ingredient
            </Button>
          </div>

          {/* Save Button */}
          <div className="flex gap-2">
            <Button onClick={handleSave} className="bg-black text-white">
              <Save className="h-4 w-4 mr-2" />
              {editing ? 'Update Recipe' : 'Save Recipe'}
            </Button>
            {editing && (
              <Button variant="outline" onClick={() => {
                setEditing(null);
                setNewRecipe({
                  name: '',
                  description: '',
                  category: 'Main Course',
                  servingSize: 1,
                  preparationTime: 0,
                  ingredients: [],
                  isActive: true
                });
              }}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recipes List */}
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold">Recipe Cards</h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Servings</TableHead>
                  <TableHead>Cost/Serving</TableHead>
                  <TableHead>Ingredients</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map(recipe => (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">{recipe.name}</TableCell>
                    <TableCell>{recipe.category}</TableCell>
                    <TableCell>{recipe.servingSize}</TableCell>
                    <TableCell>฿{parseFloat(recipe.costPerServing?.toString() || '0').toFixed(2)}</TableCell>
                    <TableCell>
                      {recipe.breakDown ? recipe.breakDown.length : 0} items
                    </TableCell>
                    <TableCell>
                      {new Date(recipe.updatedAt).toLocaleDateString('en-GB')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(recipe)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPDF(recipe)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(recipe.id)}
                        >
                          <X className="h-4 w-4" />
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
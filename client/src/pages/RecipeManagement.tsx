import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRecipeSchema, insertRecipeIngredientSchema, type Recipe, type Ingredient, type RecipeIngredient } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChefHat, Calculator, Trash2, Edit3, Save, X } from "lucide-react";
import { z } from "zod";

const recipeFormSchema = insertRecipeSchema.extend({
  category: z.string().min(1, "Category is required"),
  servingSize: z.number().min(1, "Serving size must be at least 1"),
});

const recipeIngredientFormSchema = insertRecipeIngredientSchema.extend({
  quantity: z.string().min(1, "Quantity is required"),
});

export default function RecipeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddIngredientDialogOpen, setIsAddIngredientDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<RecipeIngredient | null>(null);

  // Queries
  const { data: recipes = [], isLoading: recipesLoading } = useQuery({
    queryKey: ['/api/recipes'],
  });

  const { data: ingredients = [], isLoading: ingredientsLoading } = useQuery({
    queryKey: ['/api/ingredients'],
  });

  const { data: recipeIngredients = [], refetch: refetchRecipeIngredients } = useQuery({
    queryKey: ['/api/recipes', selectedRecipe?.id, 'ingredients'],
    enabled: !!selectedRecipe?.id,
  });

  // Forms
  const recipeForm = useForm({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      name: "",
      category: "",
      description: "",
      servingSize: 1,
      preparationTime: 30,
      totalCost: "0.00",
      profitMargin: "40",
      sellingPrice: "",
      isActive: true,
    },
  });

  const ingredientForm = useForm({
    resolver: zodResolver(recipeIngredientFormSchema),
    defaultValues: {
      recipeId: 0,
      ingredientId: 0,
      quantity: "",
      unit: "",
    },
  });

  // Mutations
  const createRecipeMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/recipes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      setIsCreateDialogOpen(false);
      recipeForm.reset();
      toast({ title: "Recipe created successfully" });
    },
  });

  const addIngredientMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/recipe-ingredients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes', selectedRecipe?.id, 'ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      setIsAddIngredientDialogOpen(false);
      ingredientForm.reset();
      toast({ title: "Ingredient added successfully" });
    },
  });

  const updateIngredientMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest('PUT', `/api/recipe-ingredients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes', selectedRecipe?.id, 'ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      setEditingIngredient(null);
      toast({ title: "Ingredient updated successfully" });
    },
  });

  const removeIngredientMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/recipe-ingredients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes', selectedRecipe?.id, 'ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      toast({ title: "Ingredient removed successfully" });
    },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      setSelectedRecipe(null);
      toast({ title: "Recipe deleted successfully" });
    },
  });

  const onCreateRecipe = (data: any) => {
    createRecipeMutation.mutate(data);
  };

  const onAddIngredient = (data: any) => {
    if (!selectedRecipe) return;
    
    const selectedIngredient = (ingredients as Ingredient[]).find((ing: Ingredient) => ing.id === parseInt(data.ingredientId));
    if (!selectedIngredient) return;

    addIngredientMutation.mutate({
      ...data,
      recipeId: selectedRecipe.id,
      ingredientId: parseInt(data.ingredientId),
      unit: selectedIngredient.unit,
    });
  };

  const onUpdateIngredient = (data: any) => {
    if (!editingIngredient) return;
    updateIngredientMutation.mutate({
      id: editingIngredient.id,
      data: { ...data, quantity: data.quantity }
    });
  };

  const calculateRecipeCost = () => {
    let totalCost = 0;
    (recipeIngredients as RecipeIngredient[]).forEach((ri: RecipeIngredient) => {
      const ingredient = (ingredients as Ingredient[]).find((ing: Ingredient) => ing.id === ri.ingredientId);
      if (ingredient) {
        const unitPrice = parseFloat(ingredient.unitPrice);
        const packageSize = parseFloat(ingredient.packageSize);
        const quantity = parseFloat(ri.quantity);
        const costPerUnit = unitPrice / packageSize;
        totalCost += costPerUnit * quantity;
      }
    });
    return totalCost.toFixed(2);
  };

  const getIngredientName = (ingredientId: number) => {
    const ingredient = (ingredients as Ingredient[]).find((ing: Ingredient) => ing.id === ingredientId);
    return ingredient?.name || "Unknown";
  };

  const getIngredientCost = (ingredientId: number, quantity: string) => {
    const ingredient = (ingredients as Ingredient[]).find((ing: Ingredient) => ing.id === ingredientId);
    if (!ingredient) return "0.00";
    
    const unitPrice = parseFloat(ingredient.unitPrice);
    const packageSize = parseFloat(ingredient.packageSize);
    const qty = parseFloat(quantity);
    const costPerUnit = unitPrice / packageSize;
    return (costPerUnit * qty).toFixed(2);
  };

  if (recipesLoading || ingredientsLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center space-x-2 mb-6">
          <ChefHat className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Recipe Management</h1>
        </div>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded-lg"></div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ChefHat className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Recipe Management</h1>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Recipe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Recipe</DialogTitle>
              <DialogDescription>
                Add a new recipe to your collection
              </DialogDescription>
            </DialogHeader>
            <Form {...recipeForm}>
              <form onSubmit={recipeForm.handleSubmit(onCreateRecipe)} className="space-y-4">
                <FormField
                  control={recipeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipe Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Single Smash Burger" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={recipeForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Burgers">Burgers</SelectItem>
                          <SelectItem value="Sides">Sides</SelectItem>
                          <SelectItem value="Drinks">Drinks</SelectItem>
                          <SelectItem value="Desserts">Desserts</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={recipeForm.control}
                    name="servingSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serving Size</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={recipeForm.control}
                    name="preparationTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prep Time (min)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={recipeForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Recipe description..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRecipeMutation.isPending}>
                    {createRecipeMutation.isPending ? "Creating..." : "Create Recipe"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recipes List */}
        <Card>
          <CardHeader>
            <CardTitle>Recipes ({(recipes as Recipe[]).length})</CardTitle>
            <CardDescription>
              Manage your restaurant's recipes and their costs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(recipes as Recipe[]).map((recipe: Recipe) => (
                <div
                  key={recipe.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRecipe?.id === recipe.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{recipe.name}</h3>
                      <p className="text-sm text-gray-600">{recipe.category}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-500">
                          Cost: ฿{recipe.totalCost}
                        </span>
                        <span className="text-sm text-gray-500">
                          Serves: {recipe.servingSize}
                        </span>
                      </div>
                    </div>
                    <Badge variant={recipe.isActive ? "default" : "secondary"}>
                      {recipe.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {(recipes as Recipe[]).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recipes yet. Create your first recipe!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recipe Details */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  {selectedRecipe ? selectedRecipe.name : "Select a Recipe"}
                </CardTitle>
                <CardDescription>
                  {selectedRecipe ? "Recipe details and cost breakdown" : "Choose a recipe to view details"}
                </CardDescription>
              </div>
              {selectedRecipe && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteRecipeMutation.mutate(selectedRecipe.id)}
                    disabled={deleteRecipeMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedRecipe ? (
              <div className="space-y-6">
                {/* Recipe Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Category</Label>
                    <p>{selectedRecipe.category}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Serving Size</Label>
                    <p>{selectedRecipe.servingSize}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Prep Time</Label>
                    <p>{selectedRecipe.preparationTime} minutes</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Total Cost</Label>
                    <p className="font-semibold text-green-600">฿{calculateRecipeCost()}</p>
                  </div>
                </div>

                {selectedRecipe.description && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Description</Label>
                    <p className="text-sm">{selectedRecipe.description}</p>
                  </div>
                )}

                <Separator />

                {/* Ingredients Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Ingredients ({(recipeIngredients as RecipeIngredient[]).length})</h3>
                    <Dialog open={isAddIngredientDialogOpen} onOpenChange={setIsAddIngredientDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add Ingredient</DialogTitle>
                          <DialogDescription>
                            Add an ingredient to {selectedRecipe.name}
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...ingredientForm}>
                          <form onSubmit={ingredientForm.handleSubmit(onAddIngredient)} className="space-y-4">
                            <FormField
                              control={ingredientForm.control}
                              name="ingredientId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Ingredient</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select ingredient" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {(ingredients as Ingredient[]).map((ingredient: Ingredient) => (
                                        <SelectItem key={ingredient.id} value={ingredient.id.toString()}>
                                          {ingredient.name} (฿{ingredient.unitPrice}/{ingredient.unit})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={ingredientForm.control}
                              name="quantity"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Quantity</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g. 1, 0.5, 2" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex justify-end space-x-2">
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setIsAddIngredientDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button type="submit" disabled={addIngredientMutation.isPending}>
                                {addIngredientMutation.isPending ? "Adding..." : "Add Ingredient"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2">
                    {(recipeIngredients as RecipeIngredient[]).map((ri: RecipeIngredient) => (
                      <div key={ri.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <span className="font-medium">{getIngredientName(ri.ingredientId)}</span>
                          <span className="text-sm text-gray-600 ml-2">
                            {ri.quantity} {ri.unit}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-green-600">
                            ฿{getIngredientCost(ri.ingredientId, ri.quantity)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingIngredient(ri)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIngredientMutation.mutate(ri.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {(recipeIngredients as RecipeIngredient[]).length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No ingredients added yet</p>
                      </div>
                    )}
                  </div>

                  {(recipeIngredients as RecipeIngredient[]).length > 0 && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total Recipe Cost:</span>
                        <span className="text-lg font-bold text-green-600">
                          ฿{calculateRecipeCost()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Cost per serving: ฿{(parseFloat(calculateRecipeCost()) / selectedRecipe.servingSize).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select a recipe to view its details and ingredients</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Ingredient Dialog */}
      {editingIngredient && (
        <Dialog open={!!editingIngredient} onOpenChange={() => setEditingIngredient(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Ingredient Quantity</DialogTitle>
              <DialogDescription>
                Update the quantity for {getIngredientName(editingIngredient.ingredientId)}
              </DialogDescription>
            </DialogHeader>
            <Form {...ingredientForm}>
              <form onSubmit={ingredientForm.handleSubmit(onUpdateIngredient)} className="space-y-4">
                <FormField
                  control={ingredientForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. 1, 0.5, 2" 
                          {...field}
                          defaultValue={editingIngredient.quantity}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingIngredient(null)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateIngredientMutation.isPending}>
                    <Save className="h-4 w-4 mr-1" />
                    {updateIngredientMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
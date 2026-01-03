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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRecipeSchema, insertRecipeIngredientSchema, type Recipe, type Ingredient, type RecipeIngredient, type InsertIngredient } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChefHat, Calculator, Trash2, Edit3, Save, X, Sparkles, Copy, FileText, Share2, Megaphone, Edit2, Search, Package, DollarSign, Building2 } from "lucide-react";
import { z } from "zod";

const recipeFormSchema = insertRecipeSchema.extend({
  category: z.string().min(1, "Category is required"),
  servingSize: z.number().min(1, "Serving size must be at least 1"),
});

const recipeIngredientFormSchema = z.object({
  recipeId: z.number(),
  ingredientId: z.string().min(1, "Please select an ingredient"),
  quantity: z.string().min(1, "Quantity is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Quantity must be a positive number"),
  unit: z.string().optional(),
});

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
  'grams', 'kilograms', 'pieces', 'each', 'units', 'liters', 'milliliters',
  'bottles', 'cans', 'packets', 'bags', 'boxes', 'rolls', 'sheets', 'tablespoons',
  'teaspoons', 'cups', 'ounces', 'pounds', 'gallons', 'pints'
];

const RECIPE_CATEGORIES = [
  'Burgers', 'Chicken', 'Sides', 'Beverages', 'Sauces', 'Meal Sets', 'Specials'
];

export default function RecipeIngredientManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Recipe states
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isCreateRecipeDialogOpen, setIsCreateRecipeDialogOpen] = useState(false);
  const [isAddIngredientDialogOpen, setIsAddIngredientDialogOpen] = useState(false);
  const [editingRecipeIngredient, setEditingRecipeIngredient] = useState<RecipeIngredient | null>(null);
  const [isMarketingDialogOpen, setIsMarketingDialogOpen] = useState(false);
  const [marketingOutputType, setMarketingOutputType] = useState<'delivery' | 'advertising' | 'social'>('delivery');
  const [marketingNotes, setMarketingNotes] = useState('');
  const [generatedContent, setGeneratedContent] = useState<any>(null);

  // Ingredient states
  const [isCreateIngredientDialogOpen, setIsCreateIngredientDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Queries
  const { data: recipes = [], isLoading: recipesLoading } = useQuery({
    queryKey: ['/api/recipes'],
  });

  const { data: ingredients = [], isLoading: ingredientsLoading } = useQuery({
    queryKey: ['/api/ingredients'],
  });

  const { data: recipeIngredients = [], isLoading: recipeIngredientsLoading } = useQuery({
    queryKey: ['/api/recipe-ingredients', selectedRecipe?.id],
    enabled: !!selectedRecipe?.id,
  });

  // Recipe mutations
  const createRecipeMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/recipes`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      setIsCreateRecipeDialogOpen(false);
      toast({ title: "Success", description: "Recipe created successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create recipe", variant: "destructive" });
    }
  });

  const addRecipeIngredientMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/recipe-ingredients`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-ingredients', selectedRecipe?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      setIsAddIngredientDialogOpen(false);
      toast({ title: "Success", description: "Ingredient added to recipe!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add ingredient", variant: "destructive" });
    }
  });

  const updateRecipeIngredientMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => 
      apiRequest(`/api/recipe-ingredients/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-ingredients', selectedRecipe?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      setEditingRecipeIngredient(null);
      toast({ title: "Success", description: "Ingredient updated!" });
    },
  });

  const removeRecipeIngredientMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/recipe-ingredients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-ingredients', selectedRecipe?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/recipes'] });
      toast({ title: "Success", description: "Ingredient removed from recipe!" });
    },
  });

  const generateMarketingContentMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/recipes/${selectedRecipe?.id}/marketing-content`, { method: "POST", body: data }),
    onSuccess: (data) => {
      setGeneratedContent(data);
      toast({ title: "Success", description: "Marketing content generated!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to generate content", variant: "destructive" });
    }
  });

  // Ingredient mutations
  const createIngredientMutation = useMutation({
    mutationFn: (data: InsertIngredient) => apiRequest('/api/ingredients', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      setIsCreateIngredientDialogOpen(false);
      toast({ title: "Success", description: "Ingredient created successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create ingredient", variant: "destructive" });
    }
  });

  const updateIngredientMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: Partial<Ingredient> }) =>
      apiRequest(`/api/ingredients/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      setEditingIngredient(null);
      toast({ title: "Success", description: "Ingredient updated successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update ingredient", variant: "destructive" });
    }
  });

  const deleteIngredientMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/ingredients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      toast({ title: "Success", description: "Ingredient deleted successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete ingredient", variant: "destructive" });
    }
  });

  // Forms
  const recipeForm = useForm({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      name: "",
      description: "",
      instructions: "",
      prepTime: 0,
      cookTime: 0,
      servingSize: 1,
      category: "",
      totalCost: 0,
    },
  });

  const recipeIngredientForm = useForm({
    resolver: zodResolver(recipeIngredientFormSchema),
    defaultValues: {
      recipeId: selectedRecipe?.id || 0,
      ingredientId: "",
      quantity: "",
      unit: "",
    },
  });

  const ingredientForm = useForm({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: {
      name: "",
      category: "",
      unitPrice: "",
      packageSize: "",
      unit: "",
      supplier: "",
      notes: "",
    },
  });

  // Helper functions
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(isNaN(num) ? 0 : num);
  };

  const filteredIngredients = ingredients.filter(ingredient => {
    const matchesSearch = ingredient.name.toLowerCase().includes(ingredientSearch.toLowerCase()) ||
                         ingredient.supplier.toLowerCase().includes(ingredientSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ingredient.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedIngredients = INGREDIENT_CATEGORIES.reduce((acc, category) => {
    acc[category] = filteredIngredients.filter(ingredient => ingredient.category === category);
    return acc;
  }, {} as Record<string, Ingredient[]>);

  const onCreateRecipe = (data: any) => {
    createRecipeMutation.mutate(data);
  };

  const onAddRecipeIngredient = (data: any) => {
    const ingredientId = parseInt(data.ingredientId);
    const ingredient = ingredients.find(i => i.id === ingredientId);
    
    const ingredientData = {
      recipeId: selectedRecipe?.id,
      ingredientId,
      quantity: parseFloat(data.quantity),
      unit: data.unit || ingredient?.unit || 'units',
      cost: ingredient ? parseFloat(ingredient.unitPrice) * parseFloat(data.quantity) : 0,
    };
    
    addRecipeIngredientMutation.mutate(ingredientData);
  };

  const onCreateIngredient = (data: any) => {
    createIngredientMutation.mutate({
      ...data,
      unitPrice: parseFloat(data.unitPrice),
      packageSize: parseFloat(data.packageSize),
    });
  };

  const onUpdateIngredient = (data: any) => {
    if (!editingIngredient) return;
    updateIngredientMutation.mutate({
      id: editingIngredient.id,
      data: {
        ...data,
        unitPrice: parseFloat(data.unitPrice),
        packageSize: parseFloat(data.packageSize),
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Content copied to clipboard" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recipe & Ingredient Management</h1>
          <p className="text-gray-600">Manage your recipes and ingredients in one place</p>
        </div>
      </div>

      <Tabs defaultValue="recipes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recipes">
            Recipe Management
          </TabsTrigger>
          <TabsTrigger value="ingredients">
            Ingredient Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recipes" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Recipes</h2>
            <Dialog open={isCreateRecipeDialogOpen} onOpenChange={setIsCreateRecipeDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-black text-white hover:bg-gray-800">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Recipe
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Recipe</DialogTitle>
                  <DialogDescription>Add a new recipe to your menu</DialogDescription>
                </DialogHeader>
                <Form {...recipeForm}>
                  <form onSubmit={recipeForm.handleSubmit(onCreateRecipe)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={recipeForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recipe Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Ultimate Double Burger" {...field} />
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {RECIPE_CATEGORIES.map((category) => (
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
                    <FormField
                      control={recipeForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="A delicious double patty burger..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={recipeForm.control}
                      name="instructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cooking Instructions</FormLabel>
                          <FormControl>
                            <Textarea placeholder="1. Prepare the patties..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={recipeForm.control}
                        name="prepTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prep Time (minutes)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={recipeForm.control}
                        name="cookTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cook Time (minutes)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={recipeForm.control}
                        name="servingSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Serving Size</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsCreateRecipeDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createRecipeMutation.isPending} className="bg-black text-white hover:bg-gray-800">
                        {createRecipeMutation.isPending ? "Creating..." : "Create Recipe"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="h-5 w-5" />
                  Recipe List
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recipesLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : recipes.length === 0 ? (
                  <div className="text-center py-8">
                    <ChefHat className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No recipes yet. Create your first recipe!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recipes.map((recipe: Recipe) => (
                      <div
                        key={recipe.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedRecipe?.id === recipe.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedRecipe(recipe)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{recipe.name}</h3>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline">{recipe.category}</Badge>
                              <Badge variant="secondary">{formatCurrency(recipe.totalCost || 0)}</Badge>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {recipe.prepTime + recipe.cookTime} min
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Recipe Details
                  {selectedRecipe && (
                    <div className="ml-auto flex gap-2">
                      <Dialog open={isMarketingDialogOpen} onOpenChange={setIsMarketingDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Sparkles className="h-4 w-4 mr-1" />
                            Generate Marketing
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>AI Marketing Content Generator</DialogTitle>
                            <DialogDescription>
                              Generate marketing content for {selectedRecipe.name}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <Label>Content Type</Label>
                                <Select value={marketingOutputType} onValueChange={(value: 'delivery' | 'advertising' | 'social') => setMarketingOutputType(value)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="delivery">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Delivery Partner
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="advertising">
                                      <div className="flex items-center gap-2">
                                        <Megaphone className="h-4 w-4" />
                                        Advertising
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="social">
                                      <div className="flex items-center gap-2">
                                        <Share2 className="h-4 w-4" />
                                        Social Media
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2">
                                <Label>Additional Notes (Optional)</Label>
                                <Input 
                                  placeholder="e.g., Focus on spicy flavors, mention discount..."
                                  value={marketingNotes}
                                  onChange={(e) => setMarketingNotes(e.target.value)}
                                />
                              </div>
                            </div>
                            
                            <Button 
                              onClick={() => generateMarketingContentMutation.mutate({ 
                                outputType: marketingOutputType, 
                                notes: marketingNotes 
                              })}
                              disabled={generateMarketingContentMutation.isPending}
                              className="bg-black text-white hover:bg-gray-800"
                            >
                              {generateMarketingContentMutation.isPending ? "Generating..." : "Generate Content"}
                            </Button>

                            {generatedContent && (
                              <div className="space-y-4 mt-6">
                                <h4 className="font-semibold">Generated Content:</h4>
                                {generatedContent.variations?.map((variation: any, index: number) => (
                                  <Card key={index}>
                                    <CardHeader>
                                      <CardTitle className="text-sm flex justify-between items-center">
                                        Variation {index + 1}
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => copyToClipboard(JSON.stringify(variation, null, 2))}
                                        >
                                          <Copy className="h-4 w-4 mr-1" />
                                          Copy
                                        </Button>
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2">
                                        <div>
                                          <strong>Headline:</strong>
                                          <p className="text-sm mt-1">{variation.headline}</p>
                                        </div>
                                        <div>
                                          <strong>Description:</strong>
                                          <p className="text-sm mt-1">{variation.description}</p>
                                        </div>
                                        {variation.callToAction && (
                                          <div>
                                            <strong>Call to Action:</strong>
                                            <p className="text-sm mt-1">{variation.callToAction}</p>
                                          </div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedRecipe ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg">{selectedRecipe.name}</h3>
                      <p className="text-gray-600 text-sm">{selectedRecipe.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Category</Label>
                        <Badge variant="outline">{selectedRecipe.category}</Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Total Cost</Label>
                        <p className="font-semibold text-green-600">{formatCurrency(selectedRecipe.totalCost || 0)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Prep Time</Label>
                        <p>{selectedRecipe.prepTime} minutes</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Cook Time</Label>
                        <p>{selectedRecipe.cookTime} minutes</p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">Ingredients</h4>
                        <Dialog open={isAddIngredientDialogOpen} onOpenChange={setIsAddIngredientDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add Ingredient to Recipe</DialogTitle>
                            </DialogHeader>
                            <Form {...recipeIngredientForm}>
                              <form onSubmit={recipeIngredientForm.handleSubmit(onAddRecipeIngredient)} className="space-y-4">
                                <FormField
                                  control={recipeIngredientForm.control}
                                  name="ingredientId"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Ingredient</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select ingredient" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {ingredients.map((ingredient: Ingredient) => (
                                            <SelectItem key={ingredient.id} value={ingredient.id.toString()}>
                                              {ingredient.name} ({formatCurrency(ingredient.unitPrice)}/{ingredient.unit})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                  <FormField
                                    control={recipeIngredientForm.control}
                                    name="quantity"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Portion Size</FormLabel>
                                        <FormControl>
                                          <Input placeholder="e.g. 150" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={recipeIngredientForm.control}
                                    name="unit"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Unit (Optional)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Auto" />
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
                                <div className="flex justify-end gap-2">
                                  <Button type="button" variant="outline" onClick={() => setIsAddIngredientDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button type="submit" disabled={addRecipeIngredientMutation.isPending} className="bg-black text-white hover:bg-gray-800">
                                    {addRecipeIngredientMutation.isPending ? "Adding..." : "Add Ingredient"}
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                      
                      {recipeIngredientsLoading ? (
                        <div className="space-y-2">
                          {[...Array(2)].map((_, i) => (
                            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                          ))}
                        </div>
                      ) : recipeIngredients.length === 0 ? (
                        <p className="text-gray-500 text-sm">No ingredients added yet</p>
                      ) : (
                        <div className="space-y-2">
                          {recipeIngredients.map((ri: RecipeIngredient & { ingredient?: Ingredient }) => (
                            <div key={ri.id} className="flex justify-between items-center p-2 border rounded">
                              <div>
                                <span className="font-medium">{ri.ingredient?.name || 'Unknown'}</span>
                                <span className="text-gray-500 ml-2">
                                  {ri.quantity} {ri.unit} - {formatCurrency(ri.cost || 0)}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => setEditingRecipeIngredient(ri)}
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => removeRecipeIngredientMutation.mutate(ri.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedRecipe.instructions && (
                      <div>
                        <h4 className="font-medium mb-2">Instructions</h4>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedRecipe.instructions}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Select a recipe to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ingredients" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Ingredients</h2>
            <Dialog open={isCreateIngredientDialogOpen} onOpenChange={setIsCreateIngredientDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-black text-white hover:bg-gray-800">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ingredient
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingIngredient ? 'Update ingredient details' : 'Add a new ingredient to your inventory'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...ingredientForm}>
                  <form onSubmit={ingredientForm.handleSubmit(editingIngredient ? onUpdateIngredient : onCreateIngredient)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={ingredientForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ingredient Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Tomatoes" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ingredientForm.control}
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
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={ingredientForm.control}
                        name="unitPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Price (THB)</FormLabel>
                            <FormControl>
                              <Input placeholder="50.00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ingredientForm.control}
                        name="packageSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Package Size</FormLabel>
                            <FormControl>
                              <Input placeholder="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={ingredientForm.control}
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
                      control={ingredientForm.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier</FormLabel>
                          <FormControl>
                            <Input placeholder="Fresh Market" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={ingredientForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Additional notes about this ingredient..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => {
                        setIsCreateIngredientDialogOpen(false);
                        setEditingIngredient(null);
                        ingredientForm.reset();
                      }}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={editingIngredient ? updateIngredientMutation.isPending : createIngredientMutation.isPending}
                        className="bg-black text-white hover:bg-gray-800"
                      >
                        {editingIngredient 
                          ? (updateIngredientMutation.isPending ? "Updating..." : "Update Ingredient")
                          : (createIngredientMutation.isPending ? "Adding..." : "Add Ingredient")
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search ingredients..."
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
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

          {ingredientsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {INGREDIENT_CATEGORIES.map((category) => {
                const categoryIngredients = groupedIngredients[category];
                if (!categoryIngredients?.length) return null;

                return (
                  <div key={category}>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {category}
                      <Badge variant="secondary">{categoryIngredients.length}</Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryIngredients.map((ingredient) => (
                        <Card key={ingredient.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-base">{ingredient.name}</CardTitle>
                                <CardDescription className="text-sm">
                                  {ingredient.supplier}
                                </CardDescription>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingIngredient(ingredient);
                                    ingredientForm.reset({
                                      name: ingredient.name,
                                      category: ingredient.category,
                                      unitPrice: ingredient.unitPrice.toString(),
                                      packageSize: ingredient.packageSize.toString(),
                                      unit: ingredient.unit,
                                      supplier: ingredient.supplier,
                                      notes: ingredient.notes || '',
                                    });
                                    setIsCreateIngredientDialogOpen(true);
                                  }}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteIngredientMutation.mutate(ingredient.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Price</span>
                                <span className="font-semibold text-green-600">
                                  {formatCurrency(ingredient.unitPrice)}/{ingredient.unit}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Package Size</span>
                                <span className="text-sm">
                                  {ingredient.packageSize} {ingredient.unit}
                                </span>
                              </div>
                              {ingredient.notes && (
                                <div className="text-xs text-gray-500 mt-2">
                                  {ingredient.notes}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
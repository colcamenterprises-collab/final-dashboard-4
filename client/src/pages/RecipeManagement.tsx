import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChefHat, Calculator, Trash2, Edit3, Save, X, Sparkles, Copy, FileText, Share2, Megaphone, Package, Search, Users, Filter, AlertCircle } from "lucide-react";
import { IngredientForm } from "@/components/IngredientForm";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { INGREDIENT_CATEGORIES } from "@/constants/ingredientCategories";

const recipeFormSchema = z.object({
  name: z.string().min(1, "Recipe name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  yieldUnits: z.string().optional(),
});

type RecipeAuthority = {
  id: number;
  name: string;
  category?: string;
  description?: string;
  yieldUnits?: string | null;
  active: boolean;
  createdAt: string;
  ingredients: RecipeIngredientAuthority[];
  totalCost: number;
};

type RecipeIngredientAuthority = {
  id: number;
  recipeId: number;
  purchasingItemId: number;
  quantity: string;
  unit: string;
  itemName?: string;
  unitCost?: number;
  lineCost?: number;
};

type AvailableIngredient = {
  id: number;
  item: string;
  category: string | null;
  unitCost: number | null;
  orderUnit: string | null;
  portionUnit: string | null;
  portionSize: number | null;
};

const recipeIngredientFormSchema = z.object({
  recipeId: z.number(),
  ingredientId: z.string().min(1, "Please select an ingredient"),
  quantity: z.string().min(1, "Quantity is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Quantity must be a positive number"),
  unit: z.string().optional(),
});

export default function RecipeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeAuthority | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddIngredientDialogOpen, setIsAddIngredientDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<RecipeIngredientAuthority | null>(null);
  const [isMarketingDialogOpen, setIsMarketingDialogOpen] = useState(false);
  const [marketingOutputType, setMarketingOutputType] = useState<'delivery' | 'advertising' | 'social'>('delivery');
  const [ingredientSearchTerm, setIngredientSearchTerm] = useState('');
  const [ingredientCategoryFilter, setIngredientCategoryFilter] = useState('all');
  const [isIngredientFormOpen, setIsIngredientFormOpen] = useState(false);
  const [editingIngredientItem, setEditingIngredientItem] = useState<any>(null);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [marketingNotes, setMarketingNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'recipes' | 'ingredients'>('recipes');
  
  // Recipe Authority API - canonical source
  const { data: recipesData, isLoading: recipesLoading, isError: recipesError } = useQuery<{ ok: boolean; recipes: RecipeAuthority[] }>({
    queryKey: ['/api/recipe-authority'],
    queryFn: async () => {
      const res = await fetch('/api/recipe-authority/');
      if (!res.ok) throw new Error('Failed to load recipes');
      return res.json();
    },
    retry: 1,
  });
  const recipes = recipesData?.recipes || [];

  // Available ingredients from purchasing items (is_ingredient = true)
  const { data: ingredientsData, isLoading: ingredientsLoading, isError: ingredientsError } = useQuery<{ ok: boolean; ingredients: AvailableIngredient[] }>({
    queryKey: ['/api/recipe-authority/available-ingredients'],
    queryFn: async () => {
      const res = await fetch('/api/recipe-authority/available-ingredients');
      if (!res.ok) throw new Error('Failed to load ingredients');
      return res.json();
    },
    retry: 1,
  });
  const ingredients = ingredientsData?.ingredients || [];

  // Fallback redirect: if both API calls fail, redirect to Purchasing with warning
  useEffect(() => {
    if (recipesError && ingredientsError) {
      toast({
        title: "Recipe Management unavailable",
        description: "Redirecting to Purchasing List. Please check server logs.",
        variant: "destructive",
      });
      navigate('/operations/purchasing?warning=recipe-api-failed');
    }
  }, [recipesError, ingredientsError, navigate, toast]);

  // Forms
  const recipeForm = useForm({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      name: "",
      category: "",
      description: "",
      yieldUnits: "",
    },
  });

  const ingredientForm = useForm({
    resolver: zodResolver(recipeIngredientFormSchema),
    defaultValues: {
      recipeId: 0,
      ingredientId: "",
      quantity: "1",
      unit: "g",
    },
  });

  // Mutations using Recipe Authority API
  const createRecipeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/recipe-authority/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create recipe' }));
        throw new Error(err.error || 'Failed to create recipe');
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/recipe-authority'] });
      await queryClient.refetchQueries({ queryKey: ['/api/recipe-authority'] });
      setIsCreateDialogOpen(false);
      recipeForm.reset();
      toast({ title: "Recipe created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create recipe", 
        description: error.message || 'An error occurred',
        variant: "destructive" 
      });
    },
  });

  const addIngredientMutation = useMutation({
    mutationFn: async (data: { recipeId: number; purchasingItemId: number; quantity: string; unit: string }) => {
      const res = await fetch(`/api/recipe-authority/${data.recipeId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchasingItemId: data.purchasingItemId,
          quantity: data.quantity,
          unit: data.unit,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-authority'] });
      setIsAddIngredientDialogOpen(false);
      ingredientForm.reset();
      toast({ title: "Ingredient added successfully" });
    },
  });

  const updateIngredientMutation = useMutation({
    mutationFn: async ({ recipeId, ingredientId, data }: { recipeId: number; ingredientId: number; data: { quantity: string; unit: string } }) => {
      const res = await fetch(`/api/recipe-authority/${recipeId}/ingredients/${ingredientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-authority'] });
      setEditingIngredient(null);
      toast({ title: "Ingredient updated successfully" });
    },
  });

  const removeIngredientMutation = useMutation({
    mutationFn: async ({ recipeId, ingredientId }: { recipeId: number; ingredientId: number }) => {
      const res = await fetch(`/api/recipe-authority/${recipeId}/ingredients/${ingredientId}`, {
        method: 'DELETE',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-authority'] });
      toast({ title: "Ingredient removed successfully" });
    },
    onError: (error: any) => {
      console.error('Error removing ingredient:', error);
      toast({ 
        title: "Failed to remove ingredient", 
        description: error.message || 'An error occurred while removing the ingredient',
        variant: "destructive" 
      });
    },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/recipe-authority/${id}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-authority'] });
      setSelectedRecipe(null);
      toast({ title: "Recipe deleted successfully" });
    },
  });

  // Force refresh recipe ingredients data
  const refreshRecipeData = () => {
    if (selectedRecipe) {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes', selectedRecipe.id, 'ingredients'] });
      queryClient.refetchQueries({ queryKey: ['/api/recipes', selectedRecipe.id, 'ingredients'] });
      toast({ title: "Recipe data refreshed" });
    }
  };

  // Marketing content generation mutation
  const generateMarketingMutation = useMutation({
    mutationFn: async ({ recipeId, outputType, notes }: { recipeId: number, outputType: string, notes?: string }) => {
      const response = await apiRequest('POST', `/api/recipes/${recipeId}/generate-marketing`, { outputType, notes });
      return response.json();
    },
    onSuccess: (data: any) => {
      setGeneratedContent(data.content);
      toast({ title: `${marketingOutputType.charAt(0).toUpperCase() + marketingOutputType.slice(1)} content generated successfully!` });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to generate marketing content", 
        description: error.details || error.message,
        variant: "destructive" 
      });
    }
  });

  // Ingredient Management Mutations
  const createIngredientMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/ingredients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      setIsIngredientFormOpen(false);
      setEditingIngredientItem(null);
      toast({ title: "Ingredient created successfully" });
    },
  });

  const updateIngredientItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest('PUT', `/api/ingredients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      setIsIngredientFormOpen(false);
      setEditingIngredientItem(null);
      toast({ title: "Ingredient updated successfully" });
    },
  });

  const deleteIngredientMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/ingredients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
      toast({ title: "Ingredient deleted successfully" });
    },
  });

  // Query for existing marketing content
  const { data: marketingContentData } = useQuery({
    queryKey: [`/api/recipes/${selectedRecipe?.id}/marketing`, marketingOutputType],
    queryFn: async () => {
      if (!selectedRecipe) return null;
      const response = await fetch(`/api/recipes/${selectedRecipe.id}/marketing?type=${marketingOutputType}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedRecipe && isMarketingDialogOpen
  });

  const onCreateRecipe = (data: any) => {
    createRecipeMutation.mutate(data);
  };

  const onAddIngredient = (data: any) => {
    if (!selectedRecipe) return;
    
    const ingredientId = parseInt(data.ingredientId);
    const selectedIngredient = ingredients.find((ing) => ing.id === ingredientId);
    if (!selectedIngredient) {
      toast({ title: "Please select an ingredient", variant: "destructive" });
      return;
    }

    const quantity = parseFloat(data.quantity);
    
    if (isNaN(quantity) || quantity <= 0) {
      toast({ title: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    addIngredientMutation.mutate({
      recipeId: selectedRecipe.id,
      ingredientId: ingredientId.toString(),
      quantity: data.quantity,
      unit: selectedIngredient.portionUnit || selectedIngredient.orderUnit || 'unit',
    });
  };

  const onUpdateIngredient = (data: any) => {
    if (!editingIngredient) return;
    
    updateIngredientMutation.mutate({
      id: editingIngredient.id,
      data: { 
        ...data, 
        quantity: data.quantity,
      }
    });
  };

  const calculateRecipeCost = () => {
    if (selectedRecipe?.totalCost) {
      return selectedRecipe.totalCost.toFixed(2);
    }
    if (selectedRecipe?.ingredients) {
      return selectedRecipe.ingredients.reduce((sum, ing) => sum + (ing.lineCost || 0), 0).toFixed(2);
    }
    return '0.00';
  };

  const getIngredientName = (ingredientId: number) => {
    const ingredient = ingredients.find((ing) => ing.id === ingredientId);
    return ingredient ? ingredient.item : "Unknown";
  };

  const getIngredientCost = (ingredientId: number, quantity: string) => {
    const ingredient = ingredients.find((ing) => ing.id === ingredientId);
    if (!ingredient) return "0.00";
    
    const unitCost = ingredient.unitCost || 0;
    const qty = parseFloat(quantity);
    return (unitCost * qty).toFixed(2);
  };

  // Ingredient Management handlers
  const handleCreateIngredient = (data: any) => {
    createIngredientMutation.mutate(data);
  };

  const handleUpdateIngredient = (data: any) => {
    if (editingIngredientItem) {
      updateIngredientItemMutation.mutate({ id: editingIngredientItem.id, data });
    }
  };

  const handleDeleteIngredient = (id: number) => {
    if (window.confirm('Are you sure you want to delete this ingredient?')) {
      deleteIngredientMutation.mutate(id);
    }
  };

  // Filter ingredients for search and category
  const filteredIngredients = ingredients.filter((ingredient) => {
    const matchesSearch = !ingredientSearchTerm || 
                         ingredient.item.toLowerCase().includes(ingredientSearchTerm.toLowerCase());
    
    const matchesCategory = ingredientCategoryFilter === 'all' || ingredient.category === ingredientCategoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  if (recipesLoading || ingredientsLoading) {
    return (
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4 max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">Recipe Management</h1>
        </div>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-80 bg-slate-100 dark:bg-slate-800 rounded-[4px]"></div>
            <div className="h-80 bg-slate-100 dark:bg-slate-800 rounded-[4px]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-4 lg:px-6 py-4 space-y-4 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-sm sm:text-base lg:text-lg font-semibold text-slate-900 dark:text-white">
          Recipe & Ingredient Management
        </h1>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant={activeTab === 'recipes' ? 'default' : 'outline'}
            onClick={() => setActiveTab('recipes')}
            size="sm"
            className={`flex-1 sm:flex-none text-xs rounded-[4px] ${activeTab === 'recipes' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
          >
            Recipes
          </Button>
          <Button
            variant={activeTab === 'ingredients' ? 'default' : 'outline'}
            onClick={() => setActiveTab('ingredients')}
            size="sm"
            className={`flex-1 sm:flex-none text-xs rounded-[4px] ${activeTab === 'ingredients' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
          >
            Ingredients
          </Button>
        </div>
      </div>

      {activeTab === 'recipes' && (
        <>
        <div className="space-y-3">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-3 w-3 mr-1" />
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                    className="w-24"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRecipeMutation.isPending} className="w-32">
                    {createRecipeMutation.isPending ? "Creating..." : "Create Recipe"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Recipes List */}
        <Card className="rounded-[4px] border-slate-200 dark:border-slate-700">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">Recipes ({recipes.length})</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Manage your restaurant's recipes and their costs
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className={`p-3 rounded-[4px] border cursor-pointer transition-colors touch-manipulation ${
                    selectedRecipe?.id === recipe.id 
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 active:bg-slate-50 dark:active:bg-slate-800'
                  }`}
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-medium text-slate-900 dark:text-white truncate">{recipe.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{recipe.category || 'Uncategorized'}</p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                        <span className="text-xs text-slate-500">
                          ฿{recipe.totalCost?.toFixed(2) || '0.00'}
                        </span>
                        <span className="text-xs text-slate-500">
                          Serves: {recipe.yieldUnits || '-'}
                        </span>
                      </div>
                    </div>
                    <Badge 
                      variant={recipe.active ? "default" : "secondary"}
                      className={`text-[10px] px-1.5 py-0.5 rounded-[4px] shrink-0 ${recipe.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}
                    >
                      {recipe.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {recipes.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-xs">No recipes yet. Create your first recipe!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recipe Details */}
        <Card className="rounded-[4px] border-slate-200 dark:border-slate-700">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {selectedRecipe ? selectedRecipe.name : "Select a Recipe"}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedRecipe ? "Recipe details and cost breakdown" : "Choose a recipe to view details"}
                </CardDescription>
              </div>
              {selectedRecipe && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteRecipeMutation.mutate(selectedRecipe.id)}
                  disabled={deleteRecipeMutation.isPending}
                  className="shrink-0 h-8 w-8 p-0 rounded-[4px]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 max-h-[60vh] overflow-y-auto">
            {selectedRecipe ? (
              <div className="space-y-4">
                {/* Recipe Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Category</Label>
                    <p className="text-xs text-slate-900 dark:text-white">{selectedRecipe.category || 'Uncategorized'}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Serves</Label>
                    <p className="text-xs text-slate-900 dark:text-white">{selectedRecipe.yieldUnits || '1'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Cost</Label>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">฿{calculateRecipeCost()}</p>
                  </div>
                </div>

                {selectedRecipe.description && (
                  <div>
                    <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Description</Label>
                    <p className="text-xs text-slate-700 dark:text-slate-300">{selectedRecipe.description}</p>
                  </div>
                )}

                <Separator className="my-3" />

                {/* Ingredients Section */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-medium text-slate-900 dark:text-white">Ingredients ({selectedRecipe?.ingredients?.length || 0})</h3>
                    <Dialog open={isAddIngredientDialogOpen} onOpenChange={setIsAddIngredientDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="h-7 text-xs rounded-[4px]">
                          <Plus className="h-3 w-3 mr-1" />
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
                                      {ingredients.map((ingredient) => (
                                        <SelectItem key={ingredient.id} value={ingredient.id.toString()}>
                                          {ingredient.item} (฿{Number(ingredient.unitCost || 0).toFixed(2)}/{ingredient.portionUnit || ingredient.orderUnit || 'unit'})
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
                                className="w-24"
                              >
                                Cancel
                              </Button>
                              <Button type="submit" disabled={addIngredientMutation.isPending} className="w-32">
                                {addIngredientMutation.isPending ? "Adding..." : "Add Ingredient"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2">
                    {(selectedRecipe?.ingredients || []).map((ri) => (
                      <div key={ri.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <span className="font-medium">{ri.itemName || 'Unknown'}</span>
                          <span className="text-sm text-gray-600 ml-2">
                            {ri.quantity} {ri.unit}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-green-600">
                            ฿{(ri.lineCost || 0).toFixed(2)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIngredientMutation.mutate(ri.id)}
                            disabled={removeIngredientMutation.isPending}
                            className="w-8"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {(!selectedRecipe?.ingredients || selectedRecipe.ingredients.length === 0) && (
                      <div className="text-center py-4 text-gray-500">
                        <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No ingredients added yet</p>
                      </div>
                    )}
                  </div>

                  {selectedRecipe?.ingredients && selectedRecipe.ingredients.length > 0 && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-emerald-900/20 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total Recipe Cost:</span>
                        <span className="text-sm font-bold text-green-600 dark:text-emerald-400">
                          ฿{calculateRecipeCost()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Marketing Content Generation */}
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center">
                        <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
                        AI Marketing Content
                      </h3>
                      <p className="text-sm text-gray-600">Generate descriptions, headlines, and ad copy for delivery partners</p>
                    </div>
                    <Dialog open={isMarketingDialogOpen} onOpenChange={setIsMarketingDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Megaphone className="h-4 w-4 mr-2" />
                          Generate Content
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center">
                            <Sparkles className="h-5 w-5 mr-2 text-purple-600" />
                            Generate Marketing Content for {selectedRecipe.name}
                          </DialogTitle>
                          <DialogDescription>
                            Create professional marketing content for delivery partners, advertising, and social media
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                          {/* Content Type Selection */}
                          <div>
                            <Label className="text-sm font-medium">Content Type</Label>
                            <div className="flex space-x-2 mt-2">
                              <Button
                                variant={marketingOutputType === 'delivery' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setMarketingOutputType('delivery')}
                                className="w-36"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Delivery Partner
                              </Button>
                              <Button
                                variant={marketingOutputType === 'advertising' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setMarketingOutputType('advertising')}
                                className="w-36"
                              >
                                <Megaphone className="h-4 w-4 mr-2" />
                                Advertising
                              </Button>
                              <Button
                                variant={marketingOutputType === 'social' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setMarketingOutputType('social')}
                                className="w-36"
                              >
                                <Share2 className="h-4 w-4 mr-2" />
                                Social Media
                              </Button>
                            </div>
                          </div>

                          {/* Marketing Notes */}
                          <div>
                            <Label htmlFor="marketingNotes" className="text-sm font-medium">
                              Additional Notes (Optional)
                            </Label>
                            <Textarea
                              id="marketingNotes"
                              placeholder="Add any special details, unique selling points, or brand voice instructions..."
                              value={marketingNotes}
                              onChange={(e) => setMarketingNotes(e.target.value)}
                              className="mt-2"
                              rows={3}
                            />
                          </div>

                          {/* Generate Button */}
                          <Button
                            onClick={() => {
                              if (selectedRecipe) {
                                generateMarketingMutation.mutate({
                                  recipeId: selectedRecipe.id,
                                  outputType: marketingOutputType,
                                  notes: marketingNotes
                                });
                              }
                            }}
                            disabled={generateMarketingMutation.isPending}
                            className="w-full"
                          >
                            {generateMarketingMutation.isPending ? (
                              <>Generating Content...</>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate {marketingOutputType.charAt(0).toUpperCase() + marketingOutputType.slice(1)} Content
                              </>
                            )}
                          </Button>

                          {/* Generated Content Display */}
                          {generatedContent && (
                            <div className="space-y-4">
                              <Separator />
                              <h4 className="font-semibold">Generated Content ({marketingOutputType})</h4>
                              
                              {/* Version 1 */}
                              <div className="p-4 border rounded-lg bg-gray-50">
                                <div className="flex justify-between items-start mb-2">
                                  <Badge variant="secondary">Version 1</Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        `${generatedContent.version1.headline}\n\n${generatedContent.version1.body}${
                                          generatedContent.version1.hashtags ? `\n\n${generatedContent.version1.hashtags.join(' ')}` : ''
                                        }`
                                      );
                                      toast({ title: "Content copied to clipboard!" });
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <p className="font-medium text-sm text-gray-600">Headline:</p>
                                    <p className="font-semibold">{generatedContent.version1.headline}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm text-gray-600">Body:</p>
                                    <p>{generatedContent.version1.body}</p>
                                  </div>
                                  {generatedContent.version1.hashtags && (
                                    <div>
                                      <p className="font-medium text-sm text-gray-600">Hashtags:</p>
                                      <p className="text-blue-600">{generatedContent.version1.hashtags.join(' ')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Version 2 */}
                              <div className="p-4 border rounded-lg bg-gray-50">
                                <div className="flex justify-between items-start mb-2">
                                  <Badge variant="secondary">Version 2</Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        `${generatedContent.version2.headline}\n\n${generatedContent.version2.body}${
                                          generatedContent.version2.hashtags ? `\n\n${generatedContent.version2.hashtags.join(' ')}` : ''
                                        }`
                                      );
                                      toast({ title: "Content copied to clipboard!" });
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <p className="font-medium text-sm text-gray-600">Headline:</p>
                                    <p className="font-semibold">{generatedContent.version2.headline}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm text-gray-600">Body:</p>
                                    <p>{generatedContent.version2.body}</p>
                                  </div>
                                  {generatedContent.version2.hashtags && (
                                    <div>
                                      <p className="font-medium text-sm text-gray-600">Hashtags:</p>
                                      <p className="text-blue-600">{generatedContent.version2.hashtags.join(' ')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Version 3 */}
                              <div className="p-4 border rounded-lg bg-gray-50">
                                <div className="flex justify-between items-start mb-2">
                                  <Badge variant="secondary">Version 3</Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        `${generatedContent.version3.headline}\n\n${generatedContent.version3.body}${
                                          generatedContent.version3.hashtags ? `\n\n${generatedContent.version3.hashtags.join(' ')}` : ''
                                        }`
                                      );
                                      toast({ title: "Content copied to clipboard!" });
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <p className="font-medium text-sm text-gray-600">Headline:</p>
                                    <p className="font-semibold">{generatedContent.version3.headline}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm text-gray-600">Body:</p>
                                    <p>{generatedContent.version3.body}</p>
                                  </div>
                                  {generatedContent.version3.hashtags && (
                                    <div>
                                      <p className="font-medium text-sm text-gray-600">Hashtags:</p>
                                      <p className="text-blue-600">{generatedContent.version3.hashtags.join(' ')}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Existing Content Preview */}
                          {marketingContentData?.content && !generatedContent && (
                            <div className="space-y-4">
                              <Separator />
                              <h4 className="font-semibold">Previously Generated Content ({marketingOutputType})</h4>
                              <div className="p-4 border rounded-lg bg-blue-50">
                                <p className="text-sm text-gray-600 mb-2">Click "Generate Content" to create new versions</p>
                                <div className="space-y-2">
                                  <div>
                                    <p className="font-medium text-sm text-gray-600">Headline:</p>
                                    <p className="font-semibold">{marketingContentData.content.version1?.headline}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm text-gray-600">Body:</p>
                                    <p>{marketingContentData.content.version1?.body}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Quick Content Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    <div className="p-3 border rounded-lg text-center">
                      <FileText className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs font-medium">Delivery Partner</p>
                      <p className="text-xs text-gray-500">GrabFood, FoodPanda</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <Megaphone className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs font-medium">Advertising</p>
                      <p className="text-xs text-gray-500">Headlines & Body</p>
                    </div>
                    <div className="p-3 border rounded-lg text-center">
                      <Share2 className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs font-medium">Social Media</p>
                      <p className="text-xs text-gray-500">Instagram, Facebook</p>
                    </div>
                  </div>
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
      </>
      )}

      {/* Ingredients Tab */}
      {activeTab === 'ingredients' && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Ingredient Management</h2>
            </div>
            <Button
              onClick={() => {
                setEditingIngredientItem(null);
                setIsIngredientFormOpen(true);
              }}
              size="sm"
              className="w-full sm:w-auto text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Ingredient
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search ingredients..."
                value={ingredientSearchTerm}
                onChange={(e) => setIngredientSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-[4px] border-slate-200 dark:border-slate-700"
              />
            </div>
            <Select value={ingredientCategoryFilter} onValueChange={setIngredientCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 text-xs rounded-[4px] border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Filter by category" />
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

          {/* Ingredient List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredIngredients.map((ingredient) => (
              <Card key={ingredient.id} className="rounded-[4px] border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow touch-manipulation">
                <CardHeader className="p-3 pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xs font-medium text-slate-900 dark:text-white truncate">{ingredient.item}</CardTitle>
                      <CardDescription className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {ingredient.category || 'Uncategorized'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingIngredientItem(ingredient);
                          setIsIngredientFormOpen(true);
                        }}
                        className="h-7 w-7 p-0 rounded-[4px]"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteIngredient(ingredient.id)}
                        className="h-7 w-7 p-0 rounded-[4px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Unit Cost:</span>
                      <span className="font-medium text-slate-900 dark:text-white">฿{Number(ingredient.unitCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Unit:</span>
                      <span className="text-slate-700 dark:text-slate-300">{ingredient.portionUnit || ingredient.orderUnit || '-'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredIngredients.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-xs text-slate-500 dark:text-slate-400">No ingredients found</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                {ingredientSearchTerm || ingredientCategoryFilter !== 'all' 
                  ? 'Try adjusting your search or filter'
                  : 'Add your first ingredient to get started'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ingredient Form Dialog */}
      <Dialog open={isIngredientFormOpen} onOpenChange={setIsIngredientFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIngredientItem ? 'Edit Ingredient' : 'Add New Ingredient'}
            </DialogTitle>
          </DialogHeader>
          <IngredientForm
            ingredient={editingIngredientItem || undefined}
            onSubmit={editingIngredientItem ? handleUpdateIngredient : handleCreateIngredient}
            onCancel={() => {
              setIsIngredientFormOpen(false);
              setEditingIngredientItem(null);
            }}
            isSubmitting={createIngredientMutation.isPending || updateIngredientItemMutation.isPending}
          />
        </DialogContent>
      </Dialog>

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
                    className="w-20"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateIngredientMutation.isPending} className="w-20">
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
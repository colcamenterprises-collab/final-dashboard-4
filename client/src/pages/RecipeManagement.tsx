import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit3, Search, Eye } from "lucide-react";
import { z } from "zod";
import { RecipeEditModal } from "@/components/RecipeEditModal";
import { RecipeViewModal } from "@/components/RecipeViewModal";
import { INGREDIENT_CATEGORIES } from "@/constants/ingredientCategories";

const recipeFormSchema = z.object({
  name: z.string().min(1, "Recipe name is required"),
  category: z.string().optional(),
  yieldUnits: z.string().optional(),
});

type RecipeAuthority = {
  id: number;
  name: string;
  category?: string;
  yieldUnits?: string | null;
  active: boolean;
  createdAt?: string;
  ingredients: RecipeIngredientAuthority[];
  totalCost: number | null;
};

type RecipeIngredientAuthority = {
  id: number;
  recipeId: number;
  purchasingItemId: number;
  quantity: string;
  unit: string;
  ingredientName?: string;
  ingredientCost?: number;
  lineCost?: number;
};

type AvailableIngredient = {
  id: number;
  item: string;
  category: string | null;
  unitCost: number | null;
  orderUnit: string | null;
  portionUnit: string | null;
};

export default function RecipeManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeAuthority | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewingRecipe, setViewingRecipe] = useState<RecipeAuthority | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'recipes' | 'ingredients'>('recipes');
  const [ingredientSearchTerm, setIngredientSearchTerm] = useState('');
  const [ingredientCategoryFilter, setIngredientCategoryFilter] = useState('all');

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

  useEffect(() => {
    if (recipesError && ingredientsError) {
      toast({
        title: "Recipe Management unavailable",
        description: "Redirecting to Purchasing List.",
        variant: "destructive",
      });
      navigate('/operations/purchasing?warning=recipe-api-failed');
    }
  }, [recipesError, ingredientsError, navigate, toast]);

  const recipeForm = useForm({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: { name: "", category: "", yieldUnits: "" },
  });

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
      setIsCreateDialogOpen(false);
      recipeForm.reset();
      toast({ title: "Recipe created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create recipe", description: error.message, variant: "destructive" });
    },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/recipe-authority/${id}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipe-authority'] });
      toast({ title: "Recipe deleted" });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      const res = await fetch(`/api/recipe-authority/${recipeId}/create-product`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create product');
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "Product created", description: "Product created from recipe. Set prices before activating." });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create product", description: error.message, variant: "destructive" });
    },
  });

  const onCreateRecipe = (data: any) => {
    createRecipeMutation.mutate(data);
  };

  const handleViewRecipe = (recipe: RecipeAuthority) => {
    setViewingRecipe(recipe);
    setIsViewModalOpen(true);
  };

  const handleEditRecipe = (recipe: RecipeAuthority) => {
    setEditingRecipe(recipe);
    setIsEditModalOpen(true);
  };

  const handleEditFromView = () => {
    if (viewingRecipe) {
      setIsViewModalOpen(false);
      setEditingRecipe(viewingRecipe);
      setIsEditModalOpen(true);
    }
  };

  const handleCreateProductFromRecipe = () => {
    if (!viewingRecipe) return;
    createProductMutation.mutate(viewingRecipe.id);
  };

  const handleCreateProductFromEdit = () => {
    if (!editingRecipe) return;
    createProductMutation.mutate(editingRecipe.id);
  };

  const handleDeleteRecipe = (id: number) => {
    if (window.confirm('Delete this recipe?')) {
      deleteRecipeMutation.mutate(id);
    }
  };

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
          <h1 className="text-sm font-semibold text-slate-900 dark:text-white">Recipe Management</h1>
        </div>
        <div className="animate-pulse">
          <div className="h-80 bg-slate-100 dark:bg-slate-800 rounded-[4px]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-4 lg:px-6 py-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-sm font-semibold text-slate-900 dark:text-white">Recipe Management</h1>
        
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'recipes' ? 'default' : 'outline'}
            onClick={() => setActiveTab('recipes')}
            size="sm"
            className={`text-xs rounded-[4px] ${activeTab === 'recipes' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            data-testid="tab-recipes"
          >
            Recipes
          </Button>
          <Button
            variant={activeTab === 'ingredients' ? 'default' : 'outline'}
            onClick={() => setActiveTab('ingredients')}
            size="sm"
            className={`text-xs rounded-[4px] ${activeTab === 'ingredients' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
            data-testid="tab-ingredients"
          >
            Ingredients
          </Button>
        </div>
      </div>

      {activeTab === 'recipes' && (
        <Card className="rounded-[4px] border-slate-200">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium">Recipes ({recipes.length})</CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-7 text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700" data-testid="button-create-recipe">
                  <Plus className="h-3 w-3 mr-1" />
                  Create
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-sm">Create Recipe</DialogTitle>
                  <DialogDescription className="text-xs">Add a new recipe</DialogDescription>
                </DialogHeader>
                <Form {...recipeForm}>
                  <form onSubmit={recipeForm.handleSubmit(onCreateRecipe)} className="space-y-3">
                    <FormField
                      control={recipeForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Name</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-xs rounded-[4px]" placeholder="Recipe name" {...field} data-testid="input-recipe-name" />
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
                          <FormLabel className="text-xs">Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-8 text-xs rounded-[4px]">
                                <SelectValue placeholder="Select" />
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
                    <FormField
                      control={recipeForm.control}
                      name="yieldUnits"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Serves</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-xs rounded-[4px]" placeholder="1" {...field} data-testid="input-yield" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(false)} className="text-xs rounded-[4px]">
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={createRecipeMutation.isPending} className="text-xs rounded-[4px] bg-emerald-600 hover:bg-emerald-700" data-testid="button-submit-recipe">
                        {createRecipeMutation.isPending ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-medium text-slate-600">Name</th>
                  <th className="text-left py-2 font-medium text-slate-600 hidden sm:table-cell">Ingredients</th>
                  <th className="text-left py-2 font-medium text-slate-600">Cost</th>
                  <th className="text-left py-2 font-medium text-slate-600 hidden sm:table-cell">Status</th>
                  <th className="text-right py-2 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`row-recipe-${recipe.id}`}>
                    <td className="py-2 text-slate-900">{recipe.name}</td>
                    <td className="py-2 text-slate-600 hidden sm:table-cell">{recipe.ingredients?.length || 0}</td>
                    <td className="py-2 text-emerald-600 font-medium">
                      {recipe.totalCost !== null ? `฿${Number(recipe.totalCost).toFixed(2)}` : "Unavailable"}
                    </td>
                    <td className="py-2 hidden sm:table-cell">
                      <Badge variant={recipe.active ? "default" : "secondary"} className={`text-[10px] rounded-[4px] ${recipe.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {recipe.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewRecipe(recipe)} className="h-6 w-6 p-0" data-testid={`button-view-${recipe.id}`}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditRecipe(recipe)} className="h-6 w-6 p-0" data-testid={`button-edit-${recipe.id}`}>
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRecipe(recipe.id)} className="h-6 w-6 p-0 text-red-500" data-testid={`button-delete-${recipe.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {recipes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">No recipes yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ingredients' && (
        <Card className="rounded-[4px] border-slate-200">
          <CardHeader className="p-3 pb-2">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <CardTitle className="text-xs font-medium">Available Ingredients ({filteredIngredients.length})</CardTitle>
              <div className="flex gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <Input
                    placeholder="Search..."
                    value={ingredientSearchTerm}
                    onChange={(e) => setIngredientSearchTerm(e.target.value)}
                    className="h-7 pl-7 text-xs rounded-[4px]"
                    data-testid="input-search-ingredients"
                  />
                </div>
                <Select value={ingredientCategoryFilter} onValueChange={setIngredientCategoryFilter}>
                  <SelectTrigger className="h-7 w-32 text-xs rounded-[4px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {INGREDIENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-medium text-slate-600">Item</th>
                  <th className="text-left py-2 font-medium text-slate-600 hidden sm:table-cell">Category</th>
                  <th className="text-left py-2 font-medium text-slate-600">Unit Cost</th>
                  <th className="text-left py-2 font-medium text-slate-600 hidden sm:table-cell">Unit</th>
                </tr>
              </thead>
              <tbody>
                {filteredIngredients.map((ing) => (
                  <tr key={ing.id} className="border-b border-slate-100" data-testid={`row-ingredient-${ing.id}`}>
                    <td className="py-2 text-slate-900">{ing.item}</td>
                    <td className="py-2 text-slate-600 hidden sm:table-cell">{ing.category || '-'}</td>
                    <td className="py-2 text-emerald-600 font-medium">฿{Number(ing.unitCost || 0).toFixed(2)}</td>
                    <td className="py-2 text-slate-600 hidden sm:table-cell">{ing.portionUnit || ing.orderUnit || '-'}</td>
                  </tr>
                ))}
                {filteredIngredients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">No ingredients found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <RecipeViewModal
        recipe={viewingRecipe}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingRecipe(null);
        }}
        onEdit={handleEditFromView}
        onCreateProduct={handleCreateProductFromRecipe}
      />

      <RecipeEditModal
        recipe={editingRecipe}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRecipe(null);
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/recipe-authority'] });
        }}
        onCreateProduct={handleCreateProductFromEdit}
      />
    </div>
  );
}

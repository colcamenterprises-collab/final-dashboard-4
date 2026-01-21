import React, { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(n || 0);

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

type RecipeLine = {
  ingredientId?: string;
  name?: string;
  qty?: number;
  unit?: string;
  unitCostTHB?: number;
  costTHB?: number;
};

type Recipe = {
  id: number;
  name?: string;
  description?: string;
  category?: string;
  costPerServing?: number;
  cost_per_serving?: number;
  totalCost?: number;
  total_cost?: number;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
  ingredients?: RecipeLine[];
};

const formatDate = (value?: string) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getRecipeCostPerServing = (recipe: Recipe) =>
  num(recipe.costPerServing ?? recipe.cost_per_serving);

const getRecipeUpdatedAt = (recipe: Recipe) =>
  recipe.updatedAt ?? recipe.updated_at ?? recipe.createdAt ?? recipe.created_at;

const getRecipeCategory = (recipe: Recipe) => recipe.category || "Uncategorized";

const getRecipeIngredients = (recipe: Recipe) => recipe.ingredients || [];

const getRecipeStatus = (recipe: Recipe) => {
  if (!recipe.name || recipe.name.trim().length === 0) {
    return { status: "INCOMPLETE", reason: "Missing name" };
  }

  const ingredients = getRecipeIngredients(recipe);
  if (ingredients.length === 0) {
    return { status: "INCOMPLETE", reason: "No ingredients" };
  }

  const hasQty = ingredients.every((line) => num(line.qty) > 0);
  if (!hasQty) {
    return { status: "INCOMPLETE", reason: "Missing quantities" };
  }

  if (getRecipeCostPerServing(recipe) <= 0) {
    return { status: "INCOMPLETE", reason: "Missing cost per serve" };
  }

  return { status: "VALID", reason: "Ready" };
};

export default function RecipeListPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      const response = await fetch("/api/recipes");
      if (!response.ok) {
        throw new Error("Failed to fetch recipes");
      }
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete recipe");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast({ title: "Recipe deleted", description: "The recipe was removed." });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Unable to delete the recipe.",
        variant: "destructive",
      });
    },
  });

  const recipeRows = useMemo(() => recipes as Recipe[], [recipes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading recipes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 sm:px-8 py-6" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Recipe List</h1>
            <p className="text-sm text-slate-600">Scan, review, and open recipes for editing.</p>
          </div>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-sm rounded-[4px]">
            <Link to="/menu/recipes/new">Create recipe</Link>
          </Button>
        </div>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800">
              {recipeRows.length} Recipe{recipeRows.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="hidden sm:grid sm:grid-cols-6 gap-4 text-xs font-medium text-slate-500">
              <div>Recipe Name</div>
              <div>Category</div>
              <div>Cost per serve</div>
              <div>Status</div>
              <div>Last updated</div>
              <div>Actions</div>
            </div>

            {recipeRows.map((recipe) => {
              const status = getRecipeStatus(recipe);
              const ingredients = getRecipeIngredients(recipe);
              return (
                <div
                  key={recipe.id}
                  className="grid grid-cols-1 sm:grid-cols-6 gap-4 border border-slate-100 rounded-[4px] p-4 sm:items-center"
                >
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Recipe Name</div>
                    <div className="text-sm font-medium text-slate-900">{recipe.name || "Unnamed recipe"}</div>
                    <div className="text-xs text-slate-500">{ingredients.length} ingredient{ingredients.length === 1 ? "" : "s"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Category</div>
                    <div className="text-sm text-slate-700">{getRecipeCategory(recipe)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Cost per serve</div>
                    <div className="text-sm font-medium text-slate-900">{THB(getRecipeCostPerServing(recipe))}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Status</div>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={status.status === "VALID" ? "default" : "secondary"}
                        className={status.status === "VALID" ? "bg-emerald-600" : "bg-amber-100 text-amber-800"}
                      >
                        {status.status}
                      </Badge>
                      <span className="text-xs text-slate-500">{status.reason}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 sm:hidden">Last updated</div>
                    <div className="text-sm text-slate-700">{formatDate(getRecipeUpdatedAt(recipe))}</div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button asChild variant="outline" className="text-xs rounded-[4px]">
                      <Link to={`/menu/recipes/${recipe.id}`}>Edit</Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="text-xs rounded-[4px] border-rose-200 text-rose-600 hover:text-rose-700">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[4px]">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-sm">Delete recipe</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs">
                            This action cannot be undone. The recipe will be removed permanently.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="text-xs rounded-[4px]">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="text-xs rounded-[4px] bg-rose-600 hover:bg-rose-700"
                            onClick={() => deleteMutation.mutate(recipe.id)}
                          >
                            Delete recipe
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}

            {recipeRows.length === 0 && (
              <div className="text-center py-12 text-sm text-slate-500">No recipes available.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

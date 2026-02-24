import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(n || 0);

type RecipeListItem = {
  id: number;
  name: string;
  sku: string;
  category: string;
  salePrice: number;
  description: string;
  imageUrl?: string;
  updatedAt?: string;
};

export default function RecipeListPage() {
  const { data, isLoading, error } = useQuery<RecipeListItem[]>({
    queryKey: ["recipes-v2"],
    queryFn: async () => {
      const response = await fetch("/api/recipes/v2");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.detail || payload?.error || "Failed to fetch recipes";
        throw new Error(`HTTP ${response.status}: ${message}`);
      }
      return payload;
    },
  });

  const recipes = data ?? [];

  return (
    <div className="min-h-screen px-6 sm:px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Recipe Cost Calculator</h1>
          <p className="text-sm text-slate-600">Locked recipe templates only.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{recipes.length} Recipes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <div className="text-sm text-slate-500">Loading recipes...</div>}
            {error && (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {(error as Error).message}
              </div>
            )}
            {!isLoading && !error && recipes.map((recipe) => (
              <div key={recipe.id} className="border rounded p-3 hover:bg-slate-50 transition-colors">
                <div className="flex gap-4">
                  <div className="h-20 w-20 rounded-md border bg-slate-100 overflow-hidden flex-shrink-0">
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt={recipe.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500 px-1 text-center">No Image</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900">{recipe.name}</div>
                    <div className="text-xs text-slate-600">SKU: {recipe.sku}</div>
                    <div className="text-xs text-slate-600">Category: {recipe.category}</div>
                    <div className="text-sm font-medium text-slate-900">Sale Price: {THB(recipe.salePrice)}</div>
                    {recipe.updatedAt && (
                      <div className="text-[11px] text-slate-500">Last updated: {new Date(recipe.updatedAt).toLocaleString()}</div>
                    )}
                  </div>
                  <div className="flex items-center">
                    <Button asChild size="sm">
                      <Link to={`/menu/recipes/${recipe.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

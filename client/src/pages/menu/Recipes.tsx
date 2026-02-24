import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(n || 0);

type RecipeListItem = {
  id: number;
  name: string;
  sku: string;
  category: string;
  salePrice: number;
  description: string;
};

export default function RecipeListPage() {
  useEffect(() => {
    fetch("/api/recipes/init-templates", { method: "POST" }).catch(() => null);
  }, []);

  const { data, isLoading } = useQuery<RecipeListItem[]>({
    queryKey: ["recipes-v2"],
    queryFn: async () => {
      const response = await fetch("/api/recipes/v2");
      if (!response.ok) throw new Error("Failed to fetch recipes");
      return response.json();
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
            {!isLoading && recipes.map((recipe) => (
              <Link key={recipe.id} to={`/menu/recipes/${recipe.id}`} className="block border rounded p-3 hover:bg-slate-50">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{recipe.name}</div>
                    <div className="text-xs text-slate-600">SKU {recipe.sku} · {recipe.category}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-900">{THB(recipe.salePrice)}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

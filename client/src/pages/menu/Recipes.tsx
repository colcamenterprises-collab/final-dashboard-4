import React, { useEffect, useState } from "react";
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      setInitError(null);

      try {
        const response = await fetch("/api/recipes/templates/ensure", { method: "POST" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const message = payload?.message || payload?.error || "Failed to initialize templates";
          throw new Error(`HTTP ${response.status}: ${message}`);
        }
      } catch (error: any) {
        setInitError(error?.message || "Template initialization failed");
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

  const { data, isLoading } = useQuery<RecipeListItem[]>({
    queryKey: ["recipes-v2"],
    queryFn: async () => {
      const response = await fetch("/api/recipes/v2");
      if (!response.ok) throw new Error("Failed to fetch recipes");
      return response.json();
    },
    enabled: !isInitializing && !initError,
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
            {initError && (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {initError}
              </div>
            )}
            {isInitializing && <div className="text-sm text-slate-500">Initializing templates…</div>}
            {isLoading && <div className="text-sm text-slate-500">Loading recipes...</div>}
            {!isInitializing && !isLoading && !initError && recipes.map((recipe) => (
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

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  published?: boolean;
};

export default function RecipeListPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data = [], isLoading, error } = useQuery<RecipeListItem[]>({
    queryKey: ["recipes-v2"],
    queryFn: async () => {
      const response = await fetch("/api/recipes/v2");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "Failed to fetch recipes");
      return payload;
    },
  });

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(data.map((r) => r.category).filter(Boolean)))],
    [data],
  );

  const recipes = useMemo(() => {
    return data.filter((recipe) => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || recipe.name.toLowerCase().includes(q) || recipe.sku.toLowerCase().includes(q);
      const matchesCategory = category === "all" || recipe.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [category, data, search]);

  return (
    <div className="min-h-screen px-6 py-6 sm:px-8 bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Recipes</h1>
          <p className="text-sm text-slate-600">Manage pricing and publish recipes to online ordering.</p>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipe name or SKU"
              className="md:col-span-3"
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All Categories" : c}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {isLoading && <div className="text-sm text-slate-500">Loading recipes...</div>}
        {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{(error as Error).message}</div>}

        {!isLoading && !error && recipes.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-sm text-slate-500">
              No recipes match your filters.
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <Link to={`/menu/recipes/${recipe.id}`} key={recipe.id}>
              <Card className="h-full overflow-hidden border-slate-200 transition hover:shadow-md">
                <div className="aspect-[16/9] bg-slate-100">
                  {recipe.imageUrl ? (
                    <img src={recipe.imageUrl} alt={recipe.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>
                  )}
                </div>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="line-clamp-2 font-semibold text-slate-900">{recipe.name}</h3>
                      <p className="text-xs text-slate-500">SKU {recipe.sku}</p>
                    </div>
                    <Badge variant={recipe.published ? "default" : "secondary"}>{recipe.published ? "Published" : "Draft"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{recipe.category || "Unmapped"}</Badge>
                    <span className="font-semibold text-slate-900">{THB(recipe.salePrice)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded bg-slate-50 p-2 text-xs text-slate-600">
                    <div>Cost: —</div>
                    <div>Profit: —</div>
                    <div>Margin: —</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const [status, setStatus] = useState("all");

  const { data = [], isLoading, error } = useQuery<RecipeListItem[]>({
    queryKey: ["recipes-v2"],
    queryFn: async () => {
      const response = await fetch("/api/recipes/v2");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "Failed to fetch recipes");
      return payload;
    },
  });

  const categories = useMemo(() => ["all", ...Array.from(new Set(data.map((r) => r.category).filter(Boolean)))], [data]);

  const recipes = useMemo(() => {
    return data.filter((recipe) => {
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || recipe.name.toLowerCase().includes(q) || recipe.sku.toLowerCase().includes(q);
      const matchesCategory = category === "all" || recipe.category === category;
      const matchesStatus =
        status === "all" ||
        (status === "published" && Boolean(recipe.published)) ||
        (status === "draft" && !recipe.published);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [category, data, search, status]);

  const publishedCount = data.filter((recipe) => recipe.published).length;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Recipes</h1>
              <p className="mt-2 text-sm text-slate-500 md:text-base">
                Manage pricing, costing visibility, and publishing status for your recipe library.
              </p>
            </div>

            <div className="grid w-full gap-3 md:grid-cols-3 lg:max-w-3xl">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search recipes</label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by recipe name or SKU"
                  className="h-11 rounded-xl border-slate-200 bg-slate-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === "all" ? "All Categories" : c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Recipes</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{data.length}</div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Published Recipes</div>
              <div className="mt-2 text-3xl font-bold text-emerald-700">{publishedCount}</div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Draft Recipes</div>
              <div className="mt-2 text-3xl font-bold text-amber-700">{Math.max(0, data.length - publishedCount)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average Margin</div>
              <div className="mt-2 text-3xl font-bold text-slate-700">—</div>
            </CardContent>
          </Card>
        </div>

        {isLoading && <div className="text-sm text-slate-500">Loading recipes...</div>}
        {error && <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{(error as Error).message}</div>}

        {!isLoading && !error && recipes.length === 0 && (
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardContent className="p-12 text-center">
              <h2 className="text-lg font-semibold text-slate-900">No recipes found</h2>
              <p className="mt-2 text-sm text-slate-500">Try clearing filters or adding your first recipe to start building cost controls.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <Link to={`/menu/recipes/${recipe.id}`} key={recipe.id}>
              <Card className="h-full overflow-hidden rounded-3xl border-slate-200 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
                <div className="aspect-[16/10] max-h-52 bg-slate-100">
                  {recipe.imageUrl ? (
                    <img src={recipe.imageUrl} alt={recipe.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">No image</div>
                  )}
                </div>

                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="line-clamp-2 text-lg font-semibold text-slate-900">{recipe.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">SKU {recipe.sku}</p>
                    </div>
                    <Badge className={`rounded-full px-3 py-1 text-xs ${recipe.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {recipe.published ? "Published" : "Draft"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="rounded-full border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                      {recipe.category || "Unmapped"}
                    </Badge>
                    <span className="text-lg font-bold text-slate-900">{THB(recipe.salePrice)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    <div>
                      <div className="font-medium text-slate-500">Cost</div>
                      <div className="mt-1 text-slate-800">—</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-500">Profit</div>
                      <div className="mt-1 text-slate-800">—</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-500">Margin</div>
                      <div className="mt-1 text-slate-800">—</div>
                    </div>
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

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type IngredientSearchItem = {
  id: number;
  name: string;
  portionUnit: string | null;
  baseUnit?: string | null;
  unitCostPerBase?: number | null;
  unitPrice?: number | null;
  packCost?: number | null;
  brand?: string | null;
  sku?: string | null;
  portionMeasurement?: string | null;
  category?: string | null;
};

type IngredientSuggestion = {
  suggestedName: string;
  priceEstimateTHB: number | null;
  notes: string;
};

interface IngredientSelectorProps {
  onAdd: (ingredient: IngredientSearchItem) => void;
}

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(n || 0);

export function IngredientSelector({ onAdd }: IngredientSelectorProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const trimmed = search.trim();

  const { data: results = [], isLoading } = useQuery<IngredientSearchItem[]>({
    queryKey: ["ingredient-search", trimmed],
    queryFn: async () => {
      const res = await fetch(`/api/items?search=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        throw new Error("Failed to load ingredients");
      }
      const data = await res.json();
      return data.items ?? [];
    },
    enabled: trimmed.length > 0,
  });

  const suggestMutation = useMutation({
    mutationFn: async (term: string) => {
      const res = await fetch("/api/ingredients/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || "AI suggestion unavailable");
      }
      return res.json() as Promise<{ suggestion: IngredientSuggestion }>;
    },
    onSuccess: (data) => {
      toast({
        title: "AI suggestion ready",
        description: data.suggestion.notes,
      });
    },
    onError: (error: any) => {
      toast({
        title: "AI suggestion failed",
        description: error?.message || "Unable to generate ingredient suggestion.",
        variant: "destructive",
      });
    },
  });

  const suggestion = suggestMutation.data?.suggestion || null;

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => a.name.localeCompare(b.name));
  }, [results]);

  return (
    <Card className="border-slate-200">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-slate-800">Ingredient Selector</CardTitle>
          <Badge variant="secondary">Autocomplete</Badge>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ingredients by name"
          className="text-sm rounded-[4px]"
        />
      </CardHeader>
      <CardContent>
        {trimmed.length === 0 && (
          <div className="text-sm text-slate-500">Start typing to search ingredients.</div>
        )}

        {trimmed.length > 0 && isLoading && (
          <div className="text-sm text-slate-500">Searching ingredients...</div>
        )}

        {trimmed.length > 0 && !isLoading && sortedResults.length > 0 && (
          <div className="grid gap-3">
            {sortedResults.map((ingredient) => {
              const unitCost = ingredient.unitCostPerBase ?? ingredient.unitPrice ?? 0;
              const packCost = ingredient.packCost ?? null;
              return (
                <div
                  key={ingredient.id}
                  className="flex flex-col gap-3 rounded-[10px] border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                      {ingredient.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{ingredient.name}</div>
                      <div className="text-xs text-slate-500">Category: {ingredient.category || "UNMAPPED"}</div>
                      <div className="text-xs text-slate-500">
                        Base unit: {ingredient.baseUnit || ingredient.portionUnit || "UNMAPPED"}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-1 text-xs text-slate-500 sm:text-right">
                    <div>Brand: {ingredient.brand || "UNMAPPED"}</div>
                    <div>SKU: {ingredient.sku || "UNMAPPED"}</div>
                    <div>Pack cost: {packCost !== null ? THB(packCost) : "UNMAPPED"}</div>
                    <div className="font-medium text-slate-800">
                      Unit cost: {THB(unitCost)} / {ingredient.baseUnit || ingredient.portionUnit || "unit"}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="text-xs rounded-[6px]"
                    onClick={() => onAdd(ingredient)}
                  >
                    Add ingredient
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {trimmed.length > 0 && !isLoading && sortedResults.length === 0 && (
          <div className="space-y-3 rounded-[10px] border border-dashed border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-700">No ingredients found.</div>
            <p className="text-xs text-slate-500">
              Use AI to draft a new ingredient entry. Pricing will remain UNMAPPED until a supplier
              price is provided.
            </p>
            <Button
              variant="outline"
              className="text-xs rounded-[6px]"
              onClick={() => suggestMutation.mutate(trimmed)}
              disabled={suggestMutation.isPending}
            >
              {suggestMutation.isPending ? "Generating..." : "AI suggest new ingredient"}
            </Button>
            {suggestion && (
              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <div className="font-semibold">Suggested:</div>
                <div>Name: {suggestion.suggestedName}</div>
                <div>Estimated price: {suggestion.priceEstimateTHB === null ? "UNMAPPED" : THB(suggestion.priceEstimateTHB)}</div>
                <div>Notes: {suggestion.notes}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

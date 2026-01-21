import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Unit } from "@/utils/ingredientAuthority";

type IngredientAuthorityRecord = {
  id: number;
  name: string;
  category: string;
  supplier: string;
  purchaseQuantity: number;
  purchaseUnit: Unit;
  purchaseCostThb: number;
  portionQuantity: number;
  portionUnit: Unit;
  conversionFactor: number | null;
  isActive: boolean;
  updatedAt: string;
  derived: {
    portionsPerPurchase: number;
    costPerPortion: number;
    costPerBaseUnit: number | null;
    baseUnit: Unit;
    conversionNotes: string[];
  } | null;
  validation: {
    valid: boolean;
    errors: string[];
  };
};

type IngredientAuthorityResponse = {
  items: IngredientAuthorityRecord[];
  count: number;
  warning?: string;
};

const formatNumber = (value: number, digits = 2) =>
  value.toLocaleString("en-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function IngredientPurchasingList() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery<IngredientAuthorityResponse>({
    queryKey: ["/api/ingredient-authority"],
    queryFn: () => apiRequest("/api/ingredient-authority"),
  });

  const ingredients = data?.items ?? [];

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Ingredient Purchasing Authority</CardTitle>
            <p className="text-sm text-slate-500">
              {ingredients.length} ingredients
            </p>
          </div>
          <Button asChild>
            <Link to="/operations/ingredient-purchasing/new">New Ingredient</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.warning && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Database unavailable. Showing empty list until a database connection is configured.
            </div>
          )}
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Failed to load ingredients. {error instanceof Error ? error.message : "Unknown error."}
            </div>
          )}

          {isLoading ? (
            <div className="text-sm text-slate-500">Loading ingredients...</div>
          ) : (
            <div className="rounded border border-slate-200 overflow-x-auto">
              <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Cost per Portion</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-slate-500 py-8">
                        No ingredients yet. Add your first ingredient to begin costing.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ingredients.map((ingredient) => {
                      const isInvalid = !ingredient.validation.valid;
                      return (
                        <TableRow
                        key={ingredient.id}
                        className={`border-b cursor-pointer hover:bg-slate-50 ${
                          isInvalid ? "bg-red-50/60" : "bg-white"
                        }`}
                        onClick={() => {
                          navigate(`/operations/ingredient-purchasing/${ingredient.id}`);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            navigate(`/operations/ingredient-purchasing/${ingredient.id}`);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="text-sm font-semibold text-slate-900">{ingredient.name}</div>
                          <div className="text-xs text-slate-500">
                            {ingredient.category || "Uncategorized"} • {ingredient.supplier || "Unspecified"}
                          </div>
                        </TableCell>
                        <TableCell className="text-lg font-semibold text-slate-900">
                          {ingredient.validation.valid && ingredient.derived
                            ? formatNumber(ingredient.derived.costPerPortion, 4)
                            : "—"}
                        </TableCell>
                        <TableCell className="space-y-1">
                          <div className="flex items-center gap-2">
                            {isInvalid && <AlertTriangle className="h-4 w-4 text-red-600" />}
                            <Badge
                              className="text-xs px-3 py-1"
                              variant={ingredient.validation.valid ? "default" : "destructive"}
                            >
                              {ingredient.validation.valid ? "VALID" : "INVALID"}
                            </Badge>
                          </div>
                          {isInvalid && ingredient.validation.errors.length > 0 && (
                            <div className="text-xs text-red-700">
                              {ingredient.validation.errors[0]}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

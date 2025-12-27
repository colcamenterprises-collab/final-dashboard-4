import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  portion: number;
  unit: string;
  cost: number;
}

interface Recipe {
  id: number;
  name: string;
  category: string;
  ingredients: RecipeIngredient[];
  totalCost: string | null;
  costPerServing: string | null;
  yieldQuantity: string | null;
  yieldUnit: string | null;
  updatedAt: string | null;
}

export default function Recipes() {
  const { data, isLoading, error } = useQuery<{ ok: boolean; recipes: Recipe[] }>({
    queryKey: ["/api/recipes"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-4">
        <CardContent className="p-6">
          <p className="text-red-600">Failed to load recipes</p>
        </CardContent>
      </Card>
    );
  }

  const recipes = data?.recipes || [];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB");
    } catch {
      return "-";
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Alert className="border-amber-500 bg-amber-50" data-testid="deprecation-banner">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 font-medium">Read-Only View</AlertTitle>
        <AlertDescription className="text-amber-700">
          Recipe editing has moved to{" "}
          <Link href="/recipe-management" className="underline font-medium hover:text-amber-900">
            Recipe Management
          </Link>.
          This page is deprecated and will be removed.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Recipes (Legacy View)</CardTitle>
          <p className="text-xs text-slate-500">{recipes.length} recipes — read-only</p>
        </CardHeader>
        <CardContent>
          <div className="rounded border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-medium">Menu Item</TableHead>
                  <TableHead className="text-xs font-medium">Category</TableHead>
                  <TableHead className="text-xs font-medium">Ingredients</TableHead>
                  <TableHead className="text-xs font-medium text-right">Total Cost</TableHead>
                  <TableHead className="text-xs font-medium text-right">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((recipe) => (
                  <TableRow key={recipe.id} data-testid={`recipe-row-${recipe.id}`}>
                    <TableCell className="text-xs font-medium">{recipe.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{recipe.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {recipe.ingredients.length > 0 ? (
                        <ul className="list-none space-y-0.5">
                          {recipe.ingredients.slice(0, 5).map((ing, idx) => (
                            <li key={idx} className="text-slate-600">
                              {ing.ingredientName} ({ing.portion} {ing.unit})
                            </li>
                          ))}
                          {recipe.ingredients.length > 5 && (
                            <li className="text-slate-400">+{recipe.ingredients.length - 5} more</li>
                          )}
                        </ul>
                      ) : (
                        <span className="text-slate-400">No ingredients</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {recipe.totalCost ? `฿${parseFloat(recipe.totalCost).toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-right text-slate-500">
                      {formatDate(recipe.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {recipes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-8">
                      No recipes found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

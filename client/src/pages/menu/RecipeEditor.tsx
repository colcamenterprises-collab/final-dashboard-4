/**
 * 🔒 RECIPE BUILDER LOCK
 *
 * Ingredient add/remove is UI-ONLY.
 *
 * During recipe composition:
 * - NO API calls
 * - NO DB writes
 * - NO ingredient mutations
 *
 * Backend interaction occurs ONLY on Save Recipe.
 */
import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";

const DishPreview3D = lazy(() => import("@/components/menu/DishPreview3D"));
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { IngredientSelector, type IngredientSearchItem } from "@/components/menu/IngredientSelector";
import { useDropzone } from "react-dropzone";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(n || 0);

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

type UnitType = "g" | "kg" | "ml" | "l" | "each" | "slice" | "cup";

const PORTION_UNITS: UnitType[] = ["g", "kg", "ml", "l", "each", "slice", "cup"];

type Ingredient = IngredientSearchItem;

type RecipeLine = {
  ingredientId: string;
  name: string;
  qty: number;
  unit: UnitType;
  baseUnit?: UnitType;
  unitCostTHB: number;
  costTHB: number;
  wastePct?: number | null;
  wasteStatus?: string | null;
};

type Recipe = {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  yield_quantity?: number;
  notes?: string | null;
};

type ForecastResponse = {
  recipeId: number;
  coveragePct: number;
  totalCurrentCost: number;
  totalForecastCost: number | null;
  lineForecasts: Array<{
    ingredientId: string;
    ingredientName: string;
    currentCost: number;
    forecastCost: number | null;
    variancePctAvg: number | null;
  }>;
};

type OptimizationResponse = {
  recipeId: number;
  suggestions?: {
    substitutions?: string[];
    marginTweaks?: string[];
    wasteReductions?: string[];
    supplierNotes?: string[];
  };
  raw?: string;
};

const COST_COLORS = ["#0f172a", "#2563eb", "#14b8a6", "#f97316", "#f43f5e", "#9333ea"];

function markdownToHtml(markdown: string) {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
}

export default function RecipeEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const editingId = id ?? null;

  const [recipeName, setRecipeName] = useState("");
  const [recipeCategory, setRecipeCategory] = useState("Burgers");
  const [recipeDescription, setRecipeDescription] = useState("");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [recipeNotFound, setRecipeNotFound] = useState(false);
  const [notes, setNotes] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<OptimizationResponse["suggestions"] | null>(null);
  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [showArPreview, setShowArPreview] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [wasteLookupIndex, setWasteLookupIndex] = useState<number | null>(null);
  const [showAllergens, setShowAllergens] = useState(false);

  const { data: costValidation } = useQuery({
    queryKey: ["recipe-cost-validation", editingId],
    queryFn: async () => {
      const response = await axios.get<{
        recipeId: number;
        isFinal: boolean;
        issues: { ingredientName: string; issue: string }[];
        canBeCost: boolean;
      }>(`/api/recipes/${editingId}/cost-validation`);
      return response.data;
    },
    enabled: Boolean(editingId),
    retry: false,
  });

  const { data: recipeToEdit, isLoading: recipesLoading } = useQuery({
    queryKey: ["recipe", editingId],
    queryFn: async () => {
      const response = await axios.get<Recipe>(`/api/recipes/${editingId}`);
      return response.data;
    },
    enabled: Boolean(editingId),
    retry: false,
    onError: (error: any) => {
      if (error?.response?.status === 404) {
        setRecipeNotFound(true);
      }
    },
  });

  const { data: ingredientLines, isLoading: ingredientsLoading } = useQuery({
    queryKey: ["recipe-ingredients", editingId],
    queryFn: async () => {
      const response = await axios.get<{
        ingredients: Array<{
          ingredient_id: string;
          name: string;
          portion_quantity: number;
          portion_unit: UnitType;
          cost_per_portion: number;
          line_cost: number;
        }>;
      }>(`/api/recipes/${editingId}/ingredients`);
      return response.data.ingredients;
    },
    enabled: Boolean(editingId),
  });

  const { data: forecastData } = useQuery<ForecastResponse>({
    queryKey: ["recipe-forecast", editingId],
    queryFn: async () => {
      const res = await fetch(`/api/recipes/${editingId}/forecast`);
      if (!res.ok) {
        throw new Error("Failed to load forecast");
      }
      return res.json();
    },
    enabled: Boolean(editingId),
  });

  const supplierSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/suppliers/makro/prices");
      if (!res.ok) throw new Error("Supplier sync unavailable");
      return res.json();
    },
  });

  useEffect(() => {
    if (!editingId) return;
    if (recipeToEdit) {
      setRecipeName(recipeToEdit.name || "");
      setRecipeCategory(recipeToEdit.category || "Burgers");
      setRecipeDescription(recipeToEdit.description || "");
      setYieldQuantity(String(recipeToEdit.yield_quantity ?? 1));
      setNotes(recipeToEdit.notes || "");
    }
  }, [editingId, recipeToEdit]);

  useEffect(() => {
    if (!editingId) return;
    if (ingredientLines) {
      setLines(
        ingredientLines.map((line, index) => ({
          ingredientId: line.ingredient_id || `ingredient-${index}`,
          name: line.name || "Unnamed ingredient",
          qty: num(line.portion_quantity),
          unit: line.portion_unit || "g",
          baseUnit: line.portion_unit || "g",
          unitCostTHB: num(line.cost_per_portion),
          costTHB: num(line.line_cost),
          wastePct: null,
          wasteStatus: "INSUFFICIENT_DATA",
        })),
      );
    }
  }, [editingId, ingredientLines]);

  useEffect(() => {
    if (recipeNotFound) {
      navigate("/menu/recipes");
    }
  }, [recipeNotFound, navigate]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;
    setSpeechSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript)
        .filter(Boolean)
        .join(" ");
      if (transcript) {
        setNotes((prev) => `${prev}${prev ? "\n" : ""}${transcript}`);
      }
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  const onDrop = (acceptedFiles: File[]) => {
    const next = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...next]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.preview));
    };
  }, [images]);

  const linesWithCosts = useMemo(() => {
    return lines.map((line) => {
      const qty = num(line.qty);
      const unitCost = num(line.unitCostTHB);
      const wastePct = num(line.wastePct ?? 5);
      const adjustedCost = qty * unitCost * (1 + wastePct / 100);
      return {
        ...line,
        unit: line.unit || line.baseUnit || "g",
        baseUnit: line.baseUnit || line.unit || "g",
        unitCostTHB: unitCost,
        costTHB: Math.round(adjustedCost * 100) / 100,
      };
    });
  }, [lines]);

  const totalCost = useMemo(
    () => linesWithCosts.reduce((sum, line) => sum + num(line.costTHB), 0),
    [linesWithCosts],
  );

  const yieldCount = Math.max(1, num(yieldQuantity));
  const costPerServe = totalCost / yieldCount;
  
  const marginPercentage = useMemo(() => {
    const price = num(sellingPrice);
    if (price <= 0 || totalCost <= 0) return null;
    return ((price - totalCost) / price) * 100;
  }, [sellingPrice, totalCost]);

  const validation = useMemo(() => {
    if (!recipeName.trim()) {
      return { valid: false, reason: "Missing name" };
    }
    if (!recipeCategory.trim()) {
      return { valid: false, reason: "Missing category" };
    }
    if (num(yieldQuantity) <= 0) {
      return { valid: false, reason: "Yield required" };
    }
    if (linesWithCosts.length === 0) {
      return { valid: false, reason: "No ingredients" };
    }
    const hasMissingQty = linesWithCosts.some((line) => num(line.qty) <= 0);
    if (hasMissingQty) {
      return { valid: false, reason: "Ingredient quantity required" };
    }
    return { valid: true, reason: "Ready" };
  }, [recipeName, recipeCategory, yieldQuantity, linesWithCosts]);

  const costBreakdownData = useMemo(() => {
    return linesWithCosts.map((line) => ({ name: line.name, value: num(line.costTHB) }));
  }, [linesWithCosts]);

  const forecastSeries = useMemo(() => {
    if (!forecastData) return [];
    return [
      { label: "Current", cost: forecastData.totalCurrentCost },
      { label: "Forecast", cost: forecastData.totalForecastCost ?? undefined },
    ];
  }, [forecastData]);

  const wasteAverage = useMemo(() => {
    const values = linesWithCosts
      .map((line) => line.wastePct)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [linesWithCosts]);

  const reloadIngredients = async () => {
    if (!editingId) return;
    await queryClient.invalidateQueries({ queryKey: ["recipe-ingredients", editingId] });
  };

  const fetchVarianceHistory = async (ingredientId: string): Promise<number | null> => {
    try {
      const response = await fetch(`/api/items/${ingredientId}/variance-history`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.avgWastePct ?? null;
    } catch {
      return null;
    }
  };

  const addIngredient = async (ingredient: Ingredient) => {
    const isDuplicate = lines.some(
      (line) => line.ingredientId === String(ingredient.id) || line.name === ingredient.name
    );
    if (isDuplicate) {
      toast({ title: "Already added", description: `${ingredient.name} is already in the recipe.`, variant: "destructive" });
      return;
    }

    const unit = (ingredient.baseUnit || ingredient.portionUnit || "each") as UnitType;
    const unitCost = num(ingredient.unitCostPerBase);
    
    const varianceWaste = await fetchVarianceHistory(String(ingredient.id));
    
    const newLine: RecipeLine = {
      ingredientId: String(ingredient.id),
      name: ingredient.name,
      qty: 1,
      unit: unit,
      baseUnit: unit,
      unitCostTHB: unitCost,
      costTHB: unitCost,
      wastePct: varianceWaste ?? 5,
      wasteStatus: varianceWaste !== null ? "VARIANCE_BASED" : "DEFAULT",
    };
    setLines((prev) => [...prev, newLine]);
    
    if (varianceWaste !== null) {
      toast({ 
        title: "Waste % set from history", 
        description: `${ingredient.name}: ${varianceWaste.toFixed(1)}% based on 7-day variance` 
      });
    }
  };

  const updateLineQty = (index: number, value: string) => {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === index
          ? {
              ...line,
              qty: num(value),
            }
          : line,
      ),
    );
  };

  const updateLineUnit = (index: number, unit: UnitType) => {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === index ? { ...line, unit } : line,
      ),
    );
  };

  const updateLineWaste = (index: number, value: number) => {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === index ? { ...line, wastePct: value } : line,
      ),
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const fetchWasteSuggestion = async (index: number) => {
    const line = lines[index];
    if (!line) return;
    setWasteLookupIndex(index);
    try {
      const res = await fetch(`/api/items/${line.ingredientId}/waste-history`);
      if (!res.ok) {
        throw new Error("Waste history unavailable");
      }
      const data = await res.json();
      const suggested = typeof data.suggestedWastePct === "number" ? data.suggestedWastePct : null;
      setLines((prev) =>
        prev.map((entry, idx) =>
          idx === index
            ? {
                ...entry,
                wastePct: suggested ?? entry.wastePct,
                wasteStatus: suggested === null ? "INSUFFICIENT_DATA" : "HISTORICAL_DATA",
              }
            : entry,
        ),
      );
    } catch (error: any) {
      toast({
        title: "Waste history unavailable",
        description: error?.message || "Unable to load waste history.",
        variant: "destructive",
      });
    } finally {
      setWasteLookupIndex(null);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        recipeName: recipeName.trim(),
        description: recipeDescription || "",
        category: recipeCategory,
        lines: linesWithCosts,
        totals: {
          recipeCostTHB: totalCost,
          costPerPortionTHB: costPerServe,
        },
        portions: num(yieldQuantity) || 1,
        note: notes,
        wastePct: wasteAverage,
      };

      const response = await fetch("/api/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.details || result?.error || "Failed to save recipe");
      }

      return result;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast({ title: "Recipe saved", description: "Your recipe changes have been saved." });
      
      if (linesWithCosts.length > 0) {
        try {
          const ingredientsForLine = linesWithCosts.map(line => ({
            name: line.name,
            qty: line.qty,
            unit: line.unit,
            wasteAdj: line.qty * (1 + (line.wastePct || 5) / 100)
          }));
          
          const lineRes = await fetch("/api/line/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipeName: recipeName.trim(),
              ingredients: ingredientsForLine
            })
          });
          
          const lineResult = await lineRes.json();
          if (lineResult.mock) {
            console.log("Sent to Line:", ingredientsForLine);
          }
        } catch (lineError) {
          console.log("Line notification skipped:", lineError);
        }
      }
      
      if (aiSuggestions) {
        toast({
          title: "AI suggestions available",
          description: "Review optimizer notes in the AI panel before final approval.",
        });
      }
      navigate("/menu/recipes");
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error?.message || "Unable to save the recipe.",
        variant: "destructive",
      });
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) {
        throw new Error("Save the recipe first to unlock AI optimization.");
      }
      const response = await fetch(`/api/recipes/${editingId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMarginPct: 10 }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error?.error || "Optimization failed");
      }
      return response.json() as Promise<OptimizationResponse>;
    },
    onSuccess: (data) => {
      setAiSuggestions(data.suggestions || null);
      toast({
        title: "AI optimizer ready",
        description: "Review suggested substitutions and margin tweaks.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "AI optimizer failed",
        description: error?.message || "Unable to generate AI suggestions.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Missing recipe id");
      const response = await fetch(`/api/recipes/${editingId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete recipe");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast({ title: "Recipe deleted", description: "The recipe was removed." });
      navigate("/menu/recipes");
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Unable to delete the recipe.",
        variant: "destructive",
      });
    },
  });

  if (ingredientsLoading || (recipesLoading && editingId)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading recipe editor...</div>
      </div>
    );
  }

  if (editingId && recipeNotFound) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="text-lg text-slate-700">Recipe not found.</div>
          <Button asChild variant="outline" className="text-xs rounded-[4px]">
            <Link to="/menu/recipes">Back to recipe list</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 sm:px-8 py-6" style={{ fontFamily: "Poppins, sans-serif" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {editingId ? "Edit Recipe" : "New Recipe"}
            </h1>
            <p className="text-sm text-slate-600">
              Build AI-assisted recipes with predictive costs, supplier context, and 3D previews.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="text-xs rounded-[6px]"
              onClick={() => optimizeMutation.mutate()}
              disabled={!editingId || optimizeMutation.isPending}
            >
              {optimizeMutation.isPending ? "Optimizing..." : "AI Optimize Margin"}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[6px]"
              onClick={() => saveMutation.mutate()}
              disabled={!validation.valid || saveMutation.isLoading}
            >
              {editingId ? "Save & Approve" : "Save Recipe"}
            </Button>
          </div>
        </div>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Recipe Meta</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Name</label>
              <Input
                value={recipeName}
                onChange={(event) => setRecipeName(event.target.value)}
                placeholder="Recipe name"
                className="text-sm rounded-[4px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Category</label>
              <Select value={recipeCategory} onValueChange={setRecipeCategory}>
                <SelectTrigger className="rounded-[4px] text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Burgers">Burgers</SelectItem>
                  <SelectItem value="Side Orders">Side Orders</SelectItem>
                  <SelectItem value="Sauce">Sauce</SelectItem>
                  <SelectItem value="Beverages">Beverages</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <Textarea
                value={recipeDescription}
                onChange={(event) => setRecipeDescription(event.target.value)}
                placeholder="Short description or preparation notes"
                className="rounded-[4px] text-sm"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Yield / Serves</label>
                <Input
                  value={yieldQuantity}
                  onChange={(event) => setYieldQuantity(event.target.value)}
                  placeholder="Yield quantity"
                  className="text-sm rounded-[4px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Selling Price (THB)</label>
                <Input
                  value={sellingPrice}
                  onChange={(event) => setSellingPrice(event.target.value)}
                  placeholder="e.g. 189"
                  type="number"
                  min="0"
                  step="1"
                  className="text-sm rounded-[4px]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">AI Readiness</label>
              <div className="flex items-center gap-2">
                <Badge
                  variant={validation.valid ? "default" : "secondary"}
                  className={validation.valid ? "bg-emerald-600" : "bg-amber-100 text-amber-800"}
                >
                  {validation.valid ? "READY" : "INCOMPLETE"}
                </Badge>
                <span className="text-xs text-slate-500">{validation.reason}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="ingredients" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
            <TabsTrigger value="costs">Cost Calc</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>

          <TabsContent value="ingredients" className="space-y-6">
            <IngredientSelector onAdd={addIngredient} />

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Ingredients Table</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {linesWithCosts.map((line, index) => {
                  const conversionRequired = line.unit !== line.baseUnit;
                  const formatUnitCost = (cost: number) =>
                    cost < 0.01 ? cost.toFixed(4) : cost < 1 ? cost.toFixed(3) : cost.toFixed(2);
                  return (
                    <div
                      key={`${line.ingredientId}-${index}`}
                      className="border border-slate-100 rounded-[10px] p-4 space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:items-center">
                        <div>
                          <div className="text-xs text-slate-500">Ingredient</div>
                          <div className="text-sm font-medium text-slate-900">{line.name}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Quantity</div>
                          <Input
                            value={line.qty}
                            onChange={(event) => updateLineQty(index, event.target.value)}
                            className="text-sm rounded-[4px]"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Unit</div>
                          <Select value={line.unit} onValueChange={(value) => updateLineUnit(index, value as UnitType)}>
                            <SelectTrigger className="text-sm rounded-[4px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PORTION_UNITS.map((unit) => (
                                <SelectItem key={unit} value={unit}>
                                  {unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Conversion</div>
                          <div className="text-sm text-slate-700">
                            {conversionRequired ? "Conversion required" : "Aligned"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Line cost</div>
                          <div className="text-sm font-medium text-slate-900">{THB(line.costTHB)}</div>
                        </div>
                        <div className="flex justify-start md:justify-end">
                          <Button
                            variant="outline"
                            className="text-xs rounded-[4px] border-rose-200 text-rose-600 hover:text-rose-700"
                            onClick={() => removeLine(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                        <div className="text-[11px] text-slate-500 space-y-1">
                          <div>Base cost: ฿{formatUnitCost(line.unitCostTHB)} per {line.baseUnit}</div>
                          <div>Quantity used: {line.qty} {line.unit}</div>
                          <div className="text-emerald-600 font-medium">Line cost: {THB(line.costTHB)}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-slate-700">AI Waste Suggestion</div>
                            <Badge variant="secondary" className="text-[10px]">
                              {line.wasteStatus || "INSUFFICIENT_DATA"}
                            </Badge>
                          </div>
                          <Slider
                            value={[line.wastePct ?? 0]}
                            max={25}
                            step={0.5}
                            onValueChange={(value) => updateLineWaste(index, value[0] ?? 0)}
                          />
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Waste %: {line.wastePct ?? 0}%</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px]"
                              onClick={() => fetchWasteSuggestion(index)}
                              disabled={wasteLookupIndex === index}
                            >
                              {wasteLookupIndex === index ? "Loading..." : "Load history"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {linesWithCosts.length === 0 && (
                  <div className="text-sm text-slate-500">Add ingredients to begin costing.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">AI Optimizer Output</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                {!aiSuggestions && (
                  <div className="text-sm text-slate-500">Run AI Optimize Margin to see suggestions.</div>
                )}
                {aiSuggestions && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-600">Substitutions</div>
                      <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                        {(aiSuggestions.substitutions || ["INSUFFICIENT_DATA"]).map((item, idx) => (
                          <li key={`sub-${idx}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-600">Margin Tweaks</div>
                      <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                        {(aiSuggestions.marginTweaks || ["INSUFFICIENT_DATA"]).map((item, idx) => (
                          <li key={`margin-${idx}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-600">Waste Reduction</div>
                      <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                        {(aiSuggestions.wasteReductions || ["INSUFFICIENT_DATA"]).map((item, idx) => (
                          <li key={`waste-${idx}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-600">Supplier Notes</div>
                      <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                        {(aiSuggestions.supplierNotes || ["INSUFFICIENT_DATA"]).map((item, idx) => (
                          <li key={`supplier-${idx}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Cost Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs text-slate-500">Total recipe cost</div>
                  <div className="text-2xl font-semibold text-slate-900">{THB(totalCost)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Cost per serve</div>
                  <div className="text-2xl font-semibold text-slate-900">{THB(costPerServe)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Waste guidance</div>
                  <div className="text-2xl font-semibold text-slate-900">
                    {wasteAverage === null ? "UNMAPPED" : `${wasteAverage.toFixed(1)}%`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Margin %</div>
                  <div className={`text-2xl font-semibold ${marginPercentage !== null && marginPercentage >= 60 ? 'text-emerald-600' : marginPercentage !== null && marginPercentage >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {marginPercentage === null ? "Set price" : `${marginPercentage.toFixed(1)}%`}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800">Cost Breakdown Table</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Ingredient</TableHead>
                          <TableHead className="text-xs text-right">Qty</TableHead>
                          <TableHead className="text-xs">Unit</TableHead>
                          <TableHead className="text-xs text-right">Line Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linesWithCosts.map((line, idx) => (
                          <TableRow key={`${line.ingredientId}-${idx}`}>
                            <TableCell className="text-xs font-medium">{line.name}</TableCell>
                            <TableCell className="text-xs text-right">{line.qty}</TableCell>
                            <TableCell className="text-xs">{line.unit}</TableCell>
                            <TableCell className="text-xs text-right">{THB(line.costTHB)}</TableCell>
                          </TableRow>
                        ))}
                        {linesWithCosts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-xs text-slate-400 text-center py-6">
                              No ingredients available.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800">Ingredient Cost Mix</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  {costBreakdownData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={costBreakdownData} dataKey="value" nameKey="name" outerRadius={90}>
                          {costBreakdownData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COST_COLORS[index % COST_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      Add ingredients to visualize cost mix.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Predictive Forecast</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!forecastData && (
                  <div className="text-sm text-slate-500">
                    Forecast requires saved recipes and historical variance data.
                  </div>
                )}
                {forecastData && (
                  <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
                    <div className="h-56">
                      {forecastData.totalForecastCost === null ? (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">
                          Insufficient data to forecast full recipe cost.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={forecastSeries}>
                            <XAxis dataKey="label" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="cost" stroke="#2563eb" strokeWidth={3} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div>Coverage: {forecastData.coveragePct.toFixed(0)}%</div>
                      <div>Current cost: {THB(forecastData.totalCurrentCost)}</div>
                      <div>
                        Forecast cost: {forecastData.totalForecastCost === null ? "UNMAPPED" : THB(forecastData.totalForecastCost)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Forecast uses analysis worker variance reports. Missing variance rows are flagged as insufficient data.
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Supplier Auto-Pull</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-600">
                  Makro integration returns live pricing when configured. Current status:
                  <span className="ml-2 font-semibold text-slate-800">
                    {supplierSyncMutation.data?.status || "UNAVAILABLE"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="text-xs rounded-[6px]"
                  onClick={() => supplierSyncMutation.mutate()}
                >
                  {supplierSyncMutation.isPending ? "Checking..." : "Sync Makro Prices"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Recipe Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Write prep notes with markdown support"
                  className="min-h-[160px] rounded-[4px] text-sm"
                />
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="text-xs rounded-[6px]"
                    onClick={() => {
                      if (!speechSupported || !recognitionRef.current) {
                        toast({
                          title: "Voice notes unavailable",
                          description: "Web Speech API is not supported in this browser.",
                          variant: "destructive",
                        });
                        return;
                      }
                      recognitionRef.current.start();
                      setIsListening(true);
                    }}
                    disabled={isListening}
                  >
                    {isListening ? "Listening..." : "Start voice notes"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-xs rounded-[6px]"
                    onClick={() => {
                      recognitionRef.current?.stop();
                      setIsListening(false);
                    }}
                    disabled={!isListening}
                  >
                    Stop
                  </Button>
                  {!speechSupported && (
                    <span className="text-xs text-slate-500">Voice dictation not supported.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Markdown Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-[10px] border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(notes || "No notes available.") }}
                />
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Nutrition Badges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {["Gluten", "Dairy", "Soy", "Egg", "Sesame", "Shellfish"].map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs">
                      {item}: UNMAPPED
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Allergen mapping is currently unavailable.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px]"
                    onClick={() => setShowAllergens((prev) => !prev)}
                  >
                    {showAllergens ? "Collapse" : "Expand"}
                  </Button>
                </div>
                {showAllergens && (
                  <div className="rounded-[8px] border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    Add allergen metadata to ingredients to enable nutrition analytics, warnings, and label exports.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images" className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Recipe Images</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  {...getRootProps()}
                  className={`rounded-[10px] border border-dashed p-6 text-center text-sm ${
                    isDragActive ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="text-slate-600">
                    {isDragActive ? "Drop images here" : "Drag and drop images, or click to upload"}
                  </div>
                </div>
                {images.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {images.map((image, idx) => (
                      <div key={`${image.preview}-${idx}`} className="rounded-[10px] border border-slate-100 p-2">
                        <img src={image.preview} alt={image.file.name} className="h-32 w-full rounded-[8px] object-cover" />
                        <div className="mt-2 text-xs text-slate-500 truncate">{image.file.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800">3D Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<div className="h-[200px] flex items-center justify-center bg-slate-100 rounded-lg text-sm text-slate-500">Loading 3D...</div>}>
                    <DishPreview3D 
                      modelUrl={images.length > 0 ? "uploaded.glb" : undefined}
                      className="h-[200px]"
                    />
                  </Suspense>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-800">AR Preview</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Enable</span>
                    <Switch checked={showArPreview} onCheckedChange={setShowArPreview} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-[12px] border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    AR preview feature coming soon.
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {costValidation && costValidation.isFinal && costValidation.issues.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-amber-800 flex items-center gap-2">
                Recipe cannot be costed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-amber-700">
                This recipe is marked as Final but has ingredients with missing base unit cost data.
                Analytics will not include this recipe until all ingredient costs are resolved.
              </p>
              <div className="bg-white rounded-[4px] p-3 border border-amber-200">
                <div className="text-xs font-medium text-amber-800 mb-2">Missing cost data:</div>
                <ul className="space-y-1">
                  {costValidation.issues.map((issue, idx) => (
                    <li key={idx} className="text-xs text-amber-700">
                      <span className="font-medium">{issue.ingredientName}</span>: {issue.issue}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className="text-xs rounded-[4px]">
                <Link to="/menu/recipes">Back to recipe list</Link>
              </Button>
              {editingId && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-xs rounded-[4px] border-rose-200 text-rose-600 hover:text-rose-700"
                    >
                      Delete recipe
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
                        onClick={() => deleteMutation.mutate()}
                      >
                        Delete recipe
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="text-xs rounded-[6px]"
                onClick={reloadIngredients}
                disabled={!editingId}
              >
                Refresh Ingredients
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-[4px]"
                onClick={() => saveMutation.mutate()}
                disabled={!validation.valid || saveMutation.isLoading}
              >
                {editingId ? "Save & Approve" : "Save recipe"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

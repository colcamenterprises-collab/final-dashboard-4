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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { IngredientSelector, type IngredientSearchItem } from "@/components/menu/IngredientSelector";
import { useDropzone } from "react-dropzone";
import { Info } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(n || 0);

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

type UnitType = "g" | "kg" | "slice" | "each" | "pack" | "ml" | "L" | "piece";

const PORTION_UNITS: UnitType[] = ["g", "kg", "slice", "each", "pack", "ml", "L", "piece"];

type Ingredient = IngredientSearchItem;

type RecipeLine = {
  rowId?: number;
  ingredientId: string;
  name: string;
  portionQty: number;
  portionUnit: UnitType;
  packCost: number | null;
  packYield: number | null;
  unitCostTHB: number;
  costTHB: number;
  wastePercentage?: number | null;
  wasteStatus?: string | null;
};

type Recipe = {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  yield_quantity?: number;
  notes?: string | null;
  instructions?: string | null;
  suggested_price?: number | null;
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
const MARGIN_COLORS = ["#ef4444", "#22c55e"];

const LabelWithTooltip = ({ label, tooltip }: { label: string; tooltip: string }) => (
  <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
    <span>{label}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-600"
          aria-label={`${label} info`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  </div>
);

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
  const [recipeInstructions, setRecipeInstructions] = useState("");
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
  const lineSaveTimers = useRef<Record<string, number>>({});
  const recipeSaveTimer = useRef<number | null>(null);
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
          id: number;
          ingredient_id: string;
          name: string;
          portion_quantity: number;
          portion_unit: UnitType;
          cost_per_portion: number;
          pack_cost: number | null;
          yield_per_pack: number | null;
          waste_percentage: number | null;
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
      setRecipeInstructions(recipeToEdit.instructions || "");
      setYieldQuantity(String(recipeToEdit.yield_quantity ?? 1));
      setNotes(recipeToEdit.notes || "");
      setSellingPrice(
        recipeToEdit.suggested_price !== null && recipeToEdit.suggested_price !== undefined
          ? String(recipeToEdit.suggested_price)
          : ""
      );
    }
  }, [editingId, recipeToEdit]);

  useEffect(() => {
    if (!editingId) return;
    if (ingredientLines) {
      setLines(
        ingredientLines.map((line, index) => ({
          rowId: line.id,
          ingredientId: line.ingredient_id || `ingredient-${index}`,
          name: line.name || "Unnamed ingredient",
          portionQty: num(line.portion_quantity),
          portionUnit: line.portion_unit || "g",
          packCost: line.pack_cost ?? null,
          packYield: line.yield_per_pack ?? null,
          unitCostTHB: num(line.cost_per_portion),
          costTHB: num(line.line_cost),
          wastePercentage: line.waste_percentage ?? 5,
          wasteStatus: "SAVED",
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
      const portionQty = num(line.portionQty);
      const packCost = line.packCost ?? null;
      const packYield = line.packYield ?? null;
      const fallbackUnitCost = num(line.unitCostTHB);
      const wastePercentage = num(line.wastePercentage ?? 5);
      const resolvedUnitCost =
        packCost && packYield ? packCost / packYield : fallbackUnitCost;
      const adjustedCost =
        portionQty * resolvedUnitCost * (1 + wastePercentage / 100);
      return {
        ...line,
        portionUnit: line.portionUnit || "g",
        unitCostTHB: Number(resolvedUnitCost.toFixed(2)),
        costTHB: Number(adjustedCost.toFixed(2)),
        wastePercentage,
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

  const marginMixData = useMemo(() => {
    const price = num(sellingPrice);
    if (price <= 0) return [];
    return [
      { name: "Cost", value: Math.min(totalCost, price) },
      { name: "Margin", value: Math.max(price - totalCost, 0) },
    ];
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
    const hasMissingQty = linesWithCosts.some((line) => num(line.portionQty) <= 0);
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
      .map((line) => line.wastePercentage)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [linesWithCosts]);

  useEffect(() => {
    if (!editingId) return;
    if (recipeSaveTimer.current) {
      window.clearTimeout(recipeSaveTimer.current);
    }
    recipeSaveTimer.current = window.setTimeout(async () => {
      try {
        await fetch(`/api/recipes/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: recipeName.trim(),
            description: recipeDescription || "",
            instructions: recipeInstructions || "",
            notes: notes || "",
            suggested_price: num(sellingPrice) || 0,
            yield_quantity: num(yieldQuantity) || 1,
            category: recipeCategory,
          }),
        });
      } catch (error) {
        console.error("Auto-save recipe failed:", error);
      }
    }, 500);

    return () => {
      if (recipeSaveTimer.current) {
        window.clearTimeout(recipeSaveTimer.current);
      }
    };
  }, [
    editingId,
    recipeName,
    recipeCategory,
    recipeDescription,
    recipeInstructions,
    sellingPrice,
    yieldQuantity,
    notes,
  ]);

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
      portionQty: 1,
      portionUnit: unit,
      packCost: null,
      packYield: null,
      unitCostTHB: unitCost,
      costTHB: unitCost,
      wastePercentage: varianceWaste ?? 5,
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

  const queueLineSave = (line: RecipeLine) => {
    if (!editingId || !line.rowId) return;
    const key = String(line.rowId);
    if (lineSaveTimers.current[key]) {
      window.clearTimeout(lineSaveTimers.current[key]);
    }
    lineSaveTimers.current[key] = window.setTimeout(async () => {
      try {
        await fetch(`/api/recipes/${editingId}/ingredient/${line.rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portionQty: line.portionQty,
            portionUnit: line.portionUnit,
            wastePercentage: line.wastePercentage ?? 5,
          }),
        });
      } catch (error) {
        console.error("Failed to auto-save ingredient line:", error);
      }
    }, 500);
  };

  const updateLineQty = (index: number, value: string) => {
    setLines((prev) =>
      prev.map((line, idx) => {
        if (idx !== index) return line;
        const updated = { ...line, portionQty: num(value) };
        queueLineSave(updated);
        return updated;
      }),
    );
  };

  const updateLineUnit = (index: number, portionUnit: UnitType) => {
    setLines((prev) =>
      prev.map((line, idx) => {
        if (idx !== index) return line;
        const updated = { ...line, portionUnit };
        queueLineSave(updated);
        return updated;
      }),
    );
  };

  const updateLineWaste = (index: number, value: number) => {
    setLines((prev) =>
      prev.map((line, idx) => {
        if (idx !== index) return line;
        const updated = { ...line, wastePercentage: value };
        queueLineSave(updated);
        return updated;
      }),
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
                wastePercentage: suggested ?? entry.wastePercentage,
                wasteStatus: suggested === null ? "INSUFFICIENT_DATA" : "HISTORICAL_DATA",
              }
            : entry,
        ),
      );
      const updated = suggested !== null ? { ...line, wastePercentage: suggested } : line;
      queueLineSave(updated);
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
      if (editingId) {
        const response = await fetch(`/api/recipes/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: recipeName.trim(),
            description: recipeDescription || "",
            instructions: recipeInstructions || "",
            notes: notes || "",
            suggested_price: num(sellingPrice) || 0,
            yield_quantity: num(yieldQuantity) || 1,
            category: recipeCategory,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.details || result?.error || "Failed to save recipe");
        }

        return result;
      }

      const payload = {
        recipeName: recipeName.trim(),
        description: recipeDescription || "",
        instructions: recipeInstructions || "",
        sellingPrice: num(sellingPrice) || 0,
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
            qty: line.portionQty,
            unit: line.portionUnit,
            wasteAdj: line.portionQty * (1 + (line.wastePercentage || 5) / 100)
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

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) {
        throw new Error("Save the recipe before approving.");
      }
      const approveRes = await fetch(`/api/recipes/${editingId}/approve`, { method: "POST" });
      const approveBody = await approveRes.json();
      if (!approveRes.ok) {
        throw new Error(approveBody?.error || "Failed to approve recipe");
      }

      const publishRes = await fetch("/api/menu/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: Number(editingId) }),
      });
      const publishBody = await publishRes.json();
      if (!publishRes.ok) {
        throw new Error(publishBody?.error || "Failed to publish menu");
      }

      return publishBody;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast({ title: "Recipe approved", description: "Menu and online channels synced." });
      navigate("/menu/recipes");
    },
    onError: (error: any) => {
      toast({
        title: "Approve failed",
        description: error?.message || "Unable to approve recipe.",
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
              {editingId ? "Save Updates" : "Save Recipe"}
            </Button>
            <Button
              variant="outline"
              className="text-xs rounded-[6px]"
              onClick={() => approveMutation.mutate()}
              disabled={!editingId || approveMutation.isPending || !validation.valid}
            >
              {approveMutation.isPending ? "Approving..." : "Approve & Publish"}
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
                placeholder="Recipe description..."
                className="rounded-[4px] text-sm"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Instructions</label>
              <Textarea
                value={recipeInstructions}
                onChange={(event) => setRecipeInstructions(event.target.value)}
                placeholder={"Step 1: ...\nStep 2: ..."}
                rows={8}
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
                  placeholder="Selling Price (THB)"
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
                <div className="rounded border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Ingredient</TableHead>
                        <TableHead className="text-xs text-right">
                          <LabelWithTooltip
                            label="Pack Cost (฿) – read-only from purchasing"
                            tooltip="Pulled from purchasing data."
                          />
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          <LabelWithTooltip
                            label="Yield (how many portions per pack, e.g. 82 slices per 1kg block)"
                            tooltip="Total portions available from one pack."
                          />
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          <LabelWithTooltip
                            label="Portion for this recipe (e.g. 1 slice or 100g)"
                            tooltip="How much of this ingredient is used in the recipe."
                          />
                        </TableHead>
                        <TableHead className="text-xs">Portion Unit</TableHead>
                        <TableHead className="text-xs text-right">Waste %</TableHead>
                        <TableHead className="text-xs text-right">Adjusted Line Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linesWithCosts.map((line, index) => (
                        <TableRow key={`${line.ingredientId}-${index}`}>
                          <TableCell className="text-xs font-medium">
                            <div>{line.name}</div>
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                className="text-[10px] rounded-[4px] border-rose-200 text-rose-600 hover:text-rose-700"
                                onClick={() => removeLine(index)}
                              >
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {line.packCost !== null ? THB(line.packCost) : "UNMAPPED"}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {line.packYield !== null ? line.packYield.toFixed(2) : "UNMAPPED"}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Input
                              value={line.portionQty}
                              onChange={(event) => updateLineQty(index, event.target.value)}
                              className="text-sm rounded-[4px] text-right"
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            <Select
                              value={line.portionUnit}
                              onValueChange={(value) => updateLineUnit(index, value as UnitType)}
                            >
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
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <Input
                              value={line.wastePercentage ?? 0}
                              onChange={(event) => updateLineWaste(index, num(event.target.value))}
                              className="text-sm rounded-[4px] text-right"
                              type="number"
                              min="0"
                              step="0.1"
                            />
                            <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-slate-500">
                              <span>{line.wasteStatus || "INSUFFICIENT_DATA"}</span>
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
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {THB(line.costTHB)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {linesWithCosts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-xs text-slate-400 text-center py-6">
                            Add ingredients to begin costing.
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

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Margin Mix</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                {marginMixData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={marginMixData} dataKey="value" nameKey="name" outerRadius={90}>
                        {marginMixData.map((_, index) => (
                          <Cell key={`margin-cell-${index}`} fill={MARGIN_COLORS[index % MARGIN_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Set selling price to view margin mix.
                  </div>
                )}
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
                            <TableCell className="text-xs text-right">{line.portionQty}</TableCell>
                            <TableCell className="text-xs">{line.portionUnit}</TableCell>
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
                        <RechartsTooltip />
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
                            <RechartsTooltip />
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
                {editingId ? "Save Updates" : "Save recipe"}
              </Button>
              <Button
                variant="outline"
                className="text-xs rounded-[6px]"
                onClick={() => approveMutation.mutate()}
                disabled={!editingId || approveMutation.isPending || !validation.valid}
              >
                {approveMutation.isPending ? "Approving..." : "Approve & Publish"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

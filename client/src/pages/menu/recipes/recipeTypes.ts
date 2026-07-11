export type RecipeStatus = "Draft" | "Live" | "Archived";

export type RecipeIngredientRow = {
  id: string;
  name: string;
  quantity: number | string;
  unit: string;
  unitCost: number | string;
  lineCost?: number;
  notes?: string;
};

export type RecipeStep = {
  id: string;
  title: string;
  instruction: string;
  timerMinutes: number | string;
  imageUrl?: string | null;
};

export type Recipe = {
  id: number;
  name: string;
  category: string;
  description?: string | null;
  imageUrl?: string | null;
  yieldQuantity: number | string;
  yieldUnit: string;
  prepTimeMinutes?: number | string;
  cookTimeMinutes?: number | string;
  difficulty?: string;
  ingredients: RecipeIngredientRow[];
  steps: RecipeStep[];
  notes?: string | null;
  totalCost?: number | string;
  costPerServing?: number | string;
  sellingPrice?: number | string | null;
  suggestedPrice?: number | string | null;
  foodCostPercent?: number | string | null;
  deliveryFoodCostPercent?: number | string | null;
  status: RecipeStatus;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type RecipeFormState = Omit<Recipe, "id" | "totalCost" | "costPerServing" | "foodCostPercent" | "deliveryFoodCostPercent" | "createdAt" | "updatedAt"> & {
  sellingPrice: string;
  suggestedPrice: string;
};

export const VALID_UNITS = ["g", "kg", "ml", "L", "Each", "Slice", "pcs", "tbsp", "tsp", "cup", "pack"] as const;

export function createClientId(prefix = "row") {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function makeIngredient(): RecipeIngredientRow {
  return { id: createClientId("ingredient"), name: "", quantity: "", unit: "g", unitCost: "", notes: "" };
}

export function makeStep(index = 0): RecipeStep {
  return { id: createClientId("step"), title: `Step ${index + 1}`, instruction: "", timerMinutes: "", imageUrl: null };
}

export function emptyRecipeForm(): RecipeFormState {
  return {
    name: "",
    category: "Burger",
    description: "",
    imageUrl: "",
    yieldQuantity: 1,
    yieldUnit: "serving",
    prepTimeMinutes: 0,
    cookTimeMinutes: 0,
    difficulty: "Standard",
    ingredients: [makeIngredient()],
    steps: [makeStep(0)],
    notes: "",
    sellingPrice: "",
    suggestedPrice: "",
    status: "Draft",
    version: 1,
  };
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fmtMoney(value: unknown) {
  const n = toNumber(value);
  return n === null ? "—" : `฿${n.toFixed(2)}`;
}

export function fmtPercent(value: unknown) {
  const n = toNumber(value);
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

export function calculateRecipe(ingredients: RecipeIngredientRow[], yieldQuantity: unknown, sellingPrice: unknown, deliveryPrice: unknown) {
  const totalCost = ingredients.reduce((sum, row) => {
    const qty = Math.max(0, toNumber(row.quantity) ?? 0);
    const unitCost = Math.max(0, toNumber(row.unitCost) ?? 0);
    return sum + qty * unitCost;
  }, 0);
  const yieldQty = Math.max(0.0001, toNumber(yieldQuantity) ?? 1);
  const costPerServing = totalCost / yieldQty;
  const direct = toNumber(sellingPrice);
  const delivery = toNumber(deliveryPrice);
  return {
    totalCost,
    costPerServing,
    foodCostPercent: direct && direct > 0 ? (costPerServing / direct) * 100 : null,
    deliveryFoodCostPercent: delivery && delivery > 0 ? (costPerServing / delivery) * 100 : null,
    directGrossProfit: direct !== null ? direct - costPerServing : null,
    deliveryGrossProfit: delivery !== null ? delivery - costPerServing : null,
    recommendedRestaurantPrice: Math.ceil(costPerServing / 0.3),
    recommendedDeliveryPrice: Math.ceil(costPerServing / 0.25),
  };
}

export function parseStatus(recipe: Recipe | null | undefined): RecipeStatus {
  return recipe?.status ?? "Draft";
}

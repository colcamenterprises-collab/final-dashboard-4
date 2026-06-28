export type RecipeStatus = "Draft" | "Live" | "Archived";

export type MenuCategory = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder?: number | null;
  displayOrder?: number | null;
  isActive?: boolean;
  onlineEnabled?: boolean;
  visibleOnline?: boolean;
};

export type PurchasingLine = {
  fieldKey?: string;
  id?: string | number;
  item?: string;
  name?: string;
  category?: string | null;
  supplier?: string | null;
  supplierName?: string | null;
  unitDescription?: string | null;
  purchaseUnit?: string | null;
  orderUnit?: string | null;
  purchaseUnitLabel?: string | null;
  unitCost?: number | string | null;
  packCost?: number | string | null;
  manualOverrideUnitCost?: number | string | null;
  lineTotal?: number | string | null;
  quantity?: number | string | null;
  purchaseUnitQty?: number | string | null;
  active?: boolean;
  isActive?: boolean;
};

export type RecipeIngredientRow = {
  id: string;
  name: string;
  sourceType: "purchasing" | "manual";
  purchasingItemId: number | null;
  purchasingItemKey: string;
  quantityUsed: string;
  unitUsed: string;
  autoUnitCost: number | null;
  costingStatus: string | null;
  manualOverrideUnitCost: string;
  notes: string;
};

export type Recipe = {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  yieldQuantity?: string | number;
  yieldUnit?: string;
  totalCost?: string | number | null;
  costPerServing?: string | number | null;
  suggestedPrice?: string | number | null;
  sellingPrice?: string | number | null;
  imageUrl?: string | null;
  instructions?: string | null;
  notes?: string | null;
  isActive?: boolean;
  directMarginPercent?: string | number | null;
  deliveryPartnerMarginPercent?: string | number | null;
  ingredients?: RecipeIngredientRow[] | null;
};

export type RecipeFormState = {
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  yieldQuantity: string;
  yieldUnit: string;
  preparationInstructions: string;
  cookingInstructions: string;
  specialNotes: string;
  directPrice: string;
  deliveryPartnerPrice: string;
  status: RecipeStatus;
};

export const VALID_UNITS = ["Each", "g", "kg", "ml", "L", "pcs", "pack", "box"] as const;
export const COSTING_NOTES_PREFIX = "Recipe costing rows:";

export function createClientId(prefix = "tmp") {
  const randomUUID = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomUUID}`;
}

export function makeIngredient(): RecipeIngredientRow {
  return { id: createClientId("ingredient"), name: "", sourceType: "manual", purchasingItemId: null, purchasingItemKey: "", quantityUsed: "", unitUsed: "", autoUnitCost: null, costingStatus: null, manualOverrideUnitCost: "", notes: "" };
}

export function emptyRecipeForm(): RecipeFormState {
  return { name: "", category: "", description: "", imageUrl: "", yieldQuantity: "1", yieldUnit: "servings", preparationInstructions: "", cookingInstructions: "", specialNotes: "", directPrice: "", deliveryPartnerPrice: "", status: "Draft" };
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fmtMoney(value: unknown) {
  const n = toNumber(value);
  return n === null ? "UNMAPPED" : `฿${n.toFixed(2)}`;
}

export function fmtPercent(value: unknown) {
  const n = toNumber(value);
  return n === null ? "UNMAPPED" : `${n.toFixed(1)}%`;
}

export function purchasingKey(line: PurchasingLine, index: number) {
  return String(line.id ?? line.fieldKey ?? `${line.item || line.name}-${index}`);
}

export function normalizeUnit(unit: string | null | undefined) {
  const value = String(unit ?? "").trim().toLowerCase();
  if (["each", "ea", "unit", "bun"].includes(value)) return "each";
  if (["g", "gram", "grams"].includes(value)) return "g";
  if (["kg", "kilogram", "kilograms"].includes(value)) return "kg";
  if (["ml", "millilitre", "milliliter"].includes(value)) return "ml";
  if (["l", "litre", "liter"].includes(value)) return "l";
  if (["pc", "pcs", "piece", "pieces"].includes(value)) return "pcs";
  if (["pack", "packet"].includes(value)) return "pack";
  if (["box", "carton"].includes(value)) return "box";
  return value;
}

export function calculateAutoUnitCost(line: PurchasingLine | undefined, unitUsed: string): { cost: number | null; reason: string | null } {
  if (!line) return { cost: null, reason: "Missing purchasing item" };
  const directUnitCost = toNumber(line.unitCost ?? line.manualOverrideUnitCost);
  const packCost = toNumber(line.packCost ?? line.lineTotal);
  const purchaseQty = toNumber(line.purchaseUnitQty ?? line.quantity);
  const sourceUnit = normalizeUnit(line.unitDescription ?? line.purchaseUnit ?? line.orderUnit ?? line.purchaseUnitLabel);
  const usedUnit = normalizeUnit(unitUsed);
  if (directUnitCost !== null) {
    if (!usedUnit || usedUnit === sourceUnit || ["each", "pcs"].includes(usedUnit) || ["each", "pcs"].includes(sourceUnit)) return { cost: directUnitCost, reason: null };
    if (sourceUnit === "kg" && usedUnit === "g") return { cost: directUnitCost / 1000, reason: null };
    if (sourceUnit === "g" && usedUnit === "kg") return { cost: directUnitCost * 1000, reason: null };
    if (sourceUnit === "l" && usedUnit === "ml") return { cost: directUnitCost / 1000, reason: null };
    if (sourceUnit === "ml" && usedUnit === "l") return { cost: directUnitCost * 1000, reason: null };
    return { cost: null, reason: "Missing conversion" };
  }
  if (packCost === null) return { cost: null, reason: "Missing purchase price" };
  if (purchaseQty === null || purchaseQty <= 0) return { cost: null, reason: "Missing conversion" };
  return { cost: packCost / purchaseQty, reason: null };
}

export function parseStatus(recipe: Recipe | null | undefined): RecipeStatus {
  if (recipe?.notes?.includes("Recipe status: Archived")) return "Archived";
  if (recipe?.notes?.includes("Recipe status: Draft") || recipe?.isActive === false) return "Draft";
  return "Live";
}

export function parseCostingRows(recipe: Recipe | null | undefined): RecipeIngredientRow[] {
  if (Array.isArray(recipe?.ingredients)) return recipe!.ingredients.map((row) => ({ ...makeIngredient(), ...row, id: row.id || createClientId("ingredient") }));
  const marker = `${COSTING_NOTES_PREFIX} `;
  const line = String(recipe?.notes ?? "").split("\n").find((entry) => entry.startsWith(marker));
  if (!line) return [];
  try {
    const rows = JSON.parse(line.slice(marker.length));
    return Array.isArray(rows) ? rows.map((row) => ({ ...makeIngredient(), ...row, id: createClientId("ingredient"), autoUnitCost: toNumber(row.autoUnitCost), costingStatus: row.costingStatus ?? null })) : [];
  } catch {
    return [];
  }
}

export function notesWithoutWorkflowData(notes?: string | null) {
  return String(notes ?? "").split("\n").filter((line) => !line.startsWith(`${COSTING_NOTES_PREFIX} `) && !line.startsWith("Recipe status:")).join("\n").trim();
}

export function splitInstructions(value?: string | null) {
  const instructions = String(value ?? "");
  return {
    preparationInstructions: instructions.split("Cooking/build instructions:")[0]?.replace("Preparation instructions:", "").trim() ?? "",
    cookingInstructions: instructions.split("Cooking/build instructions:")[1]?.trim() ?? "",
  };
}

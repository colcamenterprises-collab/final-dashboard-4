export const allowedUnits = ["kg", "g", "L", "ml", "each"] as const;

export type Unit = (typeof allowedUnits)[number];

type UnitFamily = "mass" | "volume" | "each";

const unitFamilyMap: Record<Unit, UnitFamily> = {
  kg: "mass",
  g: "mass",
  L: "volume",
  ml: "volume",
  each: "each",
};

const baseUnitMap: Record<UnitFamily, Unit> = {
  mass: "g",
  volume: "ml",
  each: "each",
};

const toBaseFactor: Record<Unit, number> = {
  kg: 1000,
  g: 1,
  L: 1000,
  ml: 1,
  each: 1,
};

export type IngredientAuthorityInput = {
  purchaseQuantity: number;
  purchaseUnit: Unit;
  purchaseCostThb: number;
  portionQuantity: number;
  portionUnit: Unit;
  conversionFactor: number | null;
};

export type IngredientAuthorityDerived = {
  portionsPerPurchase: number;
  costPerPortion: number;
  costPerBaseUnit: number | null;
  baseUnit: Unit;
  conversionNotes: string[];
};

export type IngredientAuthorityInvalidReason =
  | "PURCHASE_QTY_INVALID"
  | "PURCHASE_COST_INVALID"
  | "PORTION_QTY_INVALID"
  | "UNIT_MISMATCH_NO_CONVERSION"
  | "INCOMPATIBLE_UNITS";

export type IngredientAuthorityValidation = {
  valid: boolean;
  errors: IngredientAuthorityInvalidReason[];
  derived: IngredientAuthorityDerived | null;
};

export function validateAndDeriveIngredientAuthority(
  input: IngredientAuthorityInput,
): IngredientAuthorityValidation {
  const errorSet = new Set<IngredientAuthorityInvalidReason>();
  const unitsDiffer = input.purchaseUnit !== input.portionUnit;

  if (!Number.isFinite(input.purchaseQuantity) || input.purchaseQuantity <= 0) {
    errorSet.add("PURCHASE_QTY_INVALID");
  }
  if (!Number.isFinite(input.purchaseCostThb) || input.purchaseCostThb < 0) {
    errorSet.add("PURCHASE_COST_INVALID");
  }
  if (!Number.isFinite(input.portionQuantity) || input.portionQuantity <= 0) {
    errorSet.add("PORTION_QTY_INVALID");
  }
  if (unitsDiffer) {
    if (input.conversionFactor === null || !Number.isFinite(input.conversionFactor)) {
      errorSet.add("UNIT_MISMATCH_NO_CONVERSION");
    } else if (input.conversionFactor <= 0) {
      errorSet.add("UNIT_MISMATCH_NO_CONVERSION");
    }
  }

  const purchaseFamily = unitFamilyMap[input.purchaseUnit];
  const portionFamily = unitFamilyMap[input.portionUnit];

  if (!purchaseFamily || !portionFamily) {
    errorSet.add("INCOMPATIBLE_UNITS");
  }

  if (purchaseFamily && portionFamily && purchaseFamily !== portionFamily) {
    errorSet.add("INCOMPATIBLE_UNITS");
  }

  const errors = Array.from(errorSet);
  if (errors.length > 0) {
    return { valid: false, errors, derived: null };
  }

  const baseUnit = unitsDiffer ? input.portionUnit : baseUnitMap[purchaseFamily];
  const purchaseBaseQty = unitsDiffer
    ? input.purchaseQuantity * (input.conversionFactor ?? 0)
    : input.purchaseQuantity * toBaseFactor[input.purchaseUnit];
  const portionBaseQty = unitsDiffer
    ? input.portionQuantity
    : input.portionQuantity * toBaseFactor[input.portionUnit];

  if (!Number.isFinite(purchaseBaseQty) || purchaseBaseQty <= 0) {
    errorSet.add("PURCHASE_QTY_INVALID");
  }
  if (!Number.isFinite(portionBaseQty) || portionBaseQty <= 0) {
    errorSet.add("PORTION_QTY_INVALID");
  }

  const derivedErrors = Array.from(errorSet);
  if (derivedErrors.length > 0) {
    return { valid: false, errors: derivedErrors, derived: null };
  }

  const portionsPerPurchase = purchaseBaseQty / portionBaseQty;
  const costPerPortion = portionsPerPurchase > 0 ? input.purchaseCostThb / portionsPerPurchase : 0;
  const costPerBaseUnit =
    unitsDiffer ? input.purchaseCostThb / purchaseBaseQty : null;

  const conversionNotes = new Set<string>();
  if (unitsDiffer) {
    conversionNotes.add(
      `1 ${input.purchaseUnit} = ${input.conversionFactor} ${input.portionUnit}`,
    );
  } else if (input.purchaseUnit !== baseUnit) {
    conversionNotes.add(`1 ${input.purchaseUnit} = ${toBaseFactor[input.purchaseUnit]} ${baseUnit}`);
  }

  return {
    valid: true,
    errors: [],
    derived: {
      portionsPerPurchase,
      costPerPortion,
      costPerBaseUnit,
      baseUnit,
      conversionNotes: Array.from(conversionNotes),
    },
  };
}

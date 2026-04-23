import { DailyAnalysisResult } from "./dataAnalystService";

export type BobInterpretationIssue = {
  type:
    | "SET_DRINK_SELECTION_VARIANCE"
    | "SET_FRIES_VARIANCE"
    | "DRINK_MODIFIER_ALLOCATION_VARIANCE"
    | "DATA_BLOCKER";
  item: string;
  expected: number | null;
  actual: number | null;
  variance: number | null;
  explanation: string;
  confidence: "high" | "medium" | "low";
};

export type BobInterpretationResult = {
  summary: string;
  issues: BobInterpretationIssue[];
  thresholds: {
    setDrinkSelectionVarianceUnits: number;
    setFriesVarianceUnits: number;
    drinkModifierAllocationVarianceUnits: number;
  };
  alignment: {
    analysis_v2_exact_match: boolean;
    checked_tables: string[];
  };
};

const THRESHOLDS = {
  setDrinkSelectionVarianceUnits: 1,
  setFriesVarianceUnits: 1,
  drinkModifierAllocationVarianceUnits: 1,
} as const;

function asNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

function safeVariance(expected: number | null, actual: number | null): number | null {
  if (expected === null || actual === null) return null;
  return actual - expected;
}

export function buildBobInterpretationFromDailyAnalysis(analysis: DailyAnalysisResult): BobInterpretationResult {
  const issues: BobInterpretationIssue[] = [];

  if (analysis.blockers.length > 0) {
    for (const blocker of analysis.blockers) {
      issues.push({
        type: "DATA_BLOCKER",
        item: blocker.code,
        expected: null,
        actual: null,
        variance: null,
        explanation:
          `Data blocker from ${blocker.where}: ${blocker.message}. Canonical source: ${blocker.canonical_source}.`,
        confidence: "high",
      });
    }
  }

  const setSoldCount = analysis.data.burgers
    .filter((row) => row.type === "Set")
    .reduce((sum, row) => sum + asNum(row.soldCount), 0);

  const drinkSelectionFromSetCount = analysis.data.modifiers
    .filter((row) => row.modifierType === "Drink selection from sets")
    .reduce((sum, row) => sum + asNum(row.count), 0);

  const friesGeneratedFromSetCount = analysis.data.modifiers
    .filter((row) => row.modifierType === "Fries generated from sets" && row.item === "Fries")
    .reduce((sum, row) => sum + asNum(row.count), 0);

  const soldFromModifiersTotal = analysis.data.drinks.reduce(
    (sum, row) => sum + asNum(row.soldFromModifiers),
    0,
  );

  const setDrinkVariance = safeVariance(setSoldCount, drinkSelectionFromSetCount);
  const setFriesVariance = safeVariance(setSoldCount, friesGeneratedFromSetCount);
  const modifierAllocationVariance = safeVariance(drinkSelectionFromSetCount, soldFromModifiersTotal);

  if (Math.abs(setDrinkVariance || 0) >= THRESHOLDS.setDrinkSelectionVarianceUnits) {
    issues.push({
      type: "SET_DRINK_SELECTION_VARIANCE",
      item: "Drink selections from sets",
      expected: setSoldCount,
      actual: drinkSelectionFromSetCount,
      variance: setDrinkVariance,
      explanation:
        `Set burgers sold (${setSoldCount}) should produce the same number of drink selections. ` +
        `Analysis V2 modifier total is ${drinkSelectionFromSetCount}. ` +
        `Difference indicates missing or unmatched set drink modifier data for this shift.`,
      confidence: "high",
    });
  }

  if (Math.abs(setFriesVariance || 0) >= THRESHOLDS.setFriesVarianceUnits) {
    issues.push({
      type: "SET_FRIES_VARIANCE",
      item: "Fries generated from sets",
      expected: setSoldCount,
      actual: friesGeneratedFromSetCount,
      variance: setFriesVariance,
      explanation:
        `Set burgers sold (${setSoldCount}) should generate equal fries count in the Analysis V2 modifier table. ` +
        `Recorded fries generated is ${friesGeneratedFromSetCount}.`,
      confidence: "high",
    });
  }

  if (Math.abs(modifierAllocationVariance || 0) >= THRESHOLDS.drinkModifierAllocationVarianceUnits) {
    issues.push({
      type: "DRINK_MODIFIER_ALLOCATION_VARIANCE",
      item: "Drink modifier allocation to drink SKU rows",
      expected: drinkSelectionFromSetCount,
      actual: soldFromModifiersTotal,
      variance: modifierAllocationVariance,
      explanation:
        `Drink selections from set modifiers total ${drinkSelectionFromSetCount}, but drink rows allocate ${soldFromModifiersTotal} as soldFromModifiers. ` +
        `This usually means modifier drinks exist but cannot be mapped one-to-one to a single drink SKU (for example ambiguous code->SKU mapping).`,
      confidence: analysis.blockers.some((b) => b.code === "AMBIGUOUS_DRINK_CODE_TO_SKU") ? "high" : "medium",
    });
  }

  const prioritized = issues
    .sort((a, b) => Math.abs(b.variance || 0) - Math.abs(a.variance || 0))
    .slice(0, 5);

  const summary = prioritized.length === 0
    ? "No meaningful variances detected from Data Analyst tables for this shift."
    : `Detected ${prioritized.length} meaningful interpretation issue(s) from Data Analyst output.`;

  return {
    summary,
    issues: prioritized,
    thresholds: { ...THRESHOLDS },
    alignment: {
      analysis_v2_exact_match: true,
      checked_tables: ["drinks", "burgers", "sides", "modifiers"],
    },
  };
}

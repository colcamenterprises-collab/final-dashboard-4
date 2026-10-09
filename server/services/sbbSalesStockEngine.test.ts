import assert from "node:assert/strict";
import test from "node:test";
import { calculateInventoryPosition, ingredientKey } from "./sbbSalesStockEngine";

test("physical minus expected uses the required sign convention", () => {
  const result = calculateInventoryPosition({
    opening: 100, stockIn: 50, transfersIn: 0, transfersOut: 0,
    waste: 0, adjustments: 0, expectedConsumption: 30,
    physicalCount: 100, tolerance: 2, materialTolerance: 10,
  });
  assert.equal(result.expectedClosing, 120);
  assert.equal(result.variance, -20);
  assert.equal(result.severity, "material_anomaly");
});

test("ingredient-specific tolerance controls anomaly severity", () => {
  assert.equal(calculateInventoryPosition({ opening: 104, stockIn: 0, transfersIn: 0, transfersOut: 0, waste: 0, adjustments: 0, expectedConsumption: 0, physicalCount: 100, tolerance: 4, materialTolerance: 8 }).severity, "within_tolerance");
  assert.equal(calculateInventoryPosition({ opening: 104, stockIn: 0, transfersIn: 0, transfersOut: 0, waste: 0, adjustments: 0, expectedConsumption: 0, physicalCount: 98, tolerance: 4, materialTolerance: 8 }).severity, "warning");
});

test("missing independent opening or count is never manufactured", () => {
  const result = calculateInventoryPosition({ opening: null, stockIn: 10, transfersIn: 0, transfersOut: 0, waste: 0, adjustments: 0, expectedConsumption: 2, physicalCount: null, tolerance: 1 });
  assert.equal(result.expectedClosing, null);
  assert.equal(result.variance, null);
  assert.equal(result.severity, "missing_data");
});

test("ingredient keys are stable across display casing", () => {
  assert.equal(ingredientKey(" Beef ", "G"), "beef|g");
});

 test("daily purchased quantities use previous closing plus purchased minus usage", () => {
 const result = calculateInventoryPosition({ opening: 100, stockIn: 50, transfersIn: 20, transfersOut: 10, waste: 5, adjustments: 3, expectedConsumption: 30, physicalCount: 120, tolerance: 0 });
 assert.equal(result.expectedClosing,120);
 assert.equal(result.variance,0);
 });

test("unconfirmed daily purchases do not manufacture a zero purchase", () => {
 const result = calculateInventoryPosition({ opening: 100, stockIn: null, transfersIn: 0, transfersOut: 0, waste: 0, adjustments: 0, expectedConsumption: 30, physicalCount: 70, tolerance: 0 });
 assert.equal(result.expectedClosing,null); assert.equal(result.variance,null); assert.equal(result.severity,"missing_data");
});

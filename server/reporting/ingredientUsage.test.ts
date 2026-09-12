import assert from "node:assert/strict";
import test from "node:test";
import { aggregateIngredientUsageRows } from "./ingredientUsage";

test("set parent, fries and selected drink all contribute their own recipe usage", () => {
  const result = aggregateIngredientUsageRows([
    {
      sold_quantity: 1,
      recipe_id: 101,
      recipe_yield: 1,
      provenance: "sale_snapshot",
      is_set_component: false,
      ingredients: [
        { name: "Beef", unitUsed: "g", quantityUsed: 180 },
        { name: "Burger Roll", unitUsed: "each", quantityUsed: 1 },
      ],
    },
    {
      sold_quantity: 1,
      recipe_id: 102,
      recipe_yield: 1,
      provenance: "sale_snapshot",
      is_set_component: true,
      ingredients: [{ name: "French Fries", unitUsed: "g", quantityUsed: 130 }],
    },
    {
      sold_quantity: 1,
      recipe_id: 103,
      recipe_yield: 1,
      provenance: "sale_snapshot",
      is_set_component: true,
      ingredients: [{ name: "Coke Zero", unitUsed: "each", quantityUsed: 1 }],
    },
  ], []);

  const byName = new Map(result.ingredients.map((row) => [row.name, row.expectedQuantity]));
  assert.equal(byName.get("Beef"), 180);
  assert.equal(byName.get("Burger Roll"), 1);
  assert.equal(byName.get("French Fries"), 130);
  assert.equal(byName.get("Coke Zero"), 1);
  assert.equal(result.coverage.soldItemQuantity, 3);
  assert.equal(result.coverage.mappedItemQuantity, 3);
  assert.equal(result.coverage.setComponentQuantity, 2);
  assert.equal(result.coverage.coveragePct, 100);
});

test("signed modifier recipe effects add and remove ingredients without changing the base recipe", () => {
  const result = aggregateIngredientUsageRows([
    {
      sold_quantity: 1,
      recipe_id: 201,
      recipe_yield: 1,
      provenance: "sale_snapshot",
      ingredients: [
        { name: "American Cheese", unitUsed: "slice", quantityUsed: 2 },
        { name: "Pickles", unitUsed: "g", quantityUsed: 10 },
      ],
    },
  ], [
    {
      sold_quantity: 1,
      recipe_id: 202,
      recipe_yield: 1,
      provenance: "sale_snapshot",
      usage_multiplier: 1,
      ingredients: [{ name: "American Cheese", unitUsed: "slice", quantityUsed: 1 }],
    },
    {
      sold_quantity: 1,
      recipe_id: 203,
      recipe_yield: 1,
      provenance: "sale_snapshot",
      usage_multiplier: -1,
      ingredients: [{ name: "Pickles", unitUsed: "g", quantityUsed: 10 }],
    },
  ]);

  const byName = new Map(result.ingredients.map((row) => [row.name, row.expectedQuantity]));
  assert.equal(byName.get("American Cheese"), 3);
  assert.equal(byName.has("Pickles"), false);
});

test("recipe yield is respected for set components and modifier recipes", () => {
  const result = aggregateIngredientUsageRows([
    {
      sold_quantity: 2,
      recipe_id: 301,
      recipe_yield: 2,
      provenance: "sale_snapshot",
      is_set_component: true,
      ingredients: [{ name: "French Fries", unitUsed: "g", quantityUsed: 260 }],
    },
  ], [
    {
      sold_quantity: 2,
      recipe_id: 302,
      recipe_yield: 2,
      provenance: "sale_snapshot",
      usage_multiplier: 1,
      ingredients: [{ name: "Bacon", unitUsed: "g", quantityUsed: 40 }],
    },
  ]);

  const byName = new Map(result.ingredients.map((row) => [row.name, row.expectedQuantity]));
  assert.equal(byName.get("French Fries"), 260);
  assert.equal(byName.get("Bacon"), 40);
});

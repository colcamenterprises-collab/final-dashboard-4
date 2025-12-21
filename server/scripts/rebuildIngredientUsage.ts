import { rebuildIngredientUsage } from "../services/ingredientUsageDeriver";

(async () => {
  console.log("Rebuilding shift_ingredient_usage...");
  try {
    const result = await rebuildIngredientUsage();
    console.log(`Done. Shifts: ${result.shiftsProcessed}, Usage Records: ${result.usageRecordsCreated}`);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
  process.exit(0);
})();

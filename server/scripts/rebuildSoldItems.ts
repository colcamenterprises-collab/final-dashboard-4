import { deriveAllSoldItems } from "../services/soldItemDeriver";

(async () => {
  console.log("Rebuilding sold_items...");
  try {
    const result = await deriveAllSoldItems();
    console.log(`Done. Shifts: ${result.shiftsProcessed}, Items: ${result.itemsCreated}`);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
  process.exit(0);
})();

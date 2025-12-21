import { rebuildReconciliation } from "../services/reconciliationDeriver";

(async () => {
  console.log("Rebuilding shift_reconciliation...");
  try {
    const result = await rebuildReconciliation();
    console.log(`Done. Shifts: ${result.shiftsProcessed}, Records: ${result.recordsCreated}`);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
  process.exit(0);
})();

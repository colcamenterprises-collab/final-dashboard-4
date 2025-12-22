import { rebuildPnlExpenses } from "../services/pnlExpenseDeriver";

(async () => {
  console.log("Rebuilding P&L expenses...");
  const result = await rebuildPnlExpenses();
  console.log(`P&L expenses rebuild complete.`);
  console.log(`  BUSINESS (BANK): ${result.businessCount}`);
  console.log(`  SHIFT (CASH): ${result.shiftCount}`);
  console.log(`  Total: ${result.total}`);
  process.exit(0);
})();

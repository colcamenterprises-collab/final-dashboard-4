import { rebuildAlerts } from "../services/alertDeriver";
import { prisma } from "../../lib/prisma";

(async () => {
  console.log("Rebuilding alerts...");
  const result = await rebuildAlerts();
  
  console.log("Alerts rebuild complete.");
  console.log(`  Shifts processed: ${result.shiftsProcessed}`);
  console.log(`  CRITICAL alerts: ${result.criticalCount}`);
  console.log(`  WARNING alerts: ${result.warningCount}`);
  
  await prisma.$disconnect();
})();

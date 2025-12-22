import { rebuildRecipeCoverage } from "../services/recipeCoverageDeriver";
import { prisma } from "../../lib/prisma";

(async () => {
  console.log("Rebuilding recipe coverage...");
  const shiftCount = await rebuildRecipeCoverage();
  
  const coverage = await prisma.shiftRecipeCoverage.findMany();
  const totalMapped = coverage.reduce((sum, c) => sum + c.mappedItems, 0);
  const totalItems = coverage.reduce((sum, c) => sum + c.totalSoldItems, 0);
  const avgCoverage = totalItems === 0 ? 100 : Math.round((totalMapped / totalItems) * 100);
  
  console.log("Recipe coverage rebuild complete.");
  console.log(`  Shifts processed: ${shiftCount}`);
  console.log(`  Total sold items: ${totalItems}`);
  console.log(`  Mapped to recipes: ${totalMapped}`);
  console.log(`  Average coverage: ${avgCoverage}%`);
  
  await prisma.$disconnect();
})();

/**
 * 🔐 PATCH 1.6.18: P&L Read Model Rebuild Script
 * Rebuilds pnl_read_model for a date range.
 * Usage: npx tsx server/scripts/rebuildPnlReadModel.ts --from=2026-01-01 --to=2026-01-05
 */

import { rebuildRange } from '../services/pnlReadModelService';

async function main() {
  const args = process.argv.slice(2);
  
  let from = '2026-01-01';
  let to = new Date().toISOString().split('T')[0];

  for (const arg of args) {
    if (arg.startsWith('--from=')) {
      from = arg.replace('--from=', '');
    }
    if (arg.startsWith('--to=')) {
      to = arg.replace('--to=', '');
    }
  }

  console.log(`[PnlRebuild] Rebuilding P&L data from ${from} to ${to}...`);

  try {
    const result = await rebuildRange(from, to);
    console.log(`[PnlRebuild] ✅ Rebuilt ${result.rebuilt} days`);
    
    if (result.errors.length > 0) {
      console.log(`[PnlRebuild] ⚠️ Errors:`);
      result.errors.forEach(e => console.log(`  - ${e}`));
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error(`[PnlRebuild] ❌ Failed:`, error.message);
    process.exit(1);
  }
}

main();

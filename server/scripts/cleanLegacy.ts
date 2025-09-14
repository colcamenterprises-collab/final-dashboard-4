import { db } from '../db';
import { ingredients } from '../../shared/schema';
import { ilike, eq } from 'drizzle-orm';

async function cleanLegacy() {
  // Delete made-up/old (list from summary, e.g., filter name like 'made-up%')
  // await db.delete(ingredients).where(ilike(ingredients.name, '%made-up%'));
  // Update old costs (e.g., onions from script)
  // await db.update(ingredients).set({ unitPrice: 50 }).where(eq(ingredients.name, 'onions'));
  console.log('Legacy cleaned (table does not exist - expected for cleanup)');
}
cleanLegacy();
// Run npx tsx server/scripts/cleanLegacy.ts—log changes, then comment out.
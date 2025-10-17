/* eslint-disable no-console */
import 'dotenv/config';
import fetch from 'node-fetch';

const SERVER = process.env.SERVER_URL || 'http://localhost:5000';
const TEST_DATE = '2025-10-15'; // matches the seed window

// Expected from seeded data
const EXPECT = {
  totalBurgers: 13,
  patties: 11,
  redMeatGrams: 11 * 95,   // 1045
  chickenGrams: 600,       // 6 x 100
  rolls: 13
};

function assertEq(label: string, got: number, want: number) {
  const ok = got === want;
  console.log(`${ok ? '✅' : '❌'} ${label}: got=${got} want=${want}`);
  if (!ok) throw new Error(`${label} mismatch`);
}

(async function main() {
  try {
    const url = `${SERVER}/api/receipts/shift/burgers?date=${TEST_DATE}`;
    console.log(`→ GET ${url}`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json() as any;

    if (!j.ok) throw new Error(j.error || 'Endpoint returned ok=false');

    const data = j.data as {
      shiftDate: string;
      totals: { burgers: number; patties: number; redMeatGrams: number; chickenGrams: number; rolls: number };
      products: Array<{ normalizedName: string; qty: number }>;
    };

    console.log('\n=== Products ===');
    for (const p of data.products) {
      if (p.qty > 0) console.log(`- ${p.normalizedName}: ${p.qty}`);
    }

    console.log('\n=== Totals ===');
    console.log(data.totals);

    // Assertions
    assertEq('Total Burgers', data.totals.burgers, EXPECT.totalBurgers);
    assertEq('Beef Patties', data.totals.patties, EXPECT.patties);
    assertEq('Red Meat (g)', data.totals.redMeatGrams, EXPECT.redMeatGrams);
    assertEq('Chicken (g)', data.totals.chickenGrams, EXPECT.chickenGrams);
    assertEq('Rolls', data.totals.rolls, EXPECT.rolls);

    console.log('\n🎉 TEST PASSED — burger metrics match expected.');
    process.exit(0);
  } catch (e: any) {
    console.error('\n💥 TEST FAILED:', e?.message || e);
    process.exit(1);
  }
})();

/* eslint-disable no-console */
import 'dotenv/config';
import fetch from 'node-fetch';

const SERVER = process.env.SERVER_URL || 'http://localhost:5000';
const TEST_DATE = '2025-10-15';

const EXPECT = {
  burgers: 13,
  patties: 11,
  redMeatGrams: 11 * 95,  // 1045
  chickenGrams: 600,      // 6 x 100
  rolls: 13,
};

function check(label: string, got: number, want: number) {
  const ok = got === want;
  console.log(`${ok ? '✅' : '❌'} ${label}: got=${got} want=${want}`);
  if (!ok) throw new Error(`${label} mismatch`);
}

(async () => {
  try {
    const url = `${SERVER}/api/receipts/shift/burgers?date=${TEST_DATE}`;
    console.log(`→ GET ${url}`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json() as any;
    if (!j.ok) throw new Error(j.error || 'ok=false');

    const d = j.data as {
      products: Array<{ normalizedName: string; qty: number }>;
      totals: { burgers: number; patties: number; redMeatGrams: number; chickenGrams: number; rolls: number };
      fromISO: string; toISO: string; shiftDate: string;
    };

    console.log('\n=== Non-zero products ===');
    d.products.filter(p => p.qty > 0).forEach(p => console.log(`- ${p.normalizedName}: ${p.qty}`));

    console.log('\n=== Totals ===');
    console.log(d.totals);

    check('Total Burgers', d.totals.burgers, EXPECT.burgers);
    check('Beef Patties', d.totals.patties, EXPECT.patties);
    check('Red Meat (g)', d.totals.redMeatGrams, EXPECT.redMeatGrams);
    check('Chicken (g)', d.totals.chickenGrams, EXPECT.chickenGrams);
    check('Rolls', d.totals.rolls, EXPECT.rolls);

    console.log('\n🎉 TEST PASSED — burger metrics are correct.');
    process.exit(0);
  } catch (e: any) {
    console.error('\n💥 TEST FAILED:', e?.message || e);
    process.exit(1);
  }
})();

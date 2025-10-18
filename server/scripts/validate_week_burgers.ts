import 'dotenv/config';
import { DateTime } from 'luxon';

const SERVER = process.env.SERVER_URL || 'http://localhost:5000';
const TZ = 'Asia/Bangkok';

async function day(label: string) {
  const live = await (await fetch(`${SERVER}/api/receipts/shift/burgers?date=${label}&source=live`)).then(r => r.json());
  const cache = await (await fetch(`${SERVER}/api/receipts/shift/burgers?date=${label}`)).then(r => r.json());

  if (!live.ok) throw new Error(`live failed for ${label}`);
  if (!cache.ok) throw new Error(`cache failed for ${label}`);

  const a = live.data.totals;
  const b = cache.data.totals;

  const same = (x: any, y: any) =>
    x.burgers === y.burgers &&
    x.patties === y.patties &&
    x.redMeatGrams === y.redMeatGrams &&
    x.chickenGrams === y.chickenGrams &&
    x.rolls === y.rolls;

  const ok = same(a, b);
  console.log(`${ok ? '✅' : '❌'} ${label} — live ${JSON.stringify(a)} vs cache ${JSON.stringify(b)}`);
  if (!ok) throw new Error(`Mismatch on ${label}`);
}

(async () => {
  try {
    const from = process.env.WEEK_FROM || '2025-10-11';
    const to = process.env.WEEK_TO || '2025-10-17';
    
    const start = DateTime.fromISO(from, { zone: TZ });
    const end = DateTime.fromISO(to, { zone: TZ });
    
    console.log(`\n🔍 Validating burger metrics from ${from} to ${to}...\n`);
    
    for (let d = start; d <= end; d = d.plus({ days: 1 })) {
      await day(d.toISODate()!);
    }
    
    console.log('\n🎉 Week validation passed (live == cache for all days).');
    process.exit(0);
  } catch (e: any) {
    console.error('\n💥 Week validation FAILED:', e?.message || e);
    process.exit(1);
  }
})();

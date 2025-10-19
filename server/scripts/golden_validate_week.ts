import 'dotenv/config';
import fetch from 'node-fetch';
import { DateTime } from 'luxon';

const SERVER = process.env.SERVER_URL || 'http://localhost:5000';
const FROM = process.env.WEEK_FROM || '2025-10-12';
const TO   = process.env.WEEK_TO   || '2025-10-18';

function eq(a:any,b:any){return a.burgers===b.burgers&&a.patties===b.patties&&a.redMeatGrams===b.redMeatGrams&&a.chickenGrams===b.chickenGrams&&a.rolls===b.rolls;}

(async () => {
  const s = DateTime.fromISO(FROM), e = DateTime.fromISO(TO);
  for (let d=s; d<=e; d=d.plus({days:1})) {
    const day = d.toISODate();
    const live = await (await fetch(`${SERVER}/api/receipts/shift/burgers?date=${day}&source=live`)).json();
    const cache= await (await fetch(`${SERVER}/api/receipts/shift/burgers?date=${day}`)).json();
    if (!live.ok || !cache.ok) throw new Error(`API failed for ${day}`);
    const ok = eq(live.data.totals, cache.data.totals);
    console.log(`${ok ? '✅' : '❌'} ${day} live=${JSON.stringify(live.data.totals)} cache=${JSON.stringify(cache.data.totals)}`);
    if (!ok) throw new Error(`Mismatch on ${day}`);
  }
  console.log('\n🎉 Golden Hour: week validation passed (live == cache).');
})();

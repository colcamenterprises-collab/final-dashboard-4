import 'dotenv/config';
import fetch from 'node-fetch';
const SERVER = process.env.SERVER_URL || 'http://localhost:5000';
const DAY = process.env.GH_DAY || '2025-10-18';
(async () => {
  const live = await (await fetch(`${SERVER}/api/receipts/shift/burgers?date=${DAY}&source=live`)).json();
  const cache= await (await fetch(`${SERVER}/api/receipts/shift/burgers?date=${DAY}`)).json();
  console.log('LIVE ', live.data.totals);
  console.log('CACHE', cache.data.totals);
})();

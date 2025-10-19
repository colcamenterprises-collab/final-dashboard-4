import 'dotenv/config';
import fetch from 'node-fetch';
const SERVER = process.env.SERVER_URL || 'http://localhost:5000';
const DAY = process.env.GH_DAY || '2025-10-18';
(async () => {
  const r = await fetch(`${SERVER}/api/receipts/shift/burgers/rebuild?date=${DAY}`, { method:'POST' });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
  console.log(j.data.totals);
})();

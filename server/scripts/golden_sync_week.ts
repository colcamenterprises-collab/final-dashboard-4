import 'dotenv/config';
import fetch from 'node-fetch';

const SERVER = process.env.SERVER_URL || 'http://localhost:5000';
const FROM = process.env.WEEK_FROM || '2025-10-12';
const TO   = process.env.WEEK_TO   || '2025-10-18';

(async () => {
  const r = await fetch(`${SERVER}/api/loyverse/sync`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ from: FROM, to: TO }),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
  console.log('Imported:', j.imported);
  console.log('Cached burgers per day:', j.caches);
})();

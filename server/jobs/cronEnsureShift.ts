import cron from "node-cron";
import { ensureShift } from "../services/ensureShift.js";

function yesterdayYMD() {
  const now = new Date(new Date().toLocaleString("en-US",{ timeZone:"Asia/Bangkok"}));
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,"0");
  const d = String(now.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

export function registerEnsureShiftCron() {
  cron.schedule("5 3 * * *", async () => {
    try { await ensureShift(yesterdayYMD()); } catch {}
  }, { timezone: "Asia/Bangkok" });
}

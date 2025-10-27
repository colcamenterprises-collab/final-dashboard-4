import cron from "node-cron";
import { runScheduledDailyReviewEmail } from "./dailySummaryEmail";

// Start all jobs
export function startJobs() {
  // 09:00 Asia/Bangkok every day
  cron.schedule("0 9 * * *", async () => {
    try {
      console.log("[jobs] Running scheduled Daily Review email...");
      await runScheduledDailyReviewEmail();
      console.log("[jobs] Daily Review email sent successfully.");
    } catch (e) {
      console.error("[jobs] Daily Review email failed:", e);
    }
  }, { timezone: "Asia/Bangkok" });

  console.log("[jobs] Scheduler started (09:00 Asia/Bangkok - Daily Review Email).");
}

/**
 * DAILY REPORT CRON — 3AM BANGKOK
 *
 * Automatically compiles the daily report, generates the PDF,
 * saves it, and emails it to SBB management.
 */

import cron from "node-cron";
import { DateTime } from "luxon";
import { compileDailyReportV2, saveDailyReportV2 } from "../services/dailyReportV2";
import { buildDailyReportPDF } from "../pdf/dailyReportV2.pdf";
import { sendDailyReportEmailV2 } from "../lib/dailyReportEmailV2";

export function registerDailyReportCron() {
  console.log("[CRON] Daily report cron registered (03:00 Asia/Bangkok)");

  cron.schedule(
    "0 3 * * *", // 3:00 AM
    async () => {
      try {
        const now = DateTime.now().setZone("Asia/Bangkok");
        const shiftDate = now.minus({ days: 1 }).toISODate();

        console.log(`[CRON] Running daily report for shiftDate=${shiftDate}`);

        // Compile JSON payload
        const reportJson = await compileDailyReportV2(shiftDate);
        if (reportJson.error) {
          console.warn(`[CRON] Report missing: ${reportJson.error}`);
          return;
        }

        // Build PDF
        const pdf = await buildDailyReportPDF(reportJson);

        // Save to DB
        const reportId = await saveDailyReportV2(reportJson);
        console.log(`[CRON] Saved report ID ${reportId}`);

        // Send email
        await sendDailyReportEmailV2(pdf, shiftDate);
        console.log(`[CRON] Email sent for ${shiftDate}`);
      } catch (err) {
        console.error("[CRON] ERROR during daily report:", err);
      }
    },
    {
      timezone: "Asia/Bangkok",
    }
  );
}
